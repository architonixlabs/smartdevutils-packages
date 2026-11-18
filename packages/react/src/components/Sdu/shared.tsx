import type { ReactNode } from 'react'
import {
  STEP_STATUS_LABEL,
  type RecipePlanStep,
  type RecipeRun,
  type RecipeTraceStep,
  type StepChange,
  type StepStatus,
} from '@smartdevutils/recipes'
import type { ToolOptionSpec } from '@smartdevutils/core/tools'

export type SduTheme = 'light' | 'dark' | 'auto'

/** The data-theme attribute for a theme prop: none for `auto`, so the page decides. */
export const themeAttr = (theme: SduTheme | undefined) =>
  theme === 'light' || theme === 'dark' ? { 'data-theme': theme } : {}

export const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(' ')

export const errorText = (err: unknown) => (err instanceof Error ? err.message : String(err))

/** File name made from free text. */
export const fileSlug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'output'

function readValue(o: ToolOptionSpec, el: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement): unknown {
  if (o.type === 'boolean') return (el as HTMLInputElement).checked
  if (o.type === 'number') return el.value.trim() === '' ? undefined : Number(el.value)
  if (o.type === 'json') {
    try {
      return JSON.parse(el.value)
    } catch {
      return el.value
    }
  }
  return el.value
}

const shown = (v: unknown, o: ToolOptionSpec) =>
  v === undefined || v === null ? '' : o.type === 'json' && typeof v !== 'string' ? JSON.stringify(v, null, 2) : String(v)

/** The settings form for a tool, built from its spec. */
export function OptionFields(props: {
  options: readonly ToolOptionSpec[]
  values: Record<string, unknown>
  onChange: (key: string, value: unknown) => void
  idPrefix: string
}) {
  const { options, values, onChange, idPrefix } = props
  if (!options.length) return null
  return (
    <div className="sdu-options">
      {options.map((o) => {
        const id = `${idPrefix}-${o.key}`
        const change = (e: { target: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement }) => onChange(o.key, readValue(o, e.target))
        const v = values[o.key]
        if (o.type === 'boolean') {
          return (
            <label key={o.key} className="sdu-check" title={o.description}>
              <input id={id} type="checkbox" checked={Boolean(v)} onChange={change} /> {o.label}
            </label>
          )
        }
        const field = (control: ReactNode, wide = false) => (
          <div key={o.key} className={cx('sdu-field', wide && 'sdu-field-wide')}>
            <label className="sdu-label" htmlFor={id}>
              {o.label}
            </label>
            {control}
          </div>
        )
        if (o.type === 'select') {
          return field(
            <select id={id} className="sdu-select" title={o.description} value={String(v ?? '')} onChange={change}>
              {(o.choices ?? []).map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>,
          )
        }
        if (o.type === 'textarea' || o.type === 'json') {
          return field(
            <textarea id={id} className="sdu-textarea" rows={3} spellCheck={false} value={shown(v, o)} onChange={change} />,
            true,
          )
        }
        return field(
          <input
            id={id}
            className="sdu-input"
            type={o.type === 'number' ? 'number' : 'text'}
            min={o.min}
            max={o.max}
            spellCheck={false}
            title={o.description}
            value={shown(v, o)}
            onChange={change}
          />,
        )
      })}
    </div>
  )
}

const SHOW_CHANGES = 12
const SHOW_DIFF_LINES = 200

/** "What changed" for one step: the headline, JSON value changes, then a line diff. */
export function ChangeView({ change }: { change: StepChange }) {
  const json = change.json
  const list = json ? json.changes.slice(0, SHOW_CHANGES) : []
  const hidden = json ? json.changes.length - list.length + json.more : 0
  const lines = change.lines ? change.lines.filter((l) => l.op !== 'same') : null
  return (
    <div className="sdu-change">
      <p className="sdu-change">
        <strong>What changed:</strong> <span data-role="headline">{change.headline}</span>
      </p>
      {list.length > 0 && (
        <ul className="sdu-change-list" aria-label="Changed JSON values">
          {list.map((c, i) => (
            <li key={i}>
              {c.path}: {c.kind} {c.kind === 'changed' ? `${c.before} → ${c.after}` : c.kind === 'added' ? c.after : c.before}
            </li>
          ))}
          {hidden > 0 && <li>and {hidden} more</li>}
        </ul>
      )}
      {lines && lines.length > 0 && (
        <details className="sdu-details">
          <summary>Line changes ({lines.length})</summary>
          <ul className="sdu-diff">
            {lines.slice(0, SHOW_DIFF_LINES).map((l, i) => (
              <li key={i} className={l.op === 'add' ? 'sdu-diff-add' : 'sdu-diff-del'}>
                <span className="sdu-visually-hidden">{l.op === 'add' ? 'Added: ' : 'Removed: '}</span>
                {l.text}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}

export function ValuesView({ trace }: { trace: RecipeTraceStep }) {
  return (
    <>
      <details className="sdu-details">
        <summary>Input ({trace.input.length.toLocaleString('en-US')} characters)</summary>
        <pre className="sdu-output" tabIndex={0}>
          {trace.input}
        </pre>
      </details>
      {trace.noOutputPanel && <p className="sdu-muted">This tool shows a report, so its result is not passed on.</p>}
      <details className="sdu-details" open={!trace.error}>
        <summary>
          {trace.noOutputPanel ? 'Report' : 'Output'} ({trace.output.length.toLocaleString('en-US')} characters)
        </summary>
        <pre className="sdu-output" tabIndex={0} data-role="output">
          {trace.output}
        </pre>
      </details>
      {trace.truncated && <p className="sdu-muted">Long values were cut before they were stored.</p>}
    </>
  )
}

export function StepHead(props: { step: RecipePlanStep; index: number; status: StepStatus; children?: ReactNode }) {
  const { step, index, status, children } = props
  return (
    <div className="sdu-step-head">
      <span className="sdu-badge">Step {index + 1}</span>
      <span className="sdu-step-name">{step.name}</span>
      {step.mode && (
        <span className="sdu-badge" title="Mode">
          {step.mode}
        </span>
      )}
      <span className="sdu-status" data-role="state">
        {STEP_STATUS_LABEL[status]}
      </span>
      {children}
    </div>
  )
}

export function StoppedNote({ run }: { run: RecipeRun | null }) {
  if (!run?.stopped) return null
  return (
    <p className="sdu-error" role="alert">
      Stopped at step {run.stopped.index + 1}: {run.stopped.reason}
    </p>
  )
}
