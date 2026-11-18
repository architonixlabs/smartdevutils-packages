import { html, nothing, type PropertyValues } from 'lit'
import { live } from 'lit/directives/live.js'
import type { ToolRunResult, ToolSpec } from '@smartdevutils/core/tools'
import { copyToClipboard } from '@smartdevutils/browser/clipboard'
import { downloadText } from '@smartdevutils/browser/file'
import { SduElement, defineElement, message } from './base'
import { renderOptionFields, tabKeydown } from './options-form'

type ToolsModule = typeof import('@smartdevutils/core/tools')

let toolsModule: Promise<ToolsModule> | null = null
/** The runner index is loaded on first use, so a page that only shows a diagram never fetches it. */
export function loadTools(): Promise<ToolsModule> {
  if (!toolsModule) {
    toolsModule = import('@smartdevutils/core/tools')
    toolsModule.catch(() => (toolsModule = null))
  }
  return toolsModule
}

export function looksLikeJson(text: string): boolean {
  const t = text.trimStart()
  if (!t.startsWith('{') && !t.startsWith('[')) return false
  try {
    JSON.parse(text)
    return true
  } catch {
    return false
  }
}

export interface SduOutputDetail {
  tool: string
  mode: string
  output: string
  error?: string
  meta?: Record<string, unknown>
}

export interface SduErrorDetail {
  tool: string
  mode: string
  error: string
}

/**
 * `<sdu-tool tool="base64-encoder-decoder" mode="decode" value="aGVsbG8=">`
 *
 * A form for any tool that has a runner in `@smartdevutils/core/tools`: mode tabs, the tool's settings,
 * an input, and the output with Copy and Download. Runs as you type unless `manual` is set.
 *
 * Events bubble and cross shadow roots.
 *
 * @fires sdu-ready - The tool's spec has loaded. detail: { tool, spec }
 * @fires sdu-output - A run finished. detail: { tool, mode, output, error?, meta? }
 * @fires sdu-error - A run reported an error. detail: { tool, mode, error }
 * @csspart root - The outer box
 * @csspart tabs - The mode tabs
 * @csspart options - The settings
 * @csspart input - The input text area
 * @csspart toolbar - The buttons
 * @csspart output - The output
 * @csspart error - The error message
 */
export class SduToolElement extends SduElement {
  static override properties = {
    ...SduElement.properties,
    tool: { type: String, reflect: true },
    mode: { type: String, reflect: true },
    value: { type: String },
    label: { type: String },
    manual: { type: Boolean },
    readonly: { type: Boolean },
    compact: { type: Boolean, reflect: true },
    options: { attribute: false },
    _spec: { state: true },
    _overrides: { state: true },
    _result: { state: true },
    _loadError: { state: true },
    _running: { state: true },
    _status: { state: true },
  }

  /** Tool id or website slug. */
  declare tool: string
  /** One of the tool's mode ids; defaults to its first mode. */
  declare mode: string
  /** The input text. */
  declare value: string
  /** Heading text; defaults to the tool name. */
  declare label: string
  /** Run only when the Run button is pressed (or `run()` is called). */
  declare manual: boolean
  /** The input cannot be edited. */
  declare readonly: boolean
  /** Hide the heading. */
  declare compact: boolean
  /** Settings keyed by the spec's option keys (property only). Changing it resets edits made in the form. */
  declare options: Record<string, unknown>

  declare _spec: ToolSpec | null
  declare _overrides: Record<string, unknown>
  declare _result: ToolRunResult | null
  declare _loadError: string
  declare _running: boolean
  declare _status: string

  private _token = 0
  private _timer: ReturnType<typeof setTimeout> | undefined
  private _resolveReady!: () => void
  /** Resolves once the tool's spec has loaded (or failed to load). */
  readonly ready: Promise<void> = new Promise((r) => (this._resolveReady = r))

  constructor() {
    super()
    this.tool = ''
    this.mode = ''
    this.value = ''
    this.label = ''
    this.manual = false
    this.readonly = false
    this.compact = false
    this.options = {}
    this._spec = null
    this._overrides = {}
    this._result = null
    this._loadError = ''
    this._running = false
    this._status = ''
  }

