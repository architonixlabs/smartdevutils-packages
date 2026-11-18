import { useEffect, useState } from 'react'
import {
  describeStep,
  readRunFile,
  runFileName,
  runFileText,
  runFinished,
  stepStatus,
  type RecipeRun,
} from '@smartdevutils/recipes'
import { downloadText, readFileAsText } from '@smartdevutils/browser/file'
import { ChangeView, StepHead, StoppedNote, ValuesView, cx, themeAttr, type SduTheme } from './shared'

export interface SduRecipeRunProps {
  /** A run, for example from SduRecipe's onRun or runRecipe(). */
  run?: RecipeRun | null
  /** The JSON text of an `sdu-recipe-run/1` file. Used when `run` is not given. */
  fileText?: string
  /** Show an Upload run button. */
  upload?: boolean
  label?: string
  theme?: SduTheme
  className?: string
  onRun?: (run: RecipeRun) => void
  onError?: (error: string) => void
}

/** Shows one recipe run: each step's input, output and "what changed", with Download run. */
export function SduRecipeRun(props: SduRecipeRunProps) {
  const { upload = false, theme, className } = props
  const [shown, setShown] = useState<RecipeRun | null>(props.run ?? null)
  const [error, setError] = useState('')
  const [notes, setNotes] = useState<string[]>([])
  const [status, setStatus] = useState('')

  const loadText = (text: string) => {
    const read = readRunFile(text)
    if ('error' in read) {
      setError(read.error)
      props.onError?.(read.error)
      return
    }
    setError('')
    setShown(read.run)
    setNotes(read.notes)
    props.onRun?.(read.run)
  }

  useEffect(() => {
    if (props.run) {
      setShown(props.run)
      setNotes([])
      setError('')
    } else if (props.fileText) loadText(props.fileText)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.run, props.fileText])

  const title = props.label || shown?.name || 'Recipe run'
  return (
    <section className={cx('sdu-root sdu-stack', className)} aria-label={title} {...themeAttr(theme)}>
      <header className="sdu-header">
        <h2 className="sdu-title">{title}</h2>
        {shown?.basedOn && <span className="sdu-badge">Based on {shown.basedOn}</span>}
      </header>
      <div className="sdu-actions">
        <button
          type="button"
          className="sdu-btn"
          disabled={!shown}
          onClick={() => {
            if (!shown) return
            downloadText(runFileText(shown), runFileName(shown.name), 'application/json')
            setStatus('Run file download started.')
          }}
        >
          Download run
        </button>
        {upload && (
          <label className="sdu-btn">
            Upload run
            <input
              className="sdu-visually-hidden"
              type="file"
              accept=".json,application/json"
              onChange={(e) => {
                const f = e.target.files?.[0]
                e.target.value = ''
                if (f) void readFileAsText(f).then(loadText)
              }}
            />
          </label>
        )}
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
      <StoppedNote run={shown} />
      {runFinished(shown) && (
        <p className="sdu-ok" data-role="finished">
          Every step ran.
        </p>
      )}
      {shown ? (
        <ol className="sdu-steps" aria-label="Steps">
          {shown.steps.map((s, i) => {
            const t = shown.trace[i]
            const st = stepStatus(shown, i)
            return (
              <li key={i} className="sdu-step" data-state={st}>
                <StepHead step={s} index={i} status={st} />
                {t && (
                  <div className="sdu-step-body">
                    {t.error ? <p className="sdu-error">{t.error}</p> : <ChangeView change={describeStep(t.input, t.output)} />}
                    <ValuesView trace={t} />
                  </div>
                )}
              </li>
            )
          })}
        </ol>
      ) : (
        <p className="sdu-status">No run to show yet.</p>
      )}
    </section>
  )
}
