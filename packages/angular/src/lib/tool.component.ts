import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  PLATFORM_ID,
  PendingTasks,
  booleanAttribute,
  computed,
  effect,
  inject,
  input,
  model,
  output,
  signal,
  untracked,
} from '@angular/core'
import { isPlatformBrowser } from '@angular/common'
import { RUNNABLE_TOOL_IDS, getToolSpec, loadRunner, type ToolRunResult } from '@smartdevutils/core/tools'
import { copyToClipboard } from '@smartdevutils/browser/clipboard'
import { downloadText } from '@smartdevutils/browser/file'
import { SduOptionFieldsComponent, type SduOptionChange } from './option-fields.component'
import { SduStylesComponent } from './styles.component'
import { errorText, looksLikeJson, nextId, themeAttr, type SduTheme } from './util'

export interface SduToolResult extends ToolRunResult {
  tool: string
  mode: string
}

/**
 * `<sdu-tool tool="base64-encoder-decoder" [(mode)]="mode" [(value)]="text" (result)="onResult($event)" />`
 *
 * A form for any tool with a runner in @smartdevutils/core/tools: mode tabs, the tool's settings,
 * the input, and the output with Copy and Download. Runs as you type unless `manual` is set.
 * During server rendering the tool runs on the server, so the HTML already holds the output.
 */
@Component({
  selector: 'sdu-tool',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SduStylesComponent, SduOptionFieldsComponent],
  host: { '[attr.data-theme]': 'dataTheme()', style: 'display:block' },
  template: `
    <sdu-styles />
    @if (spec(); as s) {
      <section class="sdu-root sdu-stack" [attr.aria-label]="title()">
        @if (!compact()) {
          <header class="sdu-header"><h2 class="sdu-title">{{ title() }}</h2></header>
        }
        @if (s.modes.length > 1) {
          <div class="sdu-tabs" role="tablist" aria-label="Mode" (keydown)="onTabKey($event)">
            @for (m of s.modes; track m.id) {
              <button
                type="button"
                class="sdu-tab"
                role="tab"
                [id]="uid + '-tab-' + m.id"
                [attr.data-mode]="m.id"
                [attr.aria-selected]="m.id === activeMode()"
                [attr.aria-controls]="uid + '-panel'"
                [tabIndex]="m.id === activeMode() ? 0 : -1"
                (click)="setMode(m.id)"
              >
                {{ m.label }}
              </button>
            }
          </div>
        }
        <div
          class="sdu-stack"
          [id]="uid + '-panel'"
          [attr.role]="s.modes.length > 1 ? 'tabpanel' : null"
          [attr.aria-labelledby]="s.modes.length > 1 ? uid + '-tab-' + activeMode() : null"
        >
          <sdu-option-fields [options]="visibleOptions()" [values]="effectiveOptions()" [idPrefix]="uid + '-opt'" (optionChange)="setOption($event)" />
          <div class="sdu-field">
            <label class="sdu-label" [for]="uid + '-input'">{{ labels().input }}</label>
            <textarea
              [id]="uid + '-input'"
              class="sdu-textarea"
              spellcheck="false"
              autocomplete="off"
              [readOnly]="readonly()"
              [value]="value()"
              (input)="value.set($any($event.target).value)"
            ></textarea>
          </div>
          <div class="sdu-actions">
            <button type="button" class="sdu-btn sdu-btn-primary" [disabled]="running()" (click)="run()">
              {{ running() ? 'Running…' : 'Run' }}
            </button>
            <button type="button" class="sdu-btn" [disabled]="!output()" (click)="copy()">Copy</button>
            <button type="button" class="sdu-btn" [disabled]="!output()" (click)="download()">Download</button>
            <span class="sdu-status" role="status" aria-live="polite">{{ status() }}</span>
          </div>
          @if (lastResult()?.error; as err) {
            <p class="sdu-error" role="alert">{{ err }}</p>
          }
          <div class="sdu-field">
            <span class="sdu-label" [id]="uid + '-output-label'">{{ labels().output }}</span>
            <pre
              class="sdu-output"
              role="region"
              tabindex="0"
              data-role="output"
              data-empty="No output yet."
              [attr.aria-labelledby]="uid + '-output-label'"
            >{{ output() }}</pre>
          </div>
          @if (s.output === 'report' && lastResult()?.meta; as meta) {
            <details class="sdu-details">
              <summary>Findings as JSON</summary>
              <pre class="sdu-output">{{ json(meta) }}</pre>
            </details>
          }
        </div>
      </section>
    } @else {
      <section class="sdu-root">
        <p class="sdu-error" role="alert">
          "{{ tool() }}" has no runner in this version of &#64;smartdevutils/core. Runnable tools: {{ runnable }}.
        </p>
      </section>
    }
  `,
})
export class SduToolComponent {
  /** Tool id or website slug. */
  readonly tool = input.required<string>()
  /** One of the tool's mode ids; defaults to its first mode. Two-way: [(mode)]. */
  readonly mode = model('')
  /** The input text. Two-way: [(value)]. */
  readonly value = model('')
  /** Settings keyed by the spec's option keys. Changing it resets edits made in the form. */
  readonly options = input<Record<string, unknown>>({})
  /** Run only on the Run button (or `run()`). */
  readonly manual = input(false, { transform: booleanAttribute })
  readonly readonly = input(false, { transform: booleanAttribute })
  /** Hide the heading. */
  readonly compact = input(false, { transform: booleanAttribute })
  readonly label = input('')
  readonly theme = input<SduTheme>('auto')
  /** Every finished run. */
  readonly result = output<SduToolResult>()
  /** Runs that reported an error. */
  readonly error = output<SduToolResult & { error: string }>()

