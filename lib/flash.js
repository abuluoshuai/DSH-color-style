/**
 * dsh-taskbar-flash — native side.
 *
 * The Host process cannot touch the Electron window directly, but it is a
 * direct child of the Desktop application's main process, which owns the
 * window. One short PowerShell call therefore finds the top-level window of
 * `process.ppid` and asks Win32 `FlashWindowEx` for the standard taskbar
 * attention flash. The script is a separate file so its C# interop block stays
 * out of this module and out of the Host bundle.
 *
 * The call is fire-and-forget: it never blocks the Host, and a missing or
 * broken PowerShell only produces a log line.
 *
 * @module dsh-taskbar-flash/flash
 */

import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

/** Absolute path of the helper; `-File` receives it as one argument. */
const SCRIPT_PATH = fileURLToPath(new URL('../scripts/flash-window.ps1', import.meta.url))

/**
 * Run the helper once.
 *
 * @param {object} options
 * @param {import('./config.js').DEFAULT_CONFIG} options.config - resolved config.
 * @param {number} options.parentPid - the process whose window should flash.
 * @param {(result: object) => void} [options.onResult] - receives the helper's
 *   parsed JSON line (or a synthetic failure), exactly once.
 */
export function flashTaskbar({ config, parentPid, onResult }) {
  const args = [
    '-NoProfile',
    '-NonInteractive',
    '-ExecutionPolicy',
    'Bypass',
    '-File',
    SCRIPT_PATH,
    '-ParentPid',
    String(parentPid),
    '-Count',
    String(config.flashCount),
    '-ProcessName',
    config.processName,
  ]
  if (!config.onlyWhenUnfocused) args.push('-Force')

  let settled = false
  const settle = (result) => {
    if (settled) return
    settled = true
    onResult?.(result)
  }

  let child
  try {
    child = spawn(config.powerShellCommand, args, {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  } catch (error) {
    settle({ ok: false, action: 'spawn-error', error: String(error) })
    return
  }

  let stdout = ''
  let stderr = ''
  child.stdout?.setEncoding('utf8')
  child.stderr?.setEncoding('utf8')
  child.stdout?.on('data', (chunk) => {
    if (stdout.length < 8192) stdout += chunk
  })
  child.stderr?.on('data', (chunk) => {
    if (stderr.length < 8192) stderr += chunk
  })
  child.on('error', (error) => settle({ ok: false, action: 'spawn-error', error: String(error) }))
  child.on('close', (code) => {
    const line = stdout.trim().split(/\r?\n/).filter(Boolean).pop() ?? ''
    let result
    try {
      result = JSON.parse(line)
    } catch {
      result = {
        ok: code === 0,
        action: 'unparsed',
        code,
        raw: line.slice(0, 200),
      }
    }
    if (code !== 0 && result.ok !== false) result.code = code
    if (stderr.trim() !== '') result.stderr = stderr.trim().slice(0, 500)
    settle(result)
  })
  child.unref?.()
}
