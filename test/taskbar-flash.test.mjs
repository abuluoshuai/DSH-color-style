import assert from 'node:assert/strict'
import { test } from 'node:test'
import { DEFAULT_TASKBAR_FLASH, installTaskbarFlash, resolveTaskbarFlashConfig } from '../lib/taskbar-flash.js'

/** Minimal Host context: records listeners and lets the test emit events. */
function createCtx({ rootId = 'root', throwOnRootOf = false } = {}) {
  const listeners = new Map()
  const calls = []
  const ctx = {
    logger: { warn: (line) => calls.push(['warn', line]), info: (line) => calls.push(['info', line]) },
    on(name, fn) {
      const list = listeners.get(name) ?? []
      list.push(fn)
      listeners.set(name, list)
      return () => {
        const index = list.indexOf(fn)
        if (index >= 0) list.splice(index, 1)
      }
    },
    get(name) {
      if (name !== 'subagents') return undefined
      return {
        rootOf(agent) {
          if (throwOnRootOf) throw new Error('not managed')
          return { id: rootId, isRoot: agent.id === rootId }
        },
      }
    },
    emit(name, payload) {
      for (const fn of [...(listeners.get(name) ?? [])]) fn(payload)
    },
    listenerCount(name) {
      return (listeners.get(name) ?? []).length
    },
    calls,
  }
  return ctx
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/** Mount with an injected flash + log and zero coalescing delay. */
function mount(overrides = {}, deps = {}) {
  const ctx = deps.ctx ?? createCtx()
  const flashes = []
  const logs = []
  const dispose = installTaskbarFlash(
    ctx,
    { ...overrides },
    {
      platform: 'win32',
      parentPid: 4242,
      flash: ({ config, parentPid, onResult }) => {
        flashes.push({ config, parentPid })
        onResult?.({ ok: true, action: 'flash' })
      },
      writeLog: (line) => logs.push(line),
      ...deps,
    },
  )
  return { ctx, flashes, logs, dispose }
}

test('defaults when the block is absent', () => {
  const { config, notes } = resolveTaskbarFlashConfig(undefined)
  assert.deepEqual(config, DEFAULT_TASKBAR_FLASH)
  assert.deepEqual(notes, [])
})

test('bad values fall back with notes', () => {
  const { config, notes } = resolveTaskbarFlashConfig({
    enabled: 'yes',
    flashCount: -1,
    cooldownMs: 1.5,
    processName: '   ',
    log: 1,
    typo: true,
  })
  assert.equal(config.enabled, DEFAULT_TASKBAR_FLASH.enabled)
  assert.equal(config.flashCount, DEFAULT_TASKBAR_FLASH.flashCount)
  assert.equal(config.cooldownMs, DEFAULT_TASKBAR_FLASH.cooldownMs)
  assert.equal(config.processName, DEFAULT_TASKBAR_FLASH.processName)
  assert.equal(config.log, DEFAULT_TASKBAR_FLASH.log)
  assert.equal(notes.length, 6)
  assert.ok(notes.some((note) => note.includes('typo')))
})

test('a finished root turn flashes once', async () => {
  const { ctx, flashes, logs } = mount({ cooldownMs: 0 })
  ctx.emit('agent/status', { agent: { id: 'root' }, status: 'running' })
  ctx.emit('agent/status', { agent: { id: 'root' }, status: 'idle' })
  await sleep(15)
  assert.equal(flashes.length, 1)
  assert.equal(flashes[0].parentPid, 4242)
  assert.ok(logs.some((line) => line.startsWith('completion detected')))
  assert.ok(logs.some((line) => line.includes('"action":"flash"')))
})

test('going idle without a running turn does not flash', async () => {
  const { ctx, flashes } = mount({ cooldownMs: 0 })
  ctx.emit('agent/status', { agent: { id: 'root' }, status: 'idle' })
  await sleep(15)
  assert.equal(flashes.length, 0)
})

test('subagent completions are ignored by default', async () => {
  const ctx = createCtx({ rootId: 'root' })
  const { flashes, logs } = mount({ cooldownMs: 0 }, { ctx })
  ctx.emit('agent/status', { agent: { id: 'child' }, status: 'running' })
  ctx.emit('agent/status', { agent: { id: 'child' }, status: 'idle' })
  await sleep(15)
  assert.equal(flashes.length, 0)
  assert.ok(logs.some((line) => line.includes('skip: subagent')))
})

test('subagent completions flash when ignoreSubagents is false', async () => {
  const ctx = createCtx({ rootId: 'root' })
  const { flashes } = mount({ cooldownMs: 0, ignoreSubagents: false }, { ctx })
  ctx.emit('agent/status', { agent: { id: 'child' }, status: 'running' })
  ctx.emit('agent/status', { agent: { id: 'child' }, status: 'idle' })
  await sleep(15)
  assert.equal(flashes.length, 1)
})

test('an unmanaged agent rootOf throw still counts as a root turn', async () => {
  const ctx = createCtx({ throwOnRootOf: true })
  const { flashes } = mount({ cooldownMs: 0 }, { ctx })
  ctx.emit('agent/status', { agent: { id: 'x' }, status: 'running' })
  ctx.emit('agent/status', { agent: { id: 'x' }, status: 'idle' })
  await sleep(15)
  assert.equal(flashes.length, 1)
})

test('completions inside the cooldown collapse into one flash', async () => {
  const { ctx, flashes, logs } = mount({ cooldownMs: 20, ignoreSubagents: false })
  for (const id of ['a', 'b']) {
    ctx.emit('agent/status', { agent: { id }, status: 'running' })
    ctx.emit('agent/status', { agent: { id }, status: 'idle' })
  }
  await sleep(40)
  assert.equal(flashes.length, 1)
  assert.ok(logs.some((line) => line.includes('2 event(s)')))
})

test('disposal removes listeners and pending flashes', async () => {
  const { ctx, flashes, dispose } = mount({ cooldownMs: 20 })
  ctx.emit('agent/status', { agent: { id: 'root' }, status: 'running' })
  ctx.emit('agent/status', { agent: { id: 'root' }, status: 'idle' })
  dispose()
  await sleep(40)
  assert.equal(flashes.length, 0)
  assert.equal(ctx.listenerCount('agent/status'), 0)
})

test('disabled and non-Windows installs stay inert', async () => {
  const disabled = mount({ enabled: false })
  disabled.ctx.emit('agent/status', { agent: { id: 'root' }, status: 'running' })
  disabled.ctx.emit('agent/status', { agent: { id: 'root' }, status: 'idle' })
  await sleep(15)
  assert.equal(disabled.flashes.length, 0)

  const ctx = createCtx()
  const { flashes, logs } = mount({}, { ctx, platform: 'darwin' })
  ctx.emit('agent/status', { agent: { id: 'root' }, status: 'running' })
  ctx.emit('agent/status', { agent: { id: 'root' }, status: 'idle' })
  await sleep(15)
  assert.equal(flashes.length, 0)
  assert.ok(logs.some((line) => line.includes('unsupported platform')))
})
