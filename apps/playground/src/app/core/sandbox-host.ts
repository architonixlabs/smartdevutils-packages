// Parent side of the sandbox: creates the sandboxed iframe, sends one compiled run, and reports the
// sandbox's messages. Message filtering and the timeout live in RunSession (sandbox-session.ts).
import { Injectable } from '@angular/core'
import { CompileError, compileSnippet } from './compile'
import type { SnippetLang } from './model'
import { MAX_CODE_LENGTH, type RunMessage, type SandboxToParent } from './sandbox-protocol'
import { DEFAULT_TIMEOUT_MS, RunSession } from './sandbox-session'

export interface RunRequest {
  lang: SnippetLang
  /** Source as the visitor wrote it (TS/TSX/JS/HTML); compiled before it is sent. */
  source: string
  /** Load the @smartdevutils/theme stylesheet into the preview (default true for html/tsx). */
  theme?: boolean
  colorScheme: 'light' | 'dark'
  /** Stop the run after this many ms without a `done` (default 10 000). */
  timeoutMs?: number
}

/** Everything the sandbox can report, plus compile errors and timeouts raised on the parent side. */
export type RunEvent =
  | Exclude<SandboxToParent, { type: 'ready' }>
  | { type: 'compile-error'; runId: string; message: string; line?: number; column?: number }
  | { type: 'timeout'; runId: string; ms: number }

export interface RunHandle {
  runId: string
  /** Removes the iframe; later messages from it are ignored. */
  stop(): void
}

/** The sandbox page, relative to the app's base href (/playground/). */
export const SANDBOX_URL = 'sandbox.html'

@Injectable({ providedIn: 'root' })
export class SandboxHost {
  private readonly active = new WeakMap<HTMLElement, RunHandle>()

  /**
   * Compiles `req.source`, replaces any iframe in `container` with a fresh sandboxed one, runs the code
   * and calls `onEvent` for each message of this run (and only this run).
   */
  run(container: HTMLElement, req: RunRequest, onEvent: (e: RunEvent) => void): RunHandle {
    this.active.get(container)?.stop()
    const runId = crypto.randomUUID()
    let session: RunSession | undefined
    let stopped = false
    const handle: RunHandle = {
      runId,
      stop: () => {
        stopped = true
        session?.stop()
        if (this.active.get(container) === handle) this.active.delete(container)
      },
    }
    this.active.set(container, handle)

    void compileSnippet(req.lang, req.source).then(
      (compiled) => {
        if (stopped) return
        if (compiled.code.length > MAX_CODE_LENGTH || (compiled.html ?? '').length > MAX_CODE_LENGTH) {
          onEvent({ type: 'compile-error', runId, message: `The code is longer than ${MAX_CODE_LENGTH.toLocaleString('en-US')} characters.` })
          return
        }
        const defaultTheme = req.lang === 'html' || req.lang === 'tsx'
        const message: RunMessage = {
          type: 'run',
          runId,
          code: compiled.code,
          theme: req.theme ?? defaultTheme,
          colorScheme: req.colorScheme,
          ...(compiled.html === undefined ? {} : { html: compiled.html }),
        }
        session = this.start(container, message, req.timeoutMs ?? DEFAULT_TIMEOUT_MS, onEvent)
      },
      (err: unknown) => {
        if (stopped) return
        const ce = err instanceof CompileError ? err : new CompileError(String((err as Error)?.message ?? 'The code could not be compiled.'))
        onEvent({
          type: 'compile-error',
          runId,
          message: ce.message,
          ...(ce.line === undefined ? {} : { line: ce.line }),
          ...(ce.column === undefined ? {} : { column: ce.column }),
        })
      },
    )
    return handle
  }

  private start(container: HTMLElement, message: RunMessage, timeoutMs: number, onEvent: (e: RunEvent) => void): RunSession {
    for (const old of Array.from(container.querySelectorAll('iframe[data-sdu-sandbox]'))) old.remove()
    const doc = container.ownerDocument
    const win = doc.defaultView ?? window
    const iframe = doc.createElement('iframe')
    iframe.setAttribute('sandbox', 'allow-scripts')
    iframe.setAttribute('referrerpolicy', 'no-referrer')
    iframe.setAttribute('allow', '')
    iframe.setAttribute('title', 'Code preview')
    iframe.dataset['sduSandbox'] = ''
    iframe.src = new URL(SANDBOX_URL, doc.baseURI).href

    const listener = (event: MessageEvent): void => {
      // The sandbox has an opaque origin ("null"); the real check is the source window in receive().
      if (event.origin !== 'null') return
      session.receive(event.source, iframe.contentWindow, event.data)
    }
    const session = new RunSession(
      message,
      onEvent,
      // Opaque-origin frame: no origin to target. The message is only code the visitor wrote.
      (m) => iframe.contentWindow?.postMessage(m, '*'), // NOSONAR
      () => {
        win.removeEventListener('message', listener)
        iframe.remove()
      },
      { set: (fn, ms) => win.setTimeout(fn, ms), clear: (h) => win.clearTimeout(h as number) },
      timeoutMs,
    )
    win.addEventListener('message', listener)
    session.start()
    container.appendChild(iframe)
    return session
  }
}