  /** Alias of `value`. */
  get input(): string {
    return this.value
  }
  set input(v: string) {
    this.value = v
  }

  /** The settings the next run uses: spec defaults, then `options`, then edits made in the form. */
  get effectiveOptions(): Record<string, unknown> {
    const defaults: Record<string, unknown> = {}
    for (const o of this._spec?.options ?? []) if (o.default !== undefined) defaults[o.key] = o.default
    return { ...defaults, ...this.options, ...this._overrides }
  }

  /** The output of the last run. */
  get output(): string {
    return this._result?.output ?? ''
  }

  /** Sets the input (and optionally mode and settings), then runs. */
  setInput(text: string, opts: { mode?: string; options?: Record<string, unknown> } = {}): Promise<ToolRunResult> {
    this.value = text
    if (opts.mode) this.mode = opts.mode
    if (opts.options) this.options = { ...opts.options }
    return this.run()
  }

  /** Runs the tool now with the current input, mode and settings. */
  async run(): Promise<ToolRunResult> {
    clearTimeout(this._timer)
    if (!this.tool) return { output: '', error: 'Set the tool attribute to a tool id.' }
    await this.ready
    const spec = this._spec
    if (!spec) return { output: '', error: this._loadError || 'The tool has not loaded.' }
    const token = ++this._token
    const mode = this.mode || spec.defaultMode || ''
    this._running = true
    let res: ToolRunResult
    try {
      const tools = await loadTools()
      const runner = await tools.loadRunner(spec.id)
      res = await runner.run(this.value, { mode, options: this.effectiveOptions })
    } catch (err) {
      res = { output: '', error: message(err) }
    }
    if (token !== this._token) return res
    this._running = false
    this._result = res
    this._status = res.error ? 'The tool reported an error.' : res.output ? 'Done.' : ''
    this.emit<SduOutputDetail>('sdu-output', { tool: spec.id, mode, ...res })
    if (res.error) this.emit<SduErrorDetail>('sdu-error', { tool: spec.id, mode, error: res.error })
    return res
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('tool')) void this._loadSpec()
    if (changed.has('options')) this._overrides = {}
  }

  protected override updated(changed: PropertyValues<this>): void {
    super.updated(changed)
    if (!this._spec || this.manual) return
    const keys: PropertyKey[] = ['value', 'mode', 'options', '_overrides', '_spec']
    if (keys.some((k) => (changed as Map<PropertyKey, unknown>).has(k))) this._schedule()
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback()
    clearTimeout(this._timer)
  }

  private _schedule(): void {
    clearTimeout(this._timer)
    const spec = this._spec
    if (!spec) return
    if (!this.value.trim() && spec.input.kind !== 'none') {
      this._result = null
      this._status = ''
      return
    }
    this._timer = setTimeout(() => void this.run(), 200)
  }

  private async _loadSpec(): Promise<void> {
    const id = this.tool
    this._spec = null
    this._loadError = ''
    this._result = null
    if (!id) return
    try {
      const tools = await loadTools()
      if (id !== this.tool) return
      const spec = tools.getToolSpec(id)
      if (!spec) {
        this._loadError = `"${id}" has no runner in this version of @smartdevutils/core. Runnable tools: ${tools.RUNNABLE_TOOL_IDS.join(', ')}.`
      } else {
        if (!this.mode || (spec.modes.length && !spec.modes.some((m) => m.id === this.mode))) {
          this.mode = spec.defaultMode ?? spec.modes[0]?.id ?? ''
        }
        this._spec = spec
        this.emit('sdu-ready', { tool: spec.id, spec })
      }
    } catch (err) {
      this._loadError = `The tool could not be loaded: ${message(err)}`
    }
    this._resolveReady()
  }

  private _copy = async () => {
    try {
      await copyToClipboard(this.output)
      this._status = 'Output copied.'
    } catch {
      this._status = 'Copy failed. Select the output and copy it by hand.'
    }
  }

  private _download = () => {
    const spec = this._spec
    if (!spec) return
    const json = looksLikeJson(this.output)
    downloadText(
      this.output,
      `${spec.id}${this.mode ? '-' + this.mode : ''}.${json ? 'json' : 'txt'}`,
      json ? 'application/json' : 'text/plain',
    )
    this._status = 'Download started.'
  }

  private _setOption = (key: string, value: unknown) => {
    this._overrides = { ...this._overrides, [key]: value }
  }

  protected override render() {
    if (this._loadError) {
      return html`<section class="sdu-root" part="root">
        <p class="sdu-error" role="alert" part="error">${this._loadError}</p>
      </section>`
    }
    const spec = this._spec
    if (!spec) {
      return html`<section class="sdu-root" part="root" aria-busy="true"><p class="sdu-status">Loading the tool…</p></section>`
    }
    const mode = this.mode || spec.defaultMode || ''
    const m = spec.modes.find((x) => x.id === mode)
    const inputLabel = m?.inputLabel ?? spec.input.label ?? 'Input'
    const outputLabel = m?.outputLabel ?? (spec.output === 'report' ? 'Report' : 'Output')
    const options = spec.options.filter((o) => !o.modes || o.modes.includes(mode))
    const res = this._result
    const ids = spec.modes.map((x) => x.id)
    const title = this.label || spec.name

    return html`<section class="sdu-root sdu-stack" part="root" aria-label=${title}>
      ${this.compact ? nothing : html`<header class="sdu-header"><h2 class="sdu-title">${title}</h2></header>`}
      ${spec.modes.length > 1
        ? html`<div
            class="sdu-tabs"
            role="tablist"
            aria-label="Mode"
            part="tabs"
            @keydown=${(e: KeyboardEvent) => tabKeydown(e, ids, mode, (id) => (this.mode = id))}
          >
            ${spec.modes.map(
              (x) => html`<button
                class="sdu-tab"
                role="tab"
                id="tab-${x.id}"
                data-mode=${x.id}
                aria-selected=${x.id === mode ? 'true' : 'false'}
                aria-controls="panel"
                tabindex=${x.id === mode ? 0 : -1}
                @click=${() => (this.mode = x.id)}
              >
                ${x.label}
              </button>`,
            )}
          </div>`
        : nothing}
      <div
        class="sdu-stack"
        id="panel"
        role=${spec.modes.length > 1 ? 'tabpanel' : nothing}
        aria-labelledby=${spec.modes.length > 1 ? `tab-${mode}` : nothing}
      >
        ${renderOptionFields(options, this.effectiveOptions, this._setOption, 'opt')}
        <div class="sdu-field">
          <label class="sdu-label" for="input">${inputLabel}</label>
          <textarea
            id="input"
            class="sdu-textarea"
            part="input"
            spellcheck="false"
            autocomplete="off"
            ?readonly=${this.readonly}
            .value=${live(this.value)}
            @input=${(e: Event) => (this.value = (e.target as HTMLTextAreaElement).value)}
          ></textarea>
        </div>
        <div class="sdu-actions" part="toolbar">
          <button class="sdu-btn sdu-btn-primary" part="button run" ?disabled=${this._running} @click=${() => this.run()}>
            ${this._running ? 'Running…' : 'Run'}
          </button>
          <button class="sdu-btn" part="button copy" ?disabled=${!this.output} @click=${this._copy}>Copy</button>
          <button class="sdu-btn" part="button download" ?disabled=${!this.output} @click=${this._download}>
            Download
          </button>
          <span class="sdu-status" role="status" aria-live="polite">${this._status}</span>
        </div>
        ${res?.error ? html`<p class="sdu-error" role="alert" part="error">${res.error}</p>` : nothing}
        <div class="sdu-field">
          <span class="sdu-label" id="output-label">${outputLabel}</span>
          <pre
            class="sdu-output"
            part="output"
            data-role="output"
            role="region"
            tabindex="0"
            aria-labelledby="output-label"
            data-empty="No output yet."
          >${res?.output ?? ''}</pre>
        </div>
        ${res?.meta && spec.output === 'report'
          ? html`<details class="sdu-details">
              <summary>Findings as JSON</summary>
              <pre class="sdu-output">${JSON.stringify(res.meta, null, 2)}</pre>
            </details>`
          : nothing}
      </div>
    </section>`
  }
}

defineElement('sdu-tool', SduToolElement)

declare global {
  interface HTMLElementTagNameMap {
    'sdu-tool': SduToolElement
  }
}
