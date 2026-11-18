import { LitElement, unsafeCSS, type PropertyValues } from 'lit'
import { baseCss, hostCss } from '@smartdevutils/theme'

/** The theme CSS adopted by every element's shadow root: Shadow DOM defaults, then the .sdu-* classes. */
export const sduStyles = [unsafeCSS(hostCss), unsafeCSS(baseCss)]

export type ThemeSetting = 'light' | 'dark' | 'auto'

/**
 * Registers a custom element once. Safe to call again (for example when two bundles both include
 * the elements) and a no-op where there is no custom element registry (Node, SSR).
 */
export function defineElement(name: string, ctor: CustomElementConstructor): void {
  if (typeof customElements === 'undefined') return
  if (!customElements.get(name)) customElements.define(name, ctor)
}

const connected = new Set<SduElement>()
let observer: MutationObserver | null = null

/** The data-theme of the nearest ancestor (across shadow roots), or null. */
function ancestorTheme(el: Element): 'light' | 'dark' | null {
  let n: Node | null = el.parentNode
  while (n) {
    if (n instanceof Element) {
      const t = n.getAttribute('data-theme')
      if (t === 'light' || t === 'dark') return t
    }
    n = n.parentNode ?? (n instanceof ShadowRoot ? n.host : null)
  }
  return null
}

/**
 * Shared behaviour: the `theme` attribute, following a page-level `data-theme`, and composed,
 * bubbling events.
 *
 * The element's colour scheme is, in order: its `theme` attribute, the nearest ancestor's
 * `data-theme`, then the OS setting. It is written to `data-sdu-scheme` on the element, which
 * the Shadow DOM styles read, so a page does not need the theme stylesheet for dark mode to work.
 */
export class SduElement extends LitElement {
  static override styles = sduStyles
  static override properties = {
    theme: { type: String, reflect: true },
  }

  /** `light`, `dark` or `auto` (follow the page and the OS). Sets `data-theme` on the element. */
  declare theme: ThemeSetting

  constructor() {
    super()
    this.theme = 'auto'
  }

  override connectedCallback(): void {
    super.connectedCallback()
    connected.add(this)
    if (!observer && typeof MutationObserver === 'function' && typeof document !== 'undefined') {
      observer = new MutationObserver(() => connected.forEach((el) => el.syncScheme()))
      observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'], subtree: true })
    }
    this.syncScheme()
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback()
    connected.delete(this)
    if (!connected.size) {
      observer?.disconnect()
      observer = null
    }
  }

  /** Re-reads the colour scheme (theme attribute, then ancestors). Called when a data-theme changes. */
  syncScheme(): void {
    const own = this.theme === 'light' || this.theme === 'dark' ? this.theme : null
    const scheme = own ?? ancestorTheme(this)
    if (scheme) {
      if (this.getAttribute('data-sdu-scheme') !== scheme) this.setAttribute('data-sdu-scheme', scheme)
    } else if (this.hasAttribute('data-sdu-scheme')) this.removeAttribute('data-sdu-scheme')
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed)
    if (changed.has('theme')) {
      if (this.theme === 'light' || this.theme === 'dark') this.setAttribute('data-theme', this.theme)
      else if (changed.get('theme') === 'light' || changed.get('theme') === 'dark') this.removeAttribute('data-theme')
      this.syncScheme()
    }
  }

  /** Dispatches a CustomEvent that bubbles and crosses shadow roots. */
  protected emit<T>(type: string, detail: T): boolean {
    return this.dispatchEvent(new CustomEvent<T>(type, { detail, bubbles: true, composed: true, cancelable: false }))
  }
}

export const message = (err: unknown): string =>
  err instanceof Error ? err.message : typeof err === 'string' ? err : 'Something went wrong.'

/** A file name made from free text: lower case, dashes, at most 60 characters. */
export const fileSlug = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'output'
