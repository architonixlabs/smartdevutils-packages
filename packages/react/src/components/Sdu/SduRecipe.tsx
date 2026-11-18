import { useEffect, useId, useMemo, useRef, useState } from 'react'
import {
  RUN_IMPORT_MAX_BYTES,
  describeStep,
  getRecipe,
  isRunnable,
  readRunFile,
  recipeSteps,
  resolveSteps,
  runFileName,
  runFileText,
  runFinished,
  runFrom,
  runSteps,
  stepStatus,
  type BuiltinRecipe,
  type RecipePlanStep,
  type RecipeRun,
  type RecipeTraceStep,
  type StepInput,
} from '@smartdevutils/recipes'
import { getToolSpec, type ToolModeSpec, type ToolSpec } from '@smartdevutils/core/tools'
import { findToolById } from '@smartdevutils/core/tools/catalog'
import { downloadText, readFileAsText } from '@smartdevutils/browser/file'
import { ChangeView, OptionFields, StepHead, StoppedNote, ValuesView, cx, errorText, themeAttr, type SduTheme } from './shared'

export interface SduRecipeProps {
  /** A built-in recipe id. */
  recipe?: string
  /** Your own chain instead of a built-in recipe. */
  steps?: StepInput[]
  /** Name of your own chain. */
  name?: string
  /** Initial input for step 1. Defaults to the recipe's synthetic sample. */
  defaultInput?: string
  label?: string
  theme?: SduTheme
  className?: string
  onStep?: (detail: { index: number; step: RecipePlanStep; trace: RecipeTraceStep }) => void
  onRun?: (run: RecipeRun) => void
}

interface Edit {
  index: number
  input: string
  mode: string
  options: Record<string, unknown>
  modes: readonly ToolModeSpec[]
  spec: ToolSpec | undefined
}

/**
 * Runs a recipe in the page: steps, Run all, per-step input, output and "what changed", edit a step
 * and run again from it, download and upload `sdu-recipe-run/1` files.
 */
