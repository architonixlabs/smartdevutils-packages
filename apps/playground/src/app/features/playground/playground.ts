import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  inject,
  input,
  signal,
  untracked,
  viewChild,
  type OnInit,
} from '@angular/core'
import type { ApiItem, DocSection, PackageDoc, Snippet } from '../../core/model'
import { SandboxHost, type RunEvent, type RunHandle } from '../../core/sandbox-host'
import type { ConsoleLevel } from '../../core/sandbox-protocol'
import { ThemeService } from '../../core/theme.service'
import { copyText, downloadText } from '../../core/clipboard'
import { autosaveKey, clearAutosave, loadAutosave, safeStorage, saveAutosave } from '../../lib/autosave'
import { encodeShare, type SharePayload } from '../../lib/share-link'
import { downloadFileName, isRunnable, mimeType } from '../../lib/snippet-files'
import { buildStackBlitzProject, stackBlitzAction, stackBlitzFormFields } from '../../lib/stackblitz'
import { focusTab, tabKeyNav } from '../../shared/tabs'
import { CodeEditor } from './code-editor'

interface ConsoleLine {
  level: ConsoleLevel | 'system'
  text: string
  stack?: string
}

type RunStatus = 'idle' | 'running' | 'done' | 'error' | 'stopped'

const LANG_LABEL: Record<Snippet['lang'], string> = {
  ts: 'TypeScript',
  js: 'JavaScript',
  tsx: 'React (TSX)',
  html: 'HTML',
}

