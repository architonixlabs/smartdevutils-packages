import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { getToolSpec, loadRunner, RUNNABLE_TOOL_IDS, type ToolRunResult } from '@smartdevutils/core/tools'
import { copyToClipboard } from '@smartdevutils/browser/clipboard'
import { downloadText } from '@smartdevutils/browser/file'
import { OptionFields, cx, errorText, themeAttr, type SduTheme } from './shared'

export interface SduToolResult extends ToolRunResult {
  tool: string
  mode: string
}

export interface SduToolProps {
  /** Tool id or website slug of a tool with a runner in @smartdevutils/core/tools. */
  tool: string
  /** Controlled mode. */
  mode?: string
  defaultMode?: string
  onModeChange?: (mode: string) => void
  /** Controlled input. */
  value?: string
  defaultValue?: string
  onChange?: (value: string) => void
  /** Settings keyed by the spec's option keys. Changing the object resets edits made in the form. */
  options?: Record<string, unknown>
  /** Run only on the Run button. */
  manual?: boolean
  readOnly?: boolean
  /** Hide the heading. */
  compact?: boolean
  label?: string
  theme?: SduTheme
  className?: string
  onResult?: (result: SduToolResult) => void
  onError?: (result: SduToolResult & { error: string }) => void
}

/**
 * A generic form for any tool with a runner: mode tabs, the tool's settings, input, output with
 * Copy and Download. Import '@smartdevutils/theme/styles.css' once for the styles.
 */
