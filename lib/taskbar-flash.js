/**
 * dsh-color-style — taskbar attention flash.
 *
 * The colour schemes are a Client concern, but this part runs on the Host: it
 * watches the Agent status feed and the two interactive-request waterfalls
 * (`approval/request` and `user-questions/request`), and when a root Session
 * finishes a turn, asks a tool approval, or asks a structured user question
 * while the DSH window is not focused, asks the Desktop shell's window to flash
 * its taskbar button. The Host process is a direct child of the Electron main
 * process that owns that window, which is what makes this possible without
 * touching the DSH installation.
 *
 * Everything here is injectable so the event logic is testable without a
 * window: `flash`, `parentPid`, `platform`, and `writeLog` are options.
 *
 * @module dsh-color-style/taskbar-flash
 */

import { appendFileSync, mkdirSync, renameSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { flashTaskbar } from './flash.js'

/** Rotate the debugging log above this size instead of growing forever. */
const LOG_MAX_BYTES = 256 * 1024

/** Small debounce so one request with several prompts flashes once. */
const INTERACTION_FLASH_DELAY_MS = 250

/** Defaults documented in README.md under "完成时闪烁任务栏". */
export const DEFAULT_TASKBAR_FLASH = Object.freeze({
  enabled: true,
  ignoreSubagents: true,
  onlyWhenUnfocused: true,
  onInteraction: true,
  flashCount: 0,
  cooldownMs: 1500,
  processName: 'DeepSeek Harness',
  powerShellCommand: 'powershell.exe',
  log: true,
})

/**
 * Resolve the `config.taskbarFlash` block into normalized values.
 *
 * The row config is hand-written in `cordis.patch.yml`, so every key is
 * optional and a bad value falls back with one note instead of failing the
 * plugin.
 *
 * @param {unknown} raw - the row's `config.taskbarFlash`.
 * @returns {{ config: typeof DEFAULT_TASKBAR_FLASH, notes: string[] }}
 */
export function resolveTaskbarFlashConfig(raw) {
  const notes = []
  const source = raw !== null && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}
  if (raw !== undefined && (raw === null || typeof raw !== 'object' || Array.isArray(raw))) {
    notes.push('taskbarFlash is not an object; defaults are used')
  }
  const readBool = (key) => {
    const value = source[key]
    if (value === undefined) return DEFAULT_TASKBAR_FLASH[key]
    if (typeof value === 'boolean') return value
    notes.push(`taskbarFlash.${key} must be a boolean; using ${String(DEFAULT_TASKBAR_FLASH[key])}`)
    return DEFAULT_TASKBAR_FLASH[key]
  }
  const readNatural = (key, min, max) => {
    const value = source[key]
    if (value === undefined) return DEFAULT_TASKBAR_FLASH[key]
    const number = Number(value)
    if (!Number.isFinite(number) || !Number.isInteger(number) || number < min || number > max) {
      notes.push(
        `taskbarFlash.${key} must be an integer in ${String(min)}..${String(max)}; using ${String(DEFAULT_TASKBAR_FLASH[key])}`,
      )
      return DEFAULT_TASKBAR_FLASH[key]
    }
    return number
  }
  const readString = (key) => {
    const value = source[key]
    if (value === undefined) return DEFAULT_TASKBAR_FLASH[key]
    if (typeof value === 'string' && value.trim() !== '') return value
    notes.push(`taskbarFlash.${key} must be a non-empty string; using ${JSON.stringify(DEFAULT_TASKBAR_FLASH[key])}`)
    return DEFAULT_TASKBAR_FLASH[key]
  }
  const config = {
    enabled: readBool('enabled'),
    ignoreSubagents: readBool('ignoreSubagents'),
    onlyWhenUnfocused: readBool('onlyWhenUnfocused'),
    onInteraction: readBool('onInteraction'),
    flashCount: readNatural('flashCount', 0, 99),
    cooldownMs: readNatural('cooldownMs', 0, 60_000),
    processName: readString('processName'),
    powerShellCommand: readString('powerShellCommand'),
    log: readBool('log'),
  }
  for (const key of Object.keys(source)) {
    if (!Object.hasOwn(DEFAULT_TASKBAR_FLASH, key)) notes.push(`unknown taskbarFlash key "${key}" is ignored`)
  }
  return { config: Object.freeze(config), notes }
}

/**
 * Resolve `$DSH_HOME/taskbar-flash/attention.log` without assuming an
 * environment variable exists.
 *
 * @returns {Promise<string | undefined>} the log file, when a home is known.
 */
async function resolveLogFile() {
  let home
  try {
    const homePaths = await import('@deepseek-ai/dsh-home-paths')
    if (typeof homePaths.resolveDshHome === 'function') home = await homePaths.resolveDshHome()
  } catch {
    /* fall through to the environment */
  }
  if (typeof home !== 'string' || home === '') {
    const fromEnv = process.env.DSH_HOME
    if (typeof fromEnv === 'string' && fromEnv !== '') home = fromEnv
  }
  if (typeof home !== 'string' || home === '') {
    try {
      home = join(homedir(), '.dsh')
    } catch {
      return undefined
    }
  }
  return join(home, 'taskbar-flash', 'attention.log')
}