@Component({
  selector: 'pg-playground',
  imports: [CodeEditor],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (snippets().length > 1) {
      <div class="snippet-tabs" role="tablist" aria-label="Examples" (keydown)="onSnippetKey($event)">
        @for (s of snippets(); track s.id) {
          <button
            type="button"
            role="tab"
            class="tab"
            [id]="'snip-tab-' + s.id"
            [attr.aria-selected]="s.id === activeId()"
            [attr.aria-controls]="'snip-panel'"
            [tabindex]="s.id === activeId() ? 0 : -1"
            (click)="select(s.id)"
          >
            {{ s.title }}
          </button>
        }
      </div>
    }

    @let s = active();
    <div
      id="snip-panel"
      class="playground"
      [attr.role]="snippets().length > 1 ? 'tabpanel' : null"
      [attr.aria-labelledby]="snippets().length > 1 ? 'snip-tab-' + s.id : null"
    >
      @if (s.description) {
        <p class="snippet-desc">{{ s.description }}</p>
      }

      @if (sharedNote()) {
        <p class="note note-info" role="note">
          Shared code — press Run to try it. It was not run automatically.
        </p>
      }
      @if (restoredNote()) {
        <p class="note" role="note">Your earlier edits were restored from this browser. Reset brings back the original.</p>
      }
      @if (isDocsMode()) {
        <p class="note" role="note">
          This example is not run in the playground. Copy it or open it in StackBlitz to try it.
        </p>
      }

      <div class="toolbar" role="group" aria-label="Editor actions">
        <span class="lang-tag">{{ langLabel(s.lang) }}</span>
        @if (!isDocsMode()) {
          <button type="button" class="btn btn-primary" (click)="runCode()" title="Run (Ctrl+Enter or Cmd+Enter)">
            Run
          </button>
          <button type="button" class="btn" (click)="stop()" [disabled]="status() !== 'running' && !hasFrame()">Stop</button>
          <button type="button" class="btn" (click)="reset()" [disabled]="code() === original() && !sharedNote()">Reset</button>
          <button type="button" class="btn" (click)="share()">Share</button>
        }
        <button type="button" class="btn" (click)="copy()">{{ copied() ? 'Copied' : 'Copy' }}</button>
        <button type="button" class="btn" (click)="download()">Download</button>
        <button type="button" class="btn" (click)="openStackBlitz()">
          Open in StackBlitz <span class="sr-only">(opens a new tab)</span>
        </button>
      </div>

      @if (shareState(); as sh) {
        @if (sh.ok) {
          <div class="share-box">
            <label for="pg-share-url">{{ sh.copied ? 'Link copied. ' : '' }}Share link (the code is inside the link):</label>
            <input id="pg-share-url" class="share-url" type="text" readonly [value]="sh.url" (focus)="selectAll($event)" />
          </div>
        } @else {
          <p class="note note-error" role="alert">{{ sh.error }}</p>
        }
      }

      <div class="editor-wrap">
        <pg-code-editor
          [value]="code()"
          [lang]="s.lang"
          [readOnly]="isDocsMode()"
          [label]="editorLabel()"
          (valueChange)="onEdit($event)"
          (run)="runCode()"
        />
      </div>
      <p id="pg-editor-help" class="muted small editor-help">
        @if (isDocsMode()) {
          Read-only.
        } @else {
          Ctrl+Enter (Cmd+Enter) runs. Tab indents; press Escape, then Tab, to leave the editor. Ctrl+F searches.
        }
      </p>

      @if (!isDocsMode()) {
        <section class="output" aria-label="Output">
          <div class="output-head">
            <h3 class="sub-heading">{{ s.output === 'preview' ? 'Preview and console' : 'Console' }}</h3>
            <span class="run-status status-{{ status() }}" aria-live="polite">{{ summary() }}</span>
            @if (lines().length || result() !== null) {
              <button type="button" class="btn btn-sm" (click)="clearOutput()">Clear</button>
            }
          </div>

          @if (s.output === 'preview') {
            <div class="preview-wrap">
              @if (!hasFrame()) {
                <p class="preview-empty muted">Press Run to render the preview.</p>
              }
              <div class="preview-frame" #preview [style.height.px]="previewHeight()" [class.empty]="!hasFrame()"></div>
            </div>
          } @else {
            <div class="sandbox-offscreen" #hidden aria-hidden="true"></div>
          }

          <ol class="console" aria-label="Console output">
            @for (l of lines(); track $index) {
              <li class="console-line level-{{ l.level }}">
                <span class="console-level">{{ l.level === 'system' ? 'info' : l.level }}</span>
                @if (l.stack) {
                  <details class="console-details">
                    <summary><span class="console-text">{{ l.text }}</span></summary>
                    <pre class="console-stack">{{ l.stack }}</pre>
                  </details>
                } @else {
                  <pre class="console-text">{{ l.text }}</pre>
                }
              </li>
            }
            @if (result() !== null) {
              <li class="console-line level-result">
                <span class="console-level">result</span>
                <pre class="console-text">{{ result() }}</pre>
              </li>
            }
            @if (!lines().length && result() === null) {
              <li class="console-line console-empty muted">
                {{ emptyConsoleText() }}
              </li>
            }
          </ol>
        </section>
      }
    </div>
  `,
})
export class Playground implements OnInit {
  readonly pkg = input.required<PackageDoc>()
  readonly section = input.required<DocSection>()
  readonly item = input.required<ApiItem>()
  readonly version = input.required<string>()
  /** Validated payload from a `#code=` link for this entry; loaded into the editor, never auto-run. */
  readonly shared = input<SharePayload | null>(null)

  private readonly sandbox = inject(SandboxHost)
  private readonly theme = inject(ThemeService)
  private readonly storage = safeStorage()
  private readonly previewEl = viewChild<ElementRef<HTMLElement>>('preview')
  private readonly hiddenEl = viewChild<ElementRef<HTMLElement>>('hidden')

  private readonly sharedSnippet = signal<Snippet | null>(null)
  protected readonly snippets = computed(() => {
    const extra = this.sharedSnippet()
    return extra ? [...this.item().snippets, extra] : this.item().snippets
  })
  protected readonly activeId = signal('')
  protected readonly active = computed(
    () => this.snippets().find((s) => s.id === this.activeId()) ?? this.snippets()[0],
  )
  protected readonly original = computed(() => this.active().code)
  protected readonly code = signal('')
  protected readonly isDocsMode = computed(() => !isRunnable(this.active()))
  protected readonly editorLabel = computed(
    () => `${this.item().name} example: ${this.active().title} (${LANG_LABEL[this.active().lang]})${this.isDocsMode() ? ', read-only' : ''}`,
  )

  protected readonly sharedNote = signal(false)
  protected readonly restoredNote = signal(false)
  protected readonly copied = signal(false)
  protected readonly shareState = signal<
    { ok: true; url: string; copied: boolean } | { ok: false; error: string } | null
  >(null)

  protected readonly status = signal<RunStatus>('idle')
  protected readonly lines = signal<ConsoleLine[]>([])
  protected readonly result = signal<string | null>(null)
  protected readonly durationMs = signal<number | null>(null)
  protected readonly hasFrame = signal(false)
  protected readonly previewHeight = signal(240)
  private readonly failure = signal<string | null>(null)

  protected readonly summary = computed(() => {
    const st = this.status()
    const ms = this.durationMs()
    const n = this.lines().filter((l) => l.level !== 'system').length
    const logs = `${n} log ${n === 1 ? 'line' : 'lines'}`
    switch (st) {
      case 'idle':
        return ''
      case 'running':
        return 'Running…'
      case 'stopped':
        return 'Stopped'
      case 'done':
        return `Ran in ${fmtMs(ms)}, ${logs}${this.result() !== null ? ', 1 result' : ''}`
      case 'error':
        return `Failed${ms !== null ? ` after ${fmtMs(ms)}` : ''}: ${this.failure() ?? 'error'}`
    }
  })

  protected readonly emptyConsoleText = computed(() => {
    switch (this.status()) {
      case 'running':
        return 'Running…'
      case 'done':
        return 'The code ran without logging anything. Add console.log(…) or export a default value to see it here.'
      default:
        return 'Press Run (Ctrl+Enter) to see the output here.'
    }
  })

  private handle: RunHandle | null = null
  private runSeq = 0
  private startedAt = 0
  private saveTimer: ReturnType<typeof setTimeout> | undefined
  private copyTimer: ReturnType<typeof setTimeout> | undefined

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.flushSave()
      this.stop(true)
      clearTimeout(this.copyTimer)
    })
  }

  ngOnInit(): void {
    const sh = untracked(this.shared)
    if (sh) {
      let target = this.item().snippets.find((s) => s.id === sh.snippetId && s.lang === sh.lang)
      if (!target) {
        target = {
          id: sh.snippetId,
          title: 'Shared code',
          lang: sh.lang,
          code: sh.code,
          mode: 'run',
          output: sh.lang === 'html' || sh.lang === 'tsx' ? 'preview' : 'console',
          source: 'curated',
        }
        this.sharedSnippet.set(target)
      }
      this.activeId.set(target.id)
      this.code.set(sh.code)
      this.sharedNote.set(true)
      return
    }
    this.load(this.item().snippets[0]?.id ?? '')
  }

  protected langLabel(l: Snippet['lang']): string {
    return LANG_LABEL[l]
  }

  private key(s: Snippet): string {
    return autosaveKey(this.pkg().id, this.section().id, this.item().id, s.id)
  }

  private load(id: string): void {
    this.activeId.set(id)
    const s = this.active()
    if (!s) return
    const saved = loadAutosave(this.storage, this.key(s))
    this.code.set(saved?.code ?? s.code)
    this.restoredNote.set(!!saved && saved.code !== s.code)
  }

  protected select(id: string): void {
    if (id === this.activeId()) return
    this.flushSave()
    this.stop(true)
    this.clearOutput()
    this.status.set('idle')
    this.shareState.set(null)
    this.sharedNote.set(false)
    this.load(id)
  }

  protected onSnippetKey(e: KeyboardEvent): void {
    const next = tabKeyNav(
      e,
      this.snippets().map((s) => s.id),
      this.activeId(),
    )
    if (next) {
      this.select(next)
      focusTab('snip-tab-' + next)
    }
  }

  protected onEdit(code: string): void {
    this.code.set(code)
    this.shareState.set(null)
    clearTimeout(this.saveTimer)
    this.saveTimer = setTimeout(() => this.flushSave(), 400)
  }

  private flushSave(): void {
    if (this.saveTimer === undefined) return
    clearTimeout(this.saveTimer)
    this.saveTimer = undefined
    const s = this.active()
    if (s && isRunnable(s)) saveAutosave(this.storage, this.key(s), this.code(), s.code)
  }

  protected reset(): void {
    clearTimeout(this.saveTimer)
    this.saveTimer = undefined
    const s = this.active()
    clearAutosave(this.storage, this.key(s))
    this.code.set(s.code)
    this.restoredNote.set(false)
    this.shareState.set(null)
    if (this.sharedNote()) {
      this.sharedNote.set(false)
      // Drop #code=… so a reload shows the original example.
      try {
        history.replaceState(history.state, '', location.pathname + location.search)
      } catch {
        /* ignore */
      }
    }
  }

  // ---- running ----

  protected runCode(): void {
    const s = this.active()
    if (!s || !isRunnable(s)) return
    this.stop(true)
    this.clearOutput()
    this.failure.set(null)
    this.durationMs.set(null)
    this.status.set('running')
    const container = (s.output === 'preview' ? this.previewEl() : this.hiddenEl())?.nativeElement
    if (!container) {
      this.fail('The output area is not ready.')
      return
    }
    const seq = ++this.runSeq
    this.startedAt = performance.now()
    try {
      this.handle = this.sandbox.run(
        container,
        {
          lang: s.lang,
          source: this.code(),
          colorScheme: this.theme.scheme(),
          timeoutMs: 10_000,
        },
        (e) => {
          if (seq === this.runSeq) this.onEvent(e)
        },
      )
      this.hasFrame.set(s.output === 'preview')
      const frame = container.querySelector('iframe')
      if (frame && !frame.title) frame.title = `Preview of ${this.item().name}: ${s.title}`
    } catch (err) {
      this.handle = null
      const msg = err instanceof Error ? err.message : String(err)
      this.fail(/not implemented/i.test(msg) ? `The sandbox is not available yet (${msg}).` : msg)
    }
  }

  private onEvent(e: RunEvent): void {
    switch (e.type) {
      case 'console':
        this.lines.update((l) => [...l, { level: e.level, text: e.text }])
        break
      case 'result':
        this.result.set(e.text)
        break
      case 'error':
        this.lines.update((l) => [...l, { level: 'error', text: e.message, stack: e.stack }])
        this.failure.set(e.message)
        this.status.set('error')
        this.durationMs.set(performance.now() - this.startedAt)
        break
      case 'compile-error': {
        const where = e.line ? ` (line ${e.line}${e.column ? `, column ${e.column}` : ''})` : ''
        this.fail(`Compile error${where}: ${e.message}`)
        break
      }
      case 'timeout':
        this.lines.update((l) => [
          ...l,
          { level: 'warn', text: `Stopped: no result after ${fmtMs(e.ms)}. Infinite loop or a promise that never settles?` },
        ])
        this.failure.set(`timed out after ${fmtMs(e.ms)}`)
        this.durationMs.set(e.ms)
        this.status.set('error')
        this.handle?.stop()
        this.handle = null
        this.hasFrame.set(false)
        break
      case 'done':
        this.durationMs.set(e.ms)
        if (this.status() === 'running') this.status.set('done')
        break
      case 'resize':
        this.previewHeight.set(Math.max(120, Math.min(800, Math.ceil(e.height) + 2)))
        break
    }
  }

  private fail(message: string): void {
    this.lines.update((l) => [...l, { level: 'error', text: message }])
    this.failure.set(message)
    this.status.set('error')
  }

  stop(silent = false): void {
    const wasRunning = this.status() === 'running'
    this.runSeq++
    try {
      this.handle?.stop()
    } catch {
      /* already gone */
    }
    this.handle = null
    this.hasFrame.set(false)
    if (!silent && wasRunning) {
      this.lines.update((l) => [...l, { level: 'system', text: 'Stopped.' }])
      this.status.set('stopped')
    } else if (!silent) {
      this.status.set('idle')
    }
  }

  protected clearOutput(): void {
    this.lines.set([])
    this.result.set(null)
  }

  // ---- copy, download, share, StackBlitz ----

  protected async copy(): Promise<void> {
    const ok = await copyText(this.code())
    this.copied.set(ok)
    clearTimeout(this.copyTimer)
    this.copyTimer = setTimeout(() => this.copied.set(false), 2_000)
  }

  protected download(): void {
    const s = this.active()
    downloadText(downloadFileName(this.item().id, s.id, s.lang), this.code(), mimeType(s.lang))
  }

  protected async share(): Promise<void> {
    const s = this.active()
    const r = encodeShare({
      pkg: this.pkg().id,
      section: this.section().id,
      entry: this.item().id,
      snippetId: s.id,
      lang: s.lang,
      code: this.code(),
    })
    if (!r.ok) {
      this.shareState.set({ ok: false, error: r.error })
      return
    }
    const url = `${location.origin}${location.pathname}${location.search}#${r.hash}`
    try {
      history.replaceState(history.state, '', url)
    } catch {
      /* the link is still shown below */
    }
    const copied = await copyText(url)
    this.shareState.set({ ok: true, url, copied })
  }

  protected selectAll(e: Event): void {
    ;(e.target as HTMLInputElement).select()
  }

  protected openStackBlitz(): void {
    const s = this.active()
    const project = buildStackBlitzProject({
      pkg: this.pkg(),
      item: this.item(),
      lang: s.lang,
      code: this.code(),
      version: this.version(),
    })
    const form = document.createElement('form')
    form.method = 'POST'
    form.action = stackBlitzAction(project)
    form.target = '_blank'
    form.rel = 'noopener'
    form.style.display = 'none'
    for (const [name, value] of stackBlitzFormFields(project)) {
      const field = document.createElement('input')
      field.type = 'hidden'
      field.name = name
      field.value = value
      form.appendChild(field)
    }
    document.body.appendChild(form)
    form.submit()
    form.remove()
  }
}

function fmtMs(ms: number | null): string {
  if (ms === null || !Number.isFinite(ms)) return '—'
  return ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(2)} s`
}
