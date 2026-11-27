import { ChangeDetectionStrategy, Component, effect, input, signal } from '@angular/core'

type MarkedModule = typeof import('marked')
let markedLoad: Promise<MarkedModule> | undefined
const instances = new Map<number, import('marked').Marked>()

/** Renders Markdown to an HTML string; marked is loaded on first use. */
export async function renderMarkdown(source: string, headingOffset = 0): Promise<string> {
  markedLoad ??= import('marked')
  const { Marked } = await markedLoad
  let m = instances.get(headingOffset)
  if (!m) {
    m = new Marked({
      gfm: true,
      async: false,
      walkTokens(token) {
        // Keep the page's heading order: a README's `#` becomes an h2 under the page's h1.
        if (token.type === 'heading') token.depth = Math.min(6, token.depth + headingOffset)
      },
    })
    instances.set(headingOffset, m)
  }
  return m.parse(source, { async: false }) as string
}

/**
 * Markdown block. The HTML is bound through [innerHTML], so Angular's sanitizer strips scripts, event
 * handlers and unsafe URLs; nothing bypasses it.
 */
@Component({
  selector: 'pg-markdown',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'markdown' },
  template: `
    @if (html(); as h) {
      <div [innerHTML]="h"></div>
    } @else if (failed()) {
      <pre class="markdown-fallback">{{ source() }}</pre>
    } @else {
      <p class="muted">Loading…</p>
    }
  `,
})
export class MarkdownView {
  readonly source = input.required<string>()
  /** Added to every heading level (1 turns `#` into `<h2>`). */
  readonly headingOffset = input(1)

  protected readonly html = signal<string | null>(null)
  protected readonly failed = signal(false)
  private seq = 0

  constructor() {
    effect(() => {
      const src = this.source()
      const offset = this.headingOffset()
      const n = ++this.seq
      this.html.set(null)
      this.failed.set(false)
      renderMarkdown(src, offset).then(
        (h) => n === this.seq && this.html.set(h),
        () => n === this.seq && this.failed.set(true),
      )
    })
  }
}