  protected readonly uid = nextId('sdu-tool')
  protected readonly runnable = RUNNABLE_TOOL_IDS.join(', ')
  protected readonly spec = computed(() => getToolSpec(this.tool()))
  protected readonly activeMode = computed(() => {
    const s = this.spec()
    if (!s) return ''
    const ids = s.modes.map((m) => m.id)
    return ids.includes(this.mode()) ? this.mode() : (s.defaultMode ?? ids[0] ?? '')
  })
  private readonly overrides = signal<Record<string, unknown>>({})
  protected readonly effectiveOptions = computed(() => {
    const d: Record<string, unknown> = {}
    for (const o of this.spec()?.options ?? []) if (o.default !== undefined) d[o.key] = o.default
    return { ...d, ...this.options(), ...this.overrides() }
  })
  protected readonly visibleOptions = computed(() => {
    const s = this.spec()
    const m = this.activeMode()
    return s ? s.options.filter((o) => !o.modes || o.modes.includes(m)) : []
  })
  protected readonly labels = computed(() => {
    const s = this.spec()
    const m = s?.modes.find((x) => x.id === this.activeMode())
    return {
      input: m?.inputLabel ?? s?.input.label ?? 'Input',
      output: m?.outputLabel ?? (s?.output === 'report' ? 'Report' : 'Output'),
    }
  })
  protected readonly title = computed(() => this.label() || this.spec()?.name || 'Tool')
  protected readonly dataTheme = computed(() => themeAttr(this.theme()))
  protected readonly lastResult = signal<ToolRunResult | null>(null)
  protected readonly running = signal(false)
  protected readonly status = signal('')
  /** The output of the last run. */
  readonly output = computed(() => this.lastResult()?.output ?? '')

  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID))
  private readonly tasks = inject(PendingTasks)
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef)
  private token = 0

  constructor() {
    // A new `options` object resets edits made in the form.
    effect(() => {
      this.options()
      untracked(() => this.overrides.set({}))
    })
    // Run as you type (debounced in the browser; at once on the server, so SSR shows the output).
    effect((onCleanup) => {
      const spec = this.spec()
      const value = this.value()
      this.activeMode()
      this.effectiveOptions()
      if (this.manual() || !spec) return
      if (!value.trim() && spec.input.kind !== 'none') {
        untracked(() => this.lastResult.set(null))
        return
      }
      const done = this.tasks.add()
      const timer = setTimeout(() => void this.run().finally(done), this.browser ? 200 : 0)
      onCleanup(() => {
        clearTimeout(timer)
        done()
      })
    })
    inject(DestroyRef).onDestroy(() => (this.token = -1))
  }

  setMode(id: string): void {
    this.mode.set(id)
  }

  setOption(change: SduOptionChange): void {
    this.overrides.update((o) => ({ ...o, [change.key]: change.value }))
  }

  /** Runs the tool now with the current input, mode and settings. */
  async run(): Promise<SduToolResult | null> {
    const spec = untracked(this.spec)
    if (!spec) return null
    const t = ++this.token
    const mode = untracked(this.activeMode)
    this.running.set(true)
    let res: ToolRunResult
    try {
      res = await (await loadRunner(spec.id)).run(untracked(this.value), { mode, options: untracked(this.effectiveOptions) })
    } catch (err) {
      res = { output: '', error: errorText(err) }
    }
    if (t !== this.token) return null
    this.running.set(false)
    this.lastResult.set(res)
    this.status.set(res.error ? 'The tool reported an error.' : res.output ? 'Done.' : '')
    const detail: SduToolResult = { tool: spec.id, mode, ...res }
    this.result.emit(detail)
    if (res.error) this.error.emit({ ...detail, error: res.error })
    return detail
  }

  protected onTabKey(e: KeyboardEvent): void {
    const ids = this.spec()?.modes.map((m) => m.id) ?? []
    const i = ids.indexOf(this.activeMode())
    const map: Record<string, number> = {
      ArrowRight: (i + 1) % ids.length,
      ArrowDown: (i + 1) % ids.length,
      ArrowLeft: (i - 1 + ids.length) % ids.length,
      ArrowUp: (i - 1 + ids.length) % ids.length,
      Home: 0,
      End: ids.length - 1,
    }
    const next = map[e.key]
    if (next === undefined) return
    e.preventDefault()
    this.setMode(ids[next]!)
    this.host.nativeElement.querySelector<HTMLElement>(`[data-mode="${ids[next]}"]`)?.focus()
  }

  protected async copy(): Promise<void> {
    try {
      await copyToClipboard(this.output())
      this.status.set('Output copied.')
    } catch {
      this.status.set('Copy failed. Select the output and copy it by hand.')
    }
  }

  protected download(): void {
    const spec = this.spec()
    if (!spec) return
    const json = looksLikeJson(this.output())
    const mode = this.activeMode()
    downloadText(this.output(), `${spec.id}${mode ? '-' + mode : ''}.${json ? 'json' : 'txt'}`, json ? 'application/json' : 'text/plain')
    this.status.set('Download started.')
  }

  protected json(v: unknown): string {
    return JSON.stringify(v, null, 2)
  }
}
