// Parent-side bookkeeping for one sandbox run: which messages belong to it, when it is ready, and when
// it times out. Pure (timers injected) so it is tested without a browser; SandboxHost wires it to the DOM.
import { isSandboxToParent, type RunMessage } from './sandbox-protocol'
import type { RunEvent } from './sandbox-host'

export const DEFAULT_TIMEOUT_MS = 10_000

export interface SessionTimers {
  set(fn: () => void, ms: number): unknown
  clear(handle: unknown): void
}

export type SessionState = 'waiting' | 'running' | 'done' | 'stopped'

export class RunSession {
  private state: SessionState = 'waiting'
  private timer: unknown

  constructor(
    readonly message: RunMessage,
    private readonly emit: (e: RunEvent) => void,
    /** Posts the run message into the sandbox (once, after `ready`). */
    private readonly post: (m: RunMessage) => void,
    /** Removes the iframe and listeners; called once on timeout or stop. */
    private readonly teardown: () => void,
    private readonly timers: SessionTimers,
    readonly timeoutMs = DEFAULT_TIMEOUT_MS,
  ) {}

  get current(): SessionState {
    return this.state
  }

  /** Arms the timeout. It covers loading the sandbox too, so a sandbox that never says `ready` also ends. */
  start(): void {
    if (this.state !== 'waiting' || this.timer !== undefined) return
    this.timer = this.timers.set(() => this.onTimeout(), this.timeoutMs)
  }

  /**
   * Handles one `message` event. `source` is event.source and `frame` the run's iframe window: anything
   * from another window, of the wrong shape, or for another run is ignored. Returns whether it was used.
   */
  receive(source: unknown, frame: unknown, data: unknown): boolean {
    if (this.state === 'stopped' || !frame || source !== frame || !isSandboxToParent(data)) return false
    if (data.type === 'ready') {
      if (this.state !== 'waiting') return false
      this.state = 'running'
      this.post(this.message)
      return true
    }
    if (this.state === 'waiting') return false
    if (data.type !== 'resize' && data.runId !== this.message.runId) return false
    if (data.type === 'done') {
      this.state = 'done'
      this.clearTimer()
    }
    this.emit(data)
    return true
  }

  stop(): void {
    if (this.state === 'stopped') return
    this.state = 'stopped'
    this.clearTimer()
    this.teardown()
  }

  private onTimeout(): void {
    this.timer = undefined
    if (this.state !== 'waiting' && this.state !== 'running') return
    this.emit({ type: 'timeout', runId: this.message.runId, ms: this.timeoutMs })
    this.stop()
  }

  private clearTimer(): void {
    if (this.timer !== undefined) this.timers.clear(this.timer)
    this.timer = undefined
  }
}
