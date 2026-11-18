import { html, nothing, type PropertyValues } from 'lit'
import { unsafeSVG } from 'lit/directives/unsafe-svg.js'
import { prefersDark, renderMermaid, svgToPng } from '@smartdevutils/browser/mermaid'
import { downloadBlob, downloadText } from '@smartdevutils/browser/file'
import { SduElement, defineElement, fileSlug, message } from './base'

export interface SduRenderedDetail {
  ok: boolean
  error?: string
}

/**
 * `<sdu-diagram source="graph TD; A-->B">` (or the source as text content).
 *
 * Draws Mermaid source as SVG. Mermaid is loaded on first use, in the browser only (see
 * `setMermaidLoader` in `@smartdevutils/browser/mermaid`), always with `securityLevel: 'strict'`.
 * The diagram follows the page theme: the `theme` attribute, the nearest `data-theme`, then the OS.
 *
 * @fires sdu-rendered - A render finished. detail: { ok, error? }
 * @csspart root - The outer box
 * @csspart diagram - The drawn SVG
 * @csspart toolbar - The download buttons
 * @csspart error - The error message
 */
export class SduDiagramElement extends SduElement {
  static override properties = {
    ...SduElement.properties,
    source: { type: String },
    label: { type: String },
    _svg: { state: true },
    _error: { state: true },
    _busy: { state: true },
    _status: { state: true },
    _dark: { state: true },
  }

  /** Mermaid source text. When empty, the element's text content is used. */
  declare source: string
  /** Accessible name of the diagram and the download file name. Defaults to "Diagram". */
  declare label: string
  declare _svg: string
  declare _error: string
  declare _busy: boolean
  declare _status: string
  declare _dark: boolean

  private _media: MediaQueryList | null = null
  private _observer: MutationObserver | null = null
  private _renderToken = 0
  private _done: Promise<SduRenderedDetail> = Promise.resolve({ ok: false })

  constructor() {
    super()
    this.source = ''
    this.label = ''
    this._svg = ''
    this._error = ''
    this._busy = false
    this._status = ''
    this._dark = false
  }

  /** The source that is drawn: the `source` property, or the text content. */
  get text(): string {
    return (this.source || this.textContent || '').trim()
  }

  /** Resolves when the current render finishes. */
  get rendered(): Promise<SduRenderedDetail> {
    return this._done
  }

  /** The drawn SVG markup, or null before a successful render. */
  toSvg(): string | null {
    return this._svg || null
  }

  /** The drawn diagram as a PNG (2x scale), on the theme's background colour. */
  async toPng(): Promise<Blob> {
    if (!this._svg) throw new Error('There is no diagram to export yet.')
    const root = this.renderRoot.querySelector('.sdu-root')
    const bg = root ? getComputedStyle(root).backgroundColor : ''
    return svgToPng(this._svg, { background: bg && bg !== 'rgba(0, 0, 0, 0)' ? bg : this._dark ? '#14161a' : '#ffffff' })
  }

  override connectedCallback(): void {
    super.connectedCallback()
    this._dark = this._computeDark()
    if (typeof matchMedia === 'function') {
      this._media = matchMedia('(prefers-color-scheme: dark)')
      this._media.addEventListener?.('change', this._syncTheme)
    }
    if (typeof MutationObserver === 'function') {
      this._observer = new MutationObserver(this._syncTheme)
      this._observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'], subtree: false })
      this._observer.observe(this, { attributes: true, attributeFilter: ['data-theme', 'data-sdu-scheme'], characterData: true, childList: true, subtree: true })
    }
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback()
    this._media?.removeEventListener?.('change', this._syncTheme)
    this._observer?.disconnect()
    this._observer = null
  }

  /** The element's own `theme` wins; otherwise the nearest ancestor's data-theme, then the OS. */
  private _computeDark(): boolean {
    if (this.theme === 'dark') return true
    if (this.theme === 'light') return false
    // A data-theme set on the element itself; the observer re-checks after `theme` removes ours.
    const own = this.getAttribute('data-theme') ?? this.getAttribute('data-sdu-scheme')
    if (own === 'dark' || own === 'light') return own === 'dark'
    const parent = this.parentNode ?? null
    return prefersDark(parent instanceof ShadowRoot ? parent.host : parent)
  }

  private _syncTheme = () => {
    const dark = this._computeDark()
    if (dark !== this._dark) this._dark = dark
    else if (!this.source) this.requestUpdate() // the text content may have changed
  }

  private _lastKey = ''

  protected override willUpdate(changed: PropertyValues<this>): void {
    super.willUpdate(changed)
    if (changed.has('theme')) this._dark = this._computeDark()
    const key = `${this._dark ? 'd' : 'l'}|${this.text}`
    if (key !== this._lastKey) {
      this._lastKey = key
      this._done = this._draw()
    }
  }

  private async _draw(): Promise<SduRenderedDetail> {
    const token = ++this._renderToken
    const text = this.text
    if (!text) {
      this._svg = ''
      this._error = ''
      return { ok: false, error: 'There is no diagram source.' }
    }
    this._busy = true
    const r = await renderMermaid(text, { dark: this._dark })
    if (token !== this._renderToken) return this._done
    this._busy = false
    const detail: SduRenderedDetail = r.ok ? { ok: true } : { ok: false, error: r.error }
    if (r.ok) {
      this._svg = r.svg
      this._error = ''
    } else {
      this._error = r.error
    }
    this.emit<SduRenderedDetail>('sdu-rendered', detail)
    return detail
  }

  private _downloadSvg = () => {
    if (!this._svg) return
    downloadText(this._svg, `${fileSlug(this.label || 'diagram')}.svg`, 'image/svg+xml')
    this._status = 'SVG download started.'
  }

  private _downloadPng = async () => {
    try {
      downloadBlob(await this.toPng(), `${fileSlug(this.label || 'diagram')}.png`)
      this._status = 'PNG download started.'
    } catch (err) {
      this._status = `PNG export failed: ${message(err)}`
    }
  }

  protected override render() {
    const name = this.label || 'Diagram'
    return html`<figure class="sdu-root sdu-stack" part="root" style="margin:0">
      <div
        class="sdu-diagram"
        part="diagram"
        role="img"
        aria-label=${name}
        aria-busy=${this._busy ? 'true' : 'false'}
      >
        ${this._svg ? unsafeSVG(this._svg) : this._busy ? html`<p class="sdu-status">Drawing the diagram…</p>` : nothing}
      </div>
      ${this._error ? html`<p class="sdu-error" role="alert" part="error">${this._error}</p>` : nothing}
      <div class="sdu-actions" part="toolbar">
        <button class="sdu-btn" part="button" ?disabled=${!this._svg} @click=${this._downloadSvg}>Download SVG</button>
        <button class="sdu-btn" part="button" ?disabled=${!this._svg} @click=${this._downloadPng}>Download PNG</button>
        <span class="sdu-status" role="status" aria-live="polite">${this._status}</span>
      </div>
      <details class="sdu-details">
        <summary>Diagram source</summary>
        <pre class="sdu-output">${this.text}</pre>
      </details>
      ${this.label ? html`<figcaption class="sdu-muted">${this.label}</figcaption>` : nothing}
    </figure>`
  }
}

defineElement('sdu-diagram', SduDiagramElement)

declare global {
  interface HTMLElementTagNameMap {
    'sdu-diagram': SduDiagramElement
  }
}