export function SduTool(props: SduToolProps) {
  const { tool, manual = false, readOnly = false, compact = false, theme, className } = props
  const spec = useMemo(() => getToolSpec(tool), [tool])
  const uid = useId()
  const [modeState, setModeState] = useState(props.defaultMode ?? '')
  const [valueState, setValueState] = useState(props.defaultValue ?? '')
  const [overrides, setOverrides] = useState<Record<string, unknown>>({})
  const [result, setResult] = useState<ToolRunResult | null>(null)
  const [running, setRunning] = useState(false)
  const [status, setStatus] = useState('')
  const token = useRef(0)
  const cbs = useRef(props)
  cbs.current = props

  const modeIds = spec?.modes.map((m) => m.id) ?? []
  const wanted = props.mode ?? modeState
  const mode = spec ? (modeIds.includes(wanted) ? wanted : (spec.defaultMode ?? modeIds[0] ?? '')) : ''
  const value = props.value ?? valueState

  // Compared by content, so an inline object literal does not reset the form on every render.
  const optionsKey = JSON.stringify(props.options ?? {})
  useEffect(() => setOverrides({}), [optionsKey])

  const effective = useMemo(() => {
    const d: Record<string, unknown> = {}
    for (const o of spec?.options ?? []) if (o.default !== undefined) d[o.key] = o.default
    return { ...d, ...(JSON.parse(optionsKey) as Record<string, unknown>), ...overrides }
  }, [spec, optionsKey, overrides])

  const run = useCallback(async () => {
    if (!spec) return
    const t = ++token.current
    setRunning(true)
    let res: ToolRunResult
    try {
      res = await (await loadRunner(spec.id)).run(value, { mode, options: effective })
    } catch (err) {
      res = { output: '', error: errorText(err) }
    }
    if (t !== token.current) return
    setRunning(false)
    setResult(res)
    setStatus(res.error ? 'The tool reported an error.' : res.output ? 'Done.' : '')
    const detail = { tool: spec.id, mode, ...res }
    cbs.current.onResult?.(detail)
    if (res.error) cbs.current.onError?.({ ...detail, error: res.error })
  }, [spec, value, mode, effective])

  useEffect(() => {
    if (manual || !spec) return
    if (!value.trim() && spec.input.kind !== 'none') {
      setResult(null)
      return
    }
    const timer = setTimeout(() => void run(), 200)
    return () => clearTimeout(timer)
  }, [manual, spec, value, run])

  if (!spec) {
    return (
      <section className={cx('sdu-root', className)} {...themeAttr(theme)}>
        <p className="sdu-error" role="alert">
          "{tool}" has no runner in this version of @smartdevutils/core. Runnable tools: {RUNNABLE_TOOL_IDS.join(', ')}.
        </p>
      </section>
    )
  }

  const setMode = (m: string) => {
    setModeState(m)
    props.onModeChange?.(m)
  }
  const setValue = (v: string) => {
    setValueState(v)
    props.onChange?.(v)
  }
  const m = spec.modes.find((x) => x.id === mode)
  const inputLabel = m?.inputLabel ?? spec.input.label ?? 'Input'
  const outputLabel = m?.outputLabel ?? (spec.output === 'report' ? 'Report' : 'Output')
  const visible = spec.options.filter((o) => !o.modes || o.modes.includes(mode))
  const title = props.label || spec.name
  const output = result?.output ?? ''
  const tabs = spec.modes.length > 1

  const onTabKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = modeIds.indexOf(mode)
    const map: Record<string, number> = {
      ArrowRight: (i + 1) % modeIds.length,
      ArrowDown: (i + 1) % modeIds.length,
      ArrowLeft: (i - 1 + modeIds.length) % modeIds.length,
      ArrowUp: (i - 1 + modeIds.length) % modeIds.length,
      Home: 0,
      End: modeIds.length - 1,
    }
    const next = map[e.key]
    if (next === undefined) return
    e.preventDefault()
    setMode(modeIds[next]!)
    e.currentTarget.querySelector<HTMLElement>(`[data-mode="${modeIds[next]}"]`)?.focus()
  }

  const download = () => {
    let json = false
    try {
      json = /^\s*[[{]/.test(output) && (JSON.parse(output), true)
    } catch {
      json = false
    }
    downloadText(output, `${spec.id}${mode ? '-' + mode : ''}.${json ? 'json' : 'txt'}`, json ? 'application/json' : 'text/plain')
    setStatus('Download started.')
  }

  return (
    <section className={cx('sdu-root sdu-stack', className)} aria-label={title} {...themeAttr(theme)}>
      {!compact && (
        <header className="sdu-header">
          <h2 className="sdu-title">{title}</h2>
        </header>
      )}
      {tabs && (
        <div className="sdu-tabs" role="tablist" aria-label="Mode" onKeyDown={onTabKey}>
          {spec.modes.map((x) => (
            <button
              key={x.id}
              type="button"
              className="sdu-tab"
              role="tab"
              id={`${uid}-tab-${x.id}`}
              data-mode={x.id}
              aria-selected={x.id === mode}
              aria-controls={`${uid}-panel`}
              tabIndex={x.id === mode ? 0 : -1}
              onClick={() => setMode(x.id)}
            >
              {x.label}
            </button>
          ))}
        </div>
      )}
      <div
        className="sdu-stack"
        id={`${uid}-panel`}
        role={tabs ? 'tabpanel' : undefined}
        aria-labelledby={tabs ? `${uid}-tab-${mode}` : undefined}
      >
        <OptionFields
          options={visible}
          values={effective}
          onChange={(k, v) => setOverrides((o) => ({ ...o, [k]: v }))}
          idPrefix={`${uid}-opt`}
        />
        <div className="sdu-field">
          <label className="sdu-label" htmlFor={`${uid}-input`}>
            {inputLabel}
          </label>
          <textarea
            id={`${uid}-input`}
            className="sdu-textarea"
            spellCheck={false}
            autoComplete="off"
            readOnly={readOnly}
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </div>
        <div className="sdu-actions">
          <button type="button" className="sdu-btn sdu-btn-primary" disabled={running} onClick={() => void run()}>
            {running ? 'Running…' : 'Run'}
          </button>
          <button
            type="button"
            className="sdu-btn"
            disabled={!output}
            onClick={() =>
              copyToClipboard(output).then(
                () => setStatus('Output copied.'),
                () => setStatus('Copy failed. Select the output and copy it by hand.'),
              )
            }
          >
            Copy
          </button>
          <button type="button" className="sdu-btn" disabled={!output} onClick={download}>
            Download
          </button>
          <span className="sdu-status" role="status" aria-live="polite">
            {status}
          </span>
        </div>
        {result?.error && (
          <p className="sdu-error" role="alert">
            {result.error}
          </p>
        )}
        <div className="sdu-field">
          <span className="sdu-label" id={`${uid}-output-label`}>
            {outputLabel}
          </span>
          <pre
            className="sdu-output"
            role="region"
            tabIndex={0}
            aria-labelledby={`${uid}-output-label`}
            data-empty="No output yet."
            data-role="output"
          >
            {output}
          </pre>
        </div>
        {result?.meta && spec.output === 'report' && (
          <details className="sdu-details">
            <summary>Findings as JSON</summary>
            <pre className="sdu-output">{JSON.stringify(result.meta, null, 2)}</pre>
          </details>
        )}
      </div>
    </section>
  )
}