/**
 * Mount the taskbar-flash behaviour on a Host context.
 *
 * @param {object} ctx - Host context of the color-style row.
 * @param {unknown} config - the row's `config.taskbarFlash` block.
 * @param {object} [deps] - injectable dependencies for tests.
 * @param {object} [deps.logger] - Host logger.
 * @param {NodeJS.Platform} [deps.platform] - defaults to `process.platform`.
 * @param {number} [deps.parentPid] - the window owner; defaults to `process.ppid`.
 * @param {typeof flashTaskbar} [deps.flash] - native flash implementation.
 * @param {(line: string) => void} [deps.writeLog] - override the debug log.
 * @param {number} [deps.interactionDelayMs] - debounce for interactive requests.
 * @returns {() => void} disposal of every registration and timer.
 */
export function installTaskbarFlash(ctx, config, deps = {}) {
  const platform = deps.platform ?? process.platform
  const logger = deps.logger ?? ctx?.logger
  const flash = deps.flash ?? flashTaskbar
  const { config: resolved, notes } = resolveTaskbarFlashConfig(config)
  for (const note of notes) logger?.warn?.(`dsh-color-style: ${note}`)

  let logFilePromise
  const writeLog =
    deps.writeLog ??
    ((line) => {
      if (!resolved.log) return
      logFilePromise ??= resolveLogFile()
      void logFilePromise.then((file) => {
        if (file === undefined) return
        try {
          mkdirSync(dirname(file), { recursive: true })
          try {
            if (statSync(file).size > LOG_MAX_BYTES) renameSync(file, `${file}.1`)
          } catch {
            /* first write, or rotation raced */
          }
          appendFileSync(file, `${new Date().toISOString()} ${line}\n`)
        } catch {
          /* logging must never fail the Host */
        }
      })
    })

  if (!resolved.enabled) {
    writeLog('taskbar-flash: disabled by config')
    return () => {}
  }
  if (platform !== 'win32') {
    writeLog(`taskbar-flash: unsupported platform ${platform}`)
    logger?.info?.(`dsh-color-style: taskbar flashing is Windows-only (platform=${platform})`)
    return () => {}
  }

  const parentPid = deps.parentPid ?? process.ppid ?? 0
  let disposed = false
  /** Last observed agent status, so only `running → idle` counts. */
  const lastStatus = new Map()
  /** Pending coalescing timer; `null` when no flash is scheduled. */
  let timer = null
  /** Completions collected inside the current cooldown window. */
  let pending = 0

  const flashNow = () => {
    timer = null
    if (disposed) return
    const completed = pending
    pending = 0
    writeLog(`attention detected (${String(completed)} event(s), ppid=${String(parentPid)})`)
    flash({
      config: resolved,
      parentPid,
      onResult: (result) => writeLog(`flash ${String(result.action ?? 'unknown')}: ${JSON.stringify(result)}`),
    })
  }

  const requestFlash = (delayMs = resolved.cooldownMs) => {
    if (disposed) return
    pending += 1
    if (timer !== null) return
    timer = setTimeout(flashNow, delayMs)
    timer.unref?.()
  }

  const isSubagent = (agent) => {
    if (!resolved.ignoreSubagents) return false
    const subagents = ctx?.get?.('subagents')
    if (!subagents || typeof subagents.rootOf !== 'function') return false
    try {
      const root = subagents.rootOf(agent)
      return root !== null && root !== undefined && root.id !== agent.id
    } catch {
      return false
    }
  }

  /**
   * One prompt that needs the user (a tool approval or a structured question).
   * Subagent prompts follow `ignoreSubagents`; the debounce keeps a request
   * carrying several prompts down to one flash.
   */
  const noteInteraction = (kind, request) => {
    if (disposed || !resolved.onInteraction) return
    const agent = request?.agent
    if (agent !== null && agent !== undefined && isSubagent(agent)) {
      writeLog(`skip: subagent ${kind} request`)
      return
    }
    writeLog(`${kind} request detected; scheduling attention flash`)
    requestFlash(deps.interactionDelayMs ?? INTERACTION_FLASH_DELAY_MS)
  }

  /** Observe a waterfall event; the composed answerer still decides. */
  const observeInteraction = (kind) => (request, next) => {
    try {
      noteInteraction(kind, request)
    } catch (error) {
      writeLog(`${kind} hook failed: ${String(error)}`)
    }
    return next()
  }

  const offStatus = ctx.on('agent/status', (payload) => {
    const agent = payload?.agent
    const status = payload?.status
    if (agent?.id === undefined || typeof status !== 'string') return
    const before = lastStatus.get(agent.id)
    lastStatus.set(agent.id, status)
    if (status !== 'idle' || before !== 'running') return
    if (isSubagent(agent)) {
      writeLog(`skip: subagent turn end (${String(agent.id)})`)
      return
    }
    requestFlash()
  })
  const offDisposed = ctx.on('agent/disposed', (payload) => {
    const id = payload?.agent?.id
    if (id !== undefined) lastStatus.delete(id)
  })
  /* The Remote bridge registers its own waterfall listeners during Host boot and
     claims each request by forwarding it to the browser, so a later listener
     would never be reached. Prepend puts this observer in front: it records the
     prompt and calls next(), then the shipped bridge answers the request. */
  const offApproval = ctx.on('approval/request', observeInteraction('approval'), { prepend: true })
  const offQuestions = ctx.on('user-questions/request', observeInteraction('question'), { prepend: true })
  writeLog(`taskbar-flash loaded (ppid=${String(parentPid)})`)
  logger?.info?.('dsh-color-style: attention flash is active for finished turns and interactive requests')

  return () => {
    disposed = true
    offStatus?.()
    offDisposed?.()
    offApproval?.()
    offQuestions?.()
    lastStatus.clear()
    if (timer !== null) {
      clearTimeout(timer)
      timer = null
    }
  }
}
