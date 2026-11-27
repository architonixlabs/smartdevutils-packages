import { describe, expect, it, vi } from 'vitest'
import type { RunEvent } from './sandbox-host'
import type { RunMessage } from './sandbox-protocol'
import { RunSession, type SessionTimers } from './sandbox-session'

const msg: RunMessage = { type: 'run', runId: 'run-1', code: 'console.log(1)', theme: false, colorScheme: 'light' }

function setup(timeoutMs = 1000) {
  let pending: (() => void) | undefined
  const timers: SessionTimers = {
    set: vi.fn((fn: () => void) => {
      pending = fn
      return 1
    }),
    clear: vi.fn(() => {
      pending = undefined
    }),
  }
  const events: RunEvent[] = []
  const post = vi.fn()
  const teardown = vi.fn()
  const session = new RunSession(msg, (e) => events.push(e), post, teardown, timers, timeoutMs)
  const frame = { name: 'frame' }
  return { session, events, post, teardown, timers, frame, fire: () => pending?.() }
}

describe('RunSession', () => {
  it('posts the run once the sandbox says ready, then forwards its events', () => {
    const { session, events, post, frame } = setup()
    session.start()
    expect(session.receive(frame, frame, { type: 'ready' })).toBe(true)
    expect(post).toHaveBeenCalledWith(msg)
    session.receive(frame, frame, { type: 'console', runId: 'run-1', level: 'log', text: '1' })
    session.receive(frame, frame, { type: 'resize', height: 40 })
    expect(events).toEqual([
      { type: 'console', runId: 'run-1', level: 'log', text: '1' },
      { type: 'resize', height: 40 },
    ])
  })

  it('ignores messages from other windows, bad shapes, other runs and early events', () => {
    const { session, events, post, frame } = setup()
    session.start()
    expect(session.receive({}, frame, { type: 'ready' })).toBe(false)
    expect(session.receive(frame, null, { type: 'ready' })).toBe(false)
    expect(session.receive(frame, frame, { type: 'console', runId: 'run-1', level: 'log', text: 'early' })).toBe(false)
    expect(post).not.toHaveBeenCalled()
    session.receive(frame, frame, { type: 'ready' })
    expect(session.receive(frame, frame, { type: 'ready' })).toBe(false)
    expect(post).toHaveBeenCalledTimes(1)
    expect(session.receive(frame, frame, { type: 'console', runId: 'other', level: 'log', text: 'x' })).toBe(false)
    expect(session.receive(frame, frame, { type: 'console', runId: 'run-1', level: 'shout', text: 'x' })).toBe(false)
    expect(session.receive(frame, frame, { type: 'eval', code: 'x' })).toBe(false)
    expect(session.receive(frame, frame, 'ready')).toBe(false)
    expect(events).toEqual([])
  })

  it('times out when there is no done, emits timeout and tears down', () => {
    const { session, events, teardown, fire, frame } = setup(500)
    session.start()
    session.receive(frame, frame, { type: 'ready' })
    fire()
    expect(events).toEqual([{ type: 'timeout', runId: 'run-1', ms: 500 }])
    expect(teardown).toHaveBeenCalledTimes(1)
    expect(session.current).toBe('stopped')
    expect(session.receive(frame, frame, { type: 'done', runId: 'run-1', ms: 1 })).toBe(false)
  })

  it('also times out a sandbox that never becomes ready', () => {
    const { session, events, fire } = setup(300)
    session.start()
    fire()
    expect(events).toEqual([{ type: 'timeout', runId: 'run-1', ms: 300 }])
  })

  it('clears the timeout on done but keeps forwarding late output', () => {
    const { session, events, timers, frame, teardown } = setup()
    session.start()
    session.receive(frame, frame, { type: 'ready' })
    session.receive(frame, frame, { type: 'done', runId: 'run-1', ms: 12 })
    expect(timers.clear).toHaveBeenCalledTimes(1)
    expect(session.current).toBe('done')
    session.receive(frame, frame, { type: 'console', runId: 'run-1', level: 'info', text: 'later' })
    expect(events.map((e) => e.type)).toEqual(['done', 'console'])
    expect(teardown).not.toHaveBeenCalled()
  })

  it('stop() tears down once and silences the session', () => {
    const { session, teardown, frame, events } = setup()
    session.start()
    session.stop()
    session.stop()
    expect(teardown).toHaveBeenCalledTimes(1)
    expect(session.receive(frame, frame, { type: 'ready' })).toBe(false)
    expect(events).toEqual([])
  })
})
