import { useEffect, useRef, useState } from 'react'
import { prefersDark, renderMermaid, svgToPng } from '@smartdevutils/browser/mermaid'
import { downloadBlob, downloadText } from '@smartdevutils/browser/file'
import { cx, errorText, fileSlug, themeAttr, type SduTheme } from './shared'

export interface SduDiagramProps {
  /** Mermaid source text. */
  source: string
  /** Accessible name and download file name. Defaults to "Diagram". */
  label?: string
  /** `auto` follows the nearest data-theme, then the OS. */
  theme?: SduTheme
  className?: string
  onRendered?: (detail: { ok: boolean; error?: string }) => void
}

/**
 * Draws Mermaid source as SVG, in the browser only (nothing is drawn during server rendering).
 * Mermaid is loaded on first use; see setMermaidLoader in @smartdevutils/browser/mermaid.
 * Always `securityLevel: 'strict'`.
 */
export function SduDiagram({ source, label, theme = 'auto', className, onRendered }: SduDiagramProps) {
  const ref = useRef<HTMLElement>(null)
  const [svg, setSvg] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [dark, setDark] = useState<boolean | null>(null)
  const cb = useRef(onRendered)
  cb.current = onRendered

  // Follow the theme: the prop, else the page's data-theme and the OS setting.
  useEffect(() => {
    const read = () =>
      setDark(theme === 'dark' ? true : theme === 'light' ? false : prefersDark(ref.current?.parentNode ?? null))
    read()
    if (theme !== 'auto') return
    const media = typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null
    media?.addEventListener?.('change', read)
    const obs = typeof MutationObserver === 'function' ? new MutationObserver(read) : null
    obs?.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => {
      media?.removeEventListener?.('change', read)
      obs?.disconnect()
    }
  }, [theme])

  useEffect(() => {
    if (dark === null) return
    let live = true
    if (!source.trim()) {
      setSvg('')
      setError('')
      return
    }
    setBusy(true)
    void renderMermaid(source, { dark }).then((r) => {
      if (!live) return
      setBusy(false)
      if (r.ok) {
        setSvg(r.svg)
        setError('')
        cb.current?.({ ok: true })
      } else {
        setError(r.error)
        cb.current?.({ ok: false, error: r.error })
      }
    })
    return () => {
      live = false
    }
  }, [source, dark])

  const name = label || 'Diagram'
  const png = async () => {
    try {
      const bg = ref.current ? getComputedStyle(ref.current).backgroundColor : ''
      downloadBlob(await svgToPng(svg, { background: bg && bg !== 'rgba(0, 0, 0, 0)' ? bg : dark ? '#14161a' : '#ffffff' }), `${fileSlug(name)}.png`)
      setStatus('PNG download started.')
    } catch (err) {
      setStatus(`PNG export failed: ${errorText(err)}`)
    }
  }

  return (
    <figure ref={ref} className={cx('sdu-root sdu-stack', className)} style={{ margin: 0 }} {...themeAttr(theme)}>
      <div
        className="sdu-diagram"
        role="img"
        aria-label={name}
        aria-busy={busy}
        // Mermaid's strict mode sanitizes the SVG with DOMPurify.
        dangerouslySetInnerHTML={svg ? { __html: svg } : undefined}
      >
        {svg ? undefined : busy ? <p className="sdu-status">Drawing the diagram…</p> : undefined}
      </div>
      {error && (
        <p className="sdu-error" role="alert">
          {error}
        </p>
      )}
      <div className="sdu-actions">
        <button
          type="button"
          className="sdu-btn"
          disabled={!svg}
          onClick={() => {
            downloadText(svg, `${fileSlug(name)}.svg`, 'image/svg+xml')
            setStatus('SVG download started.')
          }}
        >
          Download SVG
        </button>
        <button type="button" className="sdu-btn" disabled={!svg} onClick={() => void png()}>
          Download PNG
        </button>
        <span className="sdu-status" role="status" aria-live="polite">
          {status}
        </span>
      </div>
      <details className="sdu-details">
        <summary>Diagram source</summary>
        <pre className="sdu-output">{source}</pre>
      </details>
      {label && <figcaption className="sdu-muted">{label}</figcaption>}
    </figure>
  )
}