export function SduRecipe(props: SduRecipeProps) {
  const { theme, className } = props
  const uid = useId()
  const stepsKey = JSON.stringify(props.steps ?? null)
  const loaded = useMemo((): { recipe: BuiltinRecipe | null; plan: RecipePlanStep[]; error: string } => {
    try {
      const custom = JSON.parse(stepsKey) as StepInput[] | null
      if (custom?.length) return { recipe: null, plan: resolveSteps(custom), error: '' }
      if (!props.recipe) return { recipe: null, plan: [], error: '' }
      const r = getRecipe(props.recipe)
      if (!r) return { recipe: null, plan: [], error: `There is no built-in recipe "${props.recipe}".` }
      return { recipe: r, plan: recipeSteps(r), error: '' }
    } catch (err) {
      return { recipe: null, plan: [], error: errorText(err) }
    }
  }, [props.recipe, stepsKey])

  const [recipe, setRecipe] = useState(loaded.recipe)
  const [plan, setPlan] = useState(loaded.plan)
  const [input, setInput] = useState(props.defaultInput ?? loaded.recipe?.sample ?? '')
  const [run, setRun] = useState<RecipeRun | null>(null)
  const [running, setRunning] = useState<number | null>(null)
  const [edit, setEdit] = useState<Edit | null>(null)
  const [error, setError] = useState(loaded.error)
  const [notes, setNotes] = useState<string[]>([])
  const [status, setStatus] = useState('')
  const cbs = useRef(props)
  cbs.current = props

  useEffect(() => {
    setRecipe(loaded.recipe)
    setPlan(loaded.plan)
    setRun(null)
    setEdit(null)
    setError(loaded.error)
    if (props.defaultInput === undefined && loaded.recipe) setInput(loaded.recipe.sample)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded])

  const title = props.label || recipe?.name || props.name || 'Recipe'
  const missing = plan.filter((s) => !isRunnable({ steps: [{ toolId: s.toolId }] })).map((s) => s.name)
  const busy = running !== null

  const onStep = (progress: RecipeRun, total: number) => (index: number, trace: RecipeTraceStep, step: RecipePlanStep) => {
    progress.trace = progress.trace.map((t, i) => (i === index ? trace : t))
    setRun({ ...progress })
    setRunning(index + 1 < total ? index + 1 : null)
    cbs.current.onStep?.({ index, step, trace })
  }

  const finish = (r: RecipeRun) => {
    setRunning(null)
    setRun(r)
    setStatus(r.stopped ? `Stopped at step ${r.stopped.index + 1}.` : `All ${r.steps.length} steps ran.`)
    cbs.current.onRun?.(r)
  }

  const runAll = async (steps = plan, value = input) => {
    setEdit(null)
    setError('')
    setNotes([])
    const progress: RecipeRun = { name: title, steps, trace: steps.map(() => null), updatedAt: Date.now() }
    setRun(progress)
    setRunning(0)
    finish(
      await runSteps(title, steps, value, {
        ...(recipe ? { basedOn: recipe.id } : {}),
        onStep: onStep(progress, steps.length),
      }),
    )
  }

  const rerunFrom = async (e: Edit) => {
    if (!run) {
      const steps = plan.map((s, i) => (i === e.index ? { ...s, ...(e.mode ? { mode: e.mode } : {}), options: { ...e.options } } : s))
      setPlan(steps)
      if (e.index === 0) setInput(e.input)
      await runAll(steps, e.index === 0 ? e.input : input)
      return
    }
    const progress: RecipeRun = { ...run, trace: run.trace.map((t, i) => (i < e.index ? t : null)) }
    delete progress.stopped
    setRun(progress)
    setRunning(e.index)
    try {
      const r = await runFrom(run, e.index, { input: e.input, mode: e.mode, options: e.options }, { onStep: onStep(progress, plan.length) })
      setPlan(r.steps)
      setEdit(null)
      finish(r)
    } catch (err) {
      setRunning(null)
      setRun(run)
      setError(errorText(err))
    }
  }

  const openEditor = (index: number) => {
    if (edit?.index === index) return setEdit(null)
    const step = plan[index]
    if (!step) return
    setEdit({
      index,
      input: run?.trace[index]?.input ?? (index > 0 ? (run?.trace[index - 1]?.output ?? '') : input),
      mode: step.mode ?? '',
      options: { ...(step.options ?? {}) },
      modes: findToolById(step.toolId)?.modes ?? [],
      spec: getToolSpec(step.toolId),
    })
  }

  const upload = async (file: File | undefined) => {
    if (!file) return
    if (file.size > RUN_IMPORT_MAX_BYTES) return setError('The file is larger than 2 MB.')
    const read = readRunFile(await readFileAsText(file))
    if ('error' in read) return setError(read.error)
    setError('')
    setRecipe(read.run.basedOn ? (getRecipe(read.run.basedOn) ?? null) : null)
    setPlan(read.run.steps)
    setRun(read.run)
    setEdit(null)
    setNotes(read.notes)
    const first = read.run.trace[0]?.input
    if (first !== undefined) setInput(first)
    setStatus(`Loaded the run file "${read.run.name}".`)
    cbs.current.onRun?.(read.run)
  }

  return (
    <section className={cx('sdu-root sdu-stack', className)} aria-label={title} {...themeAttr(theme)}>
      <header className="sdu-stack">
        <h2 className="sdu-title">{title}</h2>
        {recipe && <p className="sdu-desc">{recipe.description}</p>}
      </header>
      {missing.length > 0 && (
        <p className="sdu-error" role="alert">
          This recipe cannot run in the page yet: {missing.join(', ')} {missing.length === 1 ? 'has' : 'have'} no runner in
          @smartdevutils/core. Open it on smartdevutils.com instead.
        </p>
      )}
      <div className="sdu-field">
        <label className="sdu-label" htmlFor={`${uid}-input`}>
          Input for step 1
        </label>
        <textarea id={`${uid}-input`} className="sdu-textarea" spellCheck={false} value={input} onChange={(e) => setInput(e.target.value)} />
      </div>
      <div className="sdu-actions">
        <button
          type="button"
          className="sdu-btn sdu-btn-primary"
          disabled={busy || missing.length > 0 || !plan.length}
          onClick={() => void runAll()}
        >
          {busy ? 'Running…' : 'Run all steps'}
        </button>
        <button
          type="button"
          className="sdu-btn"
          disabled={!run || busy}
          onClick={() => {
            if (!run) return
            downloadText(runFileText(run), runFileName(run.name), 'application/json')
            setStatus('Run file download started.')
          }}
        >
          Download run
        </button>
        <label className="sdu-btn">
          Upload run
          <input
            className="sdu-visually-hidden"
            type="file"
            accept=".json,application/json"
            onChange={(e) => {
              const f = e.target.files?.[0]
              e.target.value = ''
              void upload(f)
            }}
          />
        </label>
        <span className="sdu-status" role="status" aria-live="polite">
          {status}
        </span>
      </div>
      {error && (
        <p className="sdu-error" role="alert">
          {error}
        </p>
      )}
      {notes.length > 0 && (
        <ul className="sdu-muted">
          {notes.map((n, i) => (
            <li key={i}>{n}</li>
          ))}
        </ul>
      )}
      <StoppedNote run={run} />
      {runFinished(run) && (
        <p className="sdu-ok" data-role="finished">
          Every step ran.
        </p>
      )}
      <ol className="sdu-steps" aria-label="Steps">
        {plan.map((s, i) => {
          const t = run?.trace[i] ?? null
          const st = stepStatus(run, i, running)
          const editing = edit?.index === i
          return (
            <li key={i} className="sdu-step" data-state={st}>
              <StepHead step={s} index={i} status={st}>
                <button type="button" className="sdu-btn sdu-btn-small" aria-expanded={editing} disabled={busy} onClick={() => openEditor(i)}>
                  Edit step {i + 1}
                </button>
              </StepHead>
              {t && (
                <div className="sdu-step-body">
                  {t.error ? <p className="sdu-error">{t.error}</p> : <ChangeView change={describeStep(t.input, t.output)} />}
                  <ValuesView trace={t} />
                </div>
              )}
              {editing && edit && <StepEditor uid={uid} edit={edit} busy={busy} onChange={setEdit} onSubmit={() => void rerunFrom(edit)} />}
            </li>
          )
        })}
      </ol>
    </section>
  )
}

