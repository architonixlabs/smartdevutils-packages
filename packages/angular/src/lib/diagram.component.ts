import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  PLATFORM_ID,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core'
import { isPlatformBrowser } from '@angular/common'
import { DomSanitizer, type SafeHtml } from '@angular/platform-browser'
import { prefersDark, renderMermaid, setMermaidLoader, setMermaidUrl, svgToPng } from '@smartdevutils/browser/mermaid'
import { downloadBlob, downloadText } from '@smartdevutils/browser/file'
import { SMART_DEV_UTILS_CONFIG } from './config'
import { SduStylesComponent } from './styles.component'
import { errorText, fileSlug, themeAttr, type SduTheme } from './util'

export interface SduRenderedEvent {
  ok: boolean
  error?: string
}

let configured = false

/**
 * `<sdu-diagram [source]="mermaidText" label="Deploy flow" />`
 *
 * Draws Mermaid source as SVG in the browser only: during server rendering it renders the frame and
 * the source, and the drawing happens after hydration. Mermaid is loaded on first use (configure it
 * with provideSmartDevUtils), always with `securityLevel: 'strict'`. The diagram follows the theme:
 * the `theme` input, the nearest data-theme, then the OS setting.
 */
@Component({
  selector: 'sdu-diagram',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SduStylesComponent],
  host: { '[attr.data-theme]': 'dataTheme()', style: 'display:block' },
  template: `
    <sdu-styles />
    <figure class="sdu-root sdu-stack" style="margin:0">
      <div class="sdu-diagram" role="img" [attr.aria-label]="name()" [attr.aria-busy]="busy()" [innerHTML]="safeSvg()"></div>
      @if (!svg() && busy()) {
        <p class="sdu-status">Drawing the diagram…</p>
      }
      @if (error()) {
        <p class="sdu-error" role="alert">{{ error() }}</p>
      }
      <div class="sdu-actions">
        <button type="button" class="sdu-btn" [disabled]="!svg()" (click)="downloadSvg()">Download SVG</button>
        <button type="button" class="sdu-btn" [disabled]="!svg()" (click)="downloadPng()">Download PNG</button>
        <span class="sdu-status" role="status" aria-live="polite">{{ status() }}</span>
      </div>
      <details class="sdu-details">
        <summary>Diagram source</summary>
        <pre class="sdu-output">{{ source() }}</pre>
      </details>
      @if (label()) {
        <figcaption class="sdu-muted">{{ label() }}</figcaption>
      }
    </figure>
  `,
})
export class SduDiagramComponent {
  /** Mermaid source text. */
  readonly source = input('')
  /** Accessible name and download file name. Defaults to "Diagram". */
  readonly label = input('')
  readonly theme = input<SduTheme>('auto')
  /** Each finished render: { ok, error? }. */
  readonly rendered = output<SduRenderedEvent>()

  protected readonly svg = signal('')
  protected readonly error = signal('')
  protected readonly busy = signal(false)
  protected readonly status = signal('')
  private readonly pageDark = signal<boolean | null>(null)
  protected readonly name = computed(() => this.label() || 'Diagram')
  protected readonly dataTheme = computed(() => themeAttr(this.theme()))
  private readonly sanitizer = inject(DomSanitizer)
  // Mermaid's strict security level sanitizes the SVG with DOMPurify before we get it.
  protected readonly safeSvg = computed<SafeHtml>(() => this.sanitizer.bypassSecurityTrustHtml(this.svg()))
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef)
  private readonly config = inject(SMART_DEV_UTILS_CONFIG, { optional: true })

  constructor() {
    const browser = isPlatformBrowser(inject(PLATFORM_ID))
    const destroy = inject(DestroyRef)
    if (browser && !configured && this.config) {
      configured = true
      if (this.config.mermaid) setMermaidLoader(this.config.mermaid)
      else if (this.config.mermaidUrl) setMermaidUrl(this.config.mermaidUrl)
    }

    afterNextRender(() => {
      const read = () => {
        const parent = this.host.nativeElement.parentNode
        this.pageDark.set(prefersDark(parent))
      }
      read()
      const media = typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null
      media?.addEventListener?.('change', read)
      const obs = new MutationObserver(read)
      obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
      destroy.onDestroy(() => {
        media?.removeEventListener?.('change', read)
        obs.disconnect()
      })
    })

    let token = 0
    effect(() => {
      const page = this.pageDark()
      if (!browser || page === null) return
      const theme = this.theme()
      const dark = theme === 'dark' ? true : theme === 'light' ? false : page
      const text = this.source()
      const t = ++token
      if (!text.trim()) {
        this.svg.set('')
        this.error.set('')
        return
      }
      this.busy.set(true)
      void renderMermaid(text, { dark }).then((r) => {
        if (t !== token) return
        this.busy.set(false)
        if (r.ok) {
          this.svg.set(r.svg)
          this.error.set('')
          this.rendered.emit({ ok: true })
        } else {
          this.error.set(r.error)
          this.rendered.emit({ ok: false, error: r.error })
        }
      })
    })
  }

  /** The drawn SVG, or null before a successful render. */
  toSvg(): string | null {
    return this.svg() || null
  }

  /** The drawn diagram as a PNG on the theme's background. */
  async toPng(): Promise<Blob> {
    const root = this.host.nativeElement.querySelector('.sdu-root')
    const bg = root ? getComputedStyle(root).backgroundColor : ''
    return svgToPng(this.svg(), { background: bg && bg !== 'rgba(0, 0, 0, 0)' ? bg : '#ffffff' })
  }

  protected downloadSvg(): void {
    downloadText(this.svg(), `${fileSlug(this.name())}.svg`, 'image/svg+xml')
    this.status.set('SVG download started.')
  }

  protected async downloadPng(): Promise<void> {
    try {
      downloadBlob(await this.toPng(), `${fileSlug(this.name())}.png`)
      this.status.set('PNG download started.')
    } catch (err) {
      this.status.set(`PNG export failed: ${errorText(err)}`)
    }
  }
}
