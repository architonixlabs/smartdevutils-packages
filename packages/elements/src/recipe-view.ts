import { html, nothing, type TemplateResult } from 'lit'
import type { RecipePlanStep, RecipeRun, RecipeTraceStep, StepChange, StepStatus } from '@smartdevutils/recipes'

export type RecipesModule = typeof import('@smartdevutils/recipes')

let recipesModule: Promise<RecipesModule> | null = null
/** The recipe engine and data are loaded on first use. */
export function loadRecipes(): Promise<RecipesModule> {
  if (!recipesModule) {
    recipesModule = import('@smartdevutils/recipes')
    recipesModule.catch(() => (recipesModule = null))
  }
  return recipesModule
}

/** How many JSON changes and diff lines a step shows before "and N more". */
export const SHOW_CHANGES = 12
export const SHOW_DIFF_LINES = 200

/** "What changed" for one step: the headline, the JSON value changes, then a line diff. */
export function renderChange(change: StepChange): TemplateResult {
  const json = change.json
  const shown = json ? json.changes.slice(0, SHOW_CHANGES) : []
  const hidden = json ? json.changes.length - shown.length + json.more : 0
  const lines = change.lines ? change.lines.filter((l) => l.op !== 'same') : null
  return html`<div class="sdu-change" part="change">
    <p class="sdu-change"><strong>What changed:</strong> <span data-role="headline">${change.headline}</span></p>
    ${shown.length
      ? html`<ul class="sdu-change-list" aria-label="Changed JSON values">
          ${shown.map(
            (c) =>
              html`<li>
                ${c.path}: ${c.kind}${c.kind === 'changed' ? html` ${c.before} → ${c.after}` : c.kind === 'added' ? html` ${c.after}` : html` ${c.before}`}
              </li>`,
          )}
          ${hidden > 0 ? html`<li>and ${hidden} more</li>` : nothing}
        </ul>`
      : nothing}
    ${lines && lines.length
      ? html`<details class="sdu-details">
          <summary>Line changes (${lines.length})</summary>
          <ul class="sdu-diff">
            ${lines.slice(0, SHOW_DIFF_LINES).map(
              (l) =>
                html`<li class=${l.op === 'add' ? 'sdu-diff-add' : 'sdu-diff-del'}>
                  <span class="sdu-visually-hidden">${l.op === 'add' ? 'Added: ' : 'Removed: '}</span>${l.text}
                </li>`,
            )}
          </ul>
        </details>`
      : nothing}
  </div>`
}

/** The recorded input and output of a step, in collapsible blocks. */
export function renderValues(t: RecipeTraceStep): TemplateResult {
  return html`<details class="sdu-details">
      <summary>Input (${t.input.length.toLocaleString('en-US')} characters)</summary>
      <pre class="sdu-output" tabindex="0">${t.input}</pre>
    </details>
    ${t.noOutputPanel
      ? html`<p class="sdu-muted">This tool shows a report, so its result is not passed on.</p>`
      : nothing}
    <details class="sdu-details" ?open=${!t.error}>
      <summary>${t.noOutputPanel ? 'Report' : 'Output'} (${t.output.length.toLocaleString('en-US')} characters)</summary>
      <pre class="sdu-output" tabindex="0" data-role="output">${t.output}</pre>
    </details>
    ${t.truncated ? html`<p class="sdu-muted">Long values were cut before they were stored.</p>` : nothing}`
}

/** The header line of a step: number, tool name, mode, state. */
export function renderStepHead(
  lib: RecipesModule,
  step: RecipePlanStep,
  i: number,
  state: StepStatus,
  extra: TemplateResult | typeof nothing = nothing,
) {
  return html`<div class="sdu-step-head">
    <span class="sdu-badge">Step ${i + 1}</span>
    <span class="sdu-step-name">${step.name}</span>
    ${step.mode ? html`<span class="sdu-badge" title="Mode">${step.mode}</span>` : nothing}
    <span class="sdu-status" data-role="state">${lib.STEP_STATUS_LABEL[state]}</span>
    ${extra}
  </div>`
}

/** The read-only body of a run: one list item per step. Used by <sdu-recipe-run>. */
export function renderTrace(lib: RecipesModule, run: RecipeRun): TemplateResult {
  return html`<ol class="sdu-steps" part="steps" aria-label="Steps">
    ${run.steps.map((s, i) => {
      const t = run.trace[i]
      const state = lib.stepStatus(run, i)
      return html`<li class="sdu-step" data-state=${state} part="step">
        ${renderStepHead(lib, s, i, state)}
        ${t
          ? html`<div class="sdu-step-body">
              ${t.error ? html`<p class="sdu-error">${t.error}</p>` : renderChange(lib.describeStep(t.input, t.output))}
              ${renderValues(t)}
            </div>`
          : nothing}
      </li>`
    })}
  </ol>`
}

export function stoppedNote(run: RecipeRun | null): TemplateResult | typeof nothing {
  if (!run?.stopped) return nothing
  return html`<p class="sdu-error" role="alert" part="error">
    Stopped at step ${run.stopped.index + 1}: ${run.stopped.reason}
  </p>`
}