function StepEditor(props: { uid: string; edit: Edit; busy: boolean; onChange: (e: Edit | null) => void; onSubmit: () => void }) {
  const { uid, edit: e, busy, onChange, onSubmit } = props
  const prefix = `${uid}-edit-${e.index}`
  const mode = e.mode || e.spec?.defaultMode || ''
  const options = e.spec ? e.spec.options.filter((o) => !o.modes || o.modes.includes(mode)) : []
  const defaults: Record<string, unknown> = {}
  for (const o of e.spec?.options ?? []) if (o.default !== undefined) defaults[o.key] = o.default
  return (
    <form
      className="sdu-step-body sdu-stack"
      aria-label={`Edit step ${e.index + 1}`}
      onSubmit={(ev) => {
        ev.preventDefault()
        onSubmit()
      }}
    >
      {e.modes.length > 1 && (
        <div className="sdu-field">
          <label className="sdu-label" htmlFor={`${prefix}-mode`}>
            Mode
          </label>
          <select id={`${prefix}-mode`} className="sdu-select" value={mode} onChange={(ev) => onChange({ ...e, mode: ev.target.value })}>
            {e.modes.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
      )}
      <OptionFields
        options={options}
        values={{ ...defaults, ...e.options }}
        onChange={(k, v) => onChange({ ...e, options: { ...e.options, [k]: v } })}
        idPrefix={prefix}
      />
      <div className="sdu-field">
        <label className="sdu-label" htmlFor={`${prefix}-input`}>
          Input for step {e.index + 1}
        </label>
        <textarea
          id={`${prefix}-input`}
          className="sdu-textarea"
          spellCheck={false}
          value={e.input}
          onChange={(ev) => onChange({ ...e, input: ev.target.value })}
        />
      </div>
      <div className="sdu-actions">
        <button type="submit" className="sdu-btn sdu-btn-primary" disabled={busy}>
          Run from this step
        </button>
        <button type="button" className="sdu-btn" onClick={() => onChange(null)}>
          Cancel
        </button>
      </div>
    </form>
  )
}
