import { html, nothing, type PropertyValues } from 'lit'
import { live } from 'lit/directives/live.js'
import type { BuiltinRecipe, RecipePlanStep, RecipeRun, RecipeTraceStep, StepInput } from '@smartdevutils/recipes'
import type { ToolModeSpec, ToolSpec } from '@smartdevutils/core/tools'
import { downloadText, readFileAsText } from '@smartdevutils/browser/file'
import { SduElement, defineElement, message } from './base'
import { renderOptionFields } from './options-form'
import {
  loadRecipes,
  renderChange,
  renderStepHead,
  renderValues,
  stoppedNote,
  type RecipesModule,
} from './recipe-view'
import { loadTools } from './tool'

export interface SduStepDetail {
  index: number
  step: RecipePlanStep
  trace: RecipeTraceStep
}

export interface SduRunDetail {
  run: RecipeRun
}

interface EditState {
  index: number
  input: string
  mode: string
  options: Record<string, unknown>
  modes: readonly ToolModeSpec[]
  spec: ToolSpec | undefined
}

/**
 * `<sdu-recipe recipe="decode-base64-json-param">`
 *
 * Runs a built-in recipe (or your own `steps`) headless in the page: the step list, an input
 * (the recipe's synthetic sample by default), Run all, and per step the input, the output and
 * "what changed". Any step can be edited (input, mode, settings) and the run continued from it.
 * Runs download as `sdu-recipe-run/1` files, which the SmartDevUtils website can upload, and
 * such files can be uploaded here.
 *
 * @fires sdu-ready - The recipe has loaded. detail: { recipe, steps }
 * @fires sdu-step - A step finished. detail: { index, step, trace }
 * @fires sdu-run - A run finished or a run file was loaded. detail: { run }
 * @fires sdu-error - The recipe or a run file could not be read. detail: { error }
 * @csspart root - The outer box
 * @csspart input - The step 1 input
 * @csspart toolbar - The buttons
 * @csspart steps - The step list
 * @csspart step - One step
 * @csspart editor - The step editor
 * @csspart change - What changed in a step
 */
export class SduRecipeElement extends SduElement {
  static override properties = {
    ...SduElement.properties,
    recipe: { type: String, reflect: true },
    recipeId: { type: String, attribute: 'recipe-id' },
    steps: { attribute: false },
    name: { type: String },
    input: { type: String },
    label: { type: String },
    _lib: { state: true },
    _recipe: { state: true },
    _plan: { state: true },
    _run: { state: true },
    _running: { state: true },
    _edit: { state: true },
    _error: { state: true },
    _notes: { state: true },
    _status: { state: true },
  }

  /** A built-in recipe id. */
  declare recipe: string
  /** Same as `recipe` (attribute `recipe-id`). */
  declare recipeId: string
  /** Your own chain instead of a built-in recipe (property only). */
  declare steps: StepInput[] | null
  /** Name of your own chain. */
  declare name: string
  /** Input for step 1. Defaults to the recipe's synthetic sample. */
  declare input: string
  /** Heading text; defaults to the recipe name. */
  declare label: string

  declare _lib: RecipesModule | null
  declare _recipe: BuiltinRecipe | null
  declare _plan: RecipePlanStep[]
  declare _run: RecipeRun | null
  declare _running: number | null
  declare _edit: EditState | null
  declare _error: string
  declare _notes: string[]
  declare _status: string

  private _inputTouched = false
  private _resolveReady!: () => void
  /** Resolves once the recipe engine and the recipe have loaded. */
  readonly ready: Promise<void> = new Promise((r) => (this._resolveReady = r))

  constructor() {
    super()
    this.recipe = ''
    this.recipeId = ''
    this.steps = null
    this.name = ''
    this.input = ''
    this.label = ''
    this._lib = null
    this._recipe = null
    this._plan = []
    this._run = null
    this._running = null
    this._edit = null
    this._error = ''
    this._notes = []
    this._status = ''
  }

  /** The current run (null before the first run or upload). */
  get run(): RecipeRun | null {
    return this._run
  }

  /** The run as `sdu-recipe-run/1` JSON text, or null before a run. */
  runFileText(): string | null {
    return this._run && this._lib ? this._lib.runFileText(this._run) : null
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('recipe') || changed.has('recipeId') || changed.has('steps') || changed.has('name')) void this._load()
  }

  private async _load(): Promise<void> {
    this._error = ''
    try {
      const lib = await loadRecipes()
      this._lib = lib
      const id = this.recipe || this.recipeId
      if (this.steps && this.steps.length) {
        this._recipe = null
        this._plan = lib.resolveSteps(this.steps)
      } else if (id) {
        const r = lib.getRecipe(id)
        if (!r) throw new Error(`There is no built-in recipe "${id}".`)
        this._recipe = r
        this._plan = lib.recipeSteps(r)
        if (!this._inputTouched && !this.input) this.input = r.sample
      } else {
        this._plan = []
      }
      this._run = null
      this._edit = null
      this.emit('sdu-ready', { recipe: this._recipe?.id ?? null, steps: this._plan })
    } catch (err) {
      this._error = message(err)
      this.emit('sdu-error', { error: this._error })
    }
    this._resolveReady()
  }

  private get _title(): string {
    return this.label || this._recipe?.name || this.name || 'Recipe'
  }

  private _missing(): string[] {
    const lib = this._lib
    if (!lib) return []
    return this._plan.filter((s) => !lib.isRunnable({ steps: [{ toolId: s.toolId }] })).map((s) => s.name)
  }

  /** Runs every step on the current input. */
  async runAll(): Promise<RecipeRun | null> {
    await this.ready
    const lib = this._lib
    if (!lib || !this._plan.length) return null
    this._edit = null
    this._error = ''
    this._notes = []
    const progress: RecipeRun = { name: this._title, steps: this._plan, trace: this._plan.map(() => null), updatedAt: Date.now() }
    this._run = progress
    this._running = 0
    const run = await lib.runSteps(this._title, this._plan, this.input, {
      ...(this._recipe ? { basedOn: this._recipe.id } : {}),
      onStep: (index, trace, step) => this._onStep(progress, index, trace, step),
    })
    return this._finish(run)
  }

  /** Runs again from step `index` (0-based) with an optional changed input, mode or settings. */
  async runFrom(index: number, edit: { input?: string; mode?: string; options?: Record<string, unknown> } = {}): Promise<RecipeRun | null> {
    await this.ready
    const lib = this._lib
    const base = this._run
    if (!lib || !base) return null
    this._error = ''
    const progress: RecipeRun = { ...base, trace: base.trace.map((t, i) => (i < index ? t : null)) }
    delete progress.stopped
    this._run = progress
    this._running = index
    try {
      const run = await lib.runFrom(base, index, edit, { onStep: (i, t, s) => this._onStep(progress, i, t, s) })
      this._plan = run.steps
      this._edit = null
      return this._finish(run)
    } catch (err) {
      this._running = null
      this._run = base
      this._error = message(err)
      return null
    }
  }

  private _onStep(progress: RecipeRun, index: number, trace: RecipeTraceStep, step: RecipePlanStep) {
    progress.trace = progress.trace.map((t, i) => (i === index ? trace : t))
    this._run = { ...progress }
    this._running = index + 1 < this._plan.length ? index + 1 : null
    this.emit<SduStepDetail>('sdu-step', { index, step, trace })
  }

  private _finish(run: RecipeRun): RecipeRun {
    this._running = null
    this._run = run
    this._status = run.stopped
      ? `Stopped at step ${run.stopped.index + 1}.`
      : `All ${run.steps.length} steps ran.`
    this.emit<SduRunDetail>('sdu-run', { run })
    return run
  }

  private _download = () => {
    const text = this.runFileText()
    if (!text || !this._lib || !this._run) return
    downloadText(text, this._lib.runFileName(this._run.name), 'application/json')
    this._status = 'Run file download started.'
  }

  /** Reads an `sdu-recipe-run/1` file (text) and shows it. Returns the error text, or '' on success. */
  async loadRunFile(text: string): Promise<string> {
    await this.ready
    const lib = this._lib
    if (!lib) return 'The recipe engine has not loaded.'
    const read = lib.readRunFile(text)
    if ('error' in read) {
      this._error = read.error
      this.emit('sdu-error', { error: read.error })
      return read.error
    }
    this._error = ''
    this._recipe = read.run.basedOn ? (lib.getRecipe(read.run.basedOn) ?? null) : null
    this._plan = read.run.steps
    this._run = read.run
    this._edit = null
    this._notes = read.notes
    const first = read.run.trace[0]?.input
    if (first !== undefined) {
      this.input = first
      this._inputTouched = true
    }
    this._status = `Loaded the run file "${read.run.name}".`
    this.emit<SduRunDetail>('sdu-run', { run: read.run })
    return ''
  }

  private _upload = async (e: Event) => {
    const el = e.target as HTMLInputElement
    const file = el.files?.[0]
    el.value = ''
    if (!file) return
    if (file.size > (this._lib?.RUN_IMPORT_MAX_BYTES ?? 2 * 1024 * 1024)) {
      this._error = 'The file is larger than 2 MB.'
      return
    }
    await this.loadRunFile(await readFileAsText(file))
  }

  private async _openEditor(index: number) {
    if (this._edit?.index === index) {
      this._edit = null
      return
    }
    const step = this._plan[index]
    if (!step) return
    const [tools, catalog] = await Promise.all([loadTools(), import('@smartdevutils/core/tools/catalog')])
    const run = this._run
    const input = run?.trace[index]?.input ?? (index > 0 ? (run?.trace[index - 1]?.output ?? '') : this.input)
    this._edit = {
      index,
      input,
      mode: step.mode ?? '',
      options: { ...(step.options ?? {}) },
      modes: catalog.findToolById(step.toolId)?.modes ?? [],
      spec: tools.getToolSpec(step.toolId),
    }
  }

  private async _applyEdit() {
    const e = this._edit
    if (!e) return
    if (!this._run) {
      // Nothing has run yet: change the plan, then run everything (step 1's input is the recipe input).
      this._plan = this._plan.map((s, i) =>
        i === e.index
          ? { ...s, ...(e.mode ? { mode: e.mode } : {}), options: { ...e.options } }
          : s,
      )
      if (e.index === 0) this.input = e.input
      await this.runAll()
      return
    }
    await this.runFrom(e.index, { input: e.input, mode: e.mode, options: e.options })
  }

  private _renderEditor(e: EditState) {
    const prefix = `edit-${e.index}`
    const options = e.spec ? e.spec.options.filter((o) => !o.modes || o.modes.includes(e.mode || e.spec!.defaultMode || '')) : []
    return html`<form
      class="sdu-step-body sdu-stack"
      part="editor"
      aria-label="Edit step ${e.index + 1}"
      @submit=${(ev: Event) => {
        ev.preventDefault()
        void this._applyEdit()
      }}
    >
      ${e.modes.length > 1
        ? html`<div class="sdu-field">
            <label class="sdu-label" for="${prefix}-mode">Mode</label>
            <select
              id="${prefix}-mode"
              class="sdu-select"
              @change=${(ev: Event) => (this._edit = { ...e, mode: (ev.target as HTMLSelectElement).value })}
            >
              ${e.modes.map((m) => html`<option value=${m.id} ?selected=${(e.mode || e.spec?.defaultMode) === m.id}>${m.label}</option>`)}
            </select>
          </div>`
        : nothing}
      ${renderOptionFields(options, { ...defaultsOf(e.spec), ...e.options }, (k, v) => (this._edit = { ...e, options: { ...e.options, [k]: v } }), prefix)}
      <div class="sdu-field">
        <label class="sdu-label" for="${prefix}-input">Input for step ${e.index + 1}</label>
        <textarea
          id="${prefix}-input"
          class="sdu-textarea"
          spellcheck="false"
          .value=${live(e.input)}
          @input=${(ev: Event) => (this._edit = { ...e, input: (ev.target as HTMLTextAreaElement).value })}
        ></textarea>
      </div>
      <div class="sdu-actions">
        <button class="sdu-btn sdu-btn-primary" type="submit" ?disabled=${this._running !== null}>Run from this step</button>
        <button class="sdu-btn" type="button" @click=${() => (this._edit = null)}>Cancel</button>
      </div>
    </form>`
  }

  protected override render() {
    const lib = this._lib
    if (!lib) {
      return this._error
        ? html`<section class="sdu-root" part="root"><p class="sdu-error" role="alert">${this._error}</p></section>`
        : html`<section class="sdu-root" part="root" aria-busy="true"><p class="sdu-status">Loading the recipe…</p></section>`
    }
    const run = this._run
    const missing = this._missing()
    const busy = this._running !== null
    return html`<section class="sdu-root sdu-stack" part="root" aria-label=${this._title}>
      <header class="sdu-stack">
        <h2 class="sdu-title">${this._title}</h2>
        ${this._recipe ? html`<p class="sdu-desc">${this._recipe.description}</p>` : nothing}
      </header>
      ${missing.length
        ? html`<p class="sdu-error" role="alert">
            This recipe cannot run in the page yet: ${missing.join(', ')} ${missing.length === 1 ? 'has' : 'have'} no runner in
            @smartdevutils/core. Open it on smartdevutils.com instead.
          </p>`
        : nothing}
      <div class="sdu-field">
        <label class="sdu-label" for="recipe-input">Input for step 1</label>
        <textarea
          id="recipe-input"
          class="sdu-textarea"
          part="input"
          spellcheck="false"
          .value=${live(this.input)}
          @input=${(e: Event) => {
            this._inputTouched = true
            this.input = (e.target as HTMLTextAreaElement).value
          }}
        ></textarea>
      </div>
      <div class="sdu-actions" part="toolbar">
        <button class="sdu-btn sdu-btn-primary" part="button run" ?disabled=${busy || !!missing.length || !this._plan.length} @click=${() => this.runAll()}>
          ${busy ? 'Running…' : 'Run all steps'}
        </button>
        <button class="sdu-btn" part="button download" ?disabled=${!run || busy} @click=${this._download}>Download run</button>
        <label class="sdu-btn" part="button upload">
          Upload run
          <input class="sdu-visually-hidden" type="file" accept=".json,application/json" @change=${this._upload} />
        </label>
        <span class="sdu-status" role="status" aria-live="polite">${this._status}</span>
      </div>
      ${this._error ? html`<p class="sdu-error" role="alert" part="error">${this._error}</p>` : nothing}
      ${this._notes.length ? html`<ul class="sdu-muted">${this._notes.map((n) => html`<li>${n}</li>`)}</ul>` : nothing}
      ${stoppedNote(run)}
      ${lib && lib.runFinished(run) ? html`<p class="sdu-ok" data-role="finished">Every step ran.</p>` : nothing}
      <ol class="sdu-steps" part="steps" aria-label="Steps">
        ${this._plan.map((s, i) => {
          const t = run?.trace[i] ?? null
          const state = lib.stepStatus(run, i, this._running)
          const editing = this._edit?.index === i
          return html`<li class="sdu-step" data-state=${state} part="step">
            ${renderStepHead(
              lib,
              s,
              i,
              state,
              html`<button
                class="sdu-btn sdu-btn-small"
                aria-expanded=${editing ? 'true' : 'false'}
                ?disabled=${busy}
                @click=${() => this._openEditor(i)}
              >
                Edit step ${i + 1}
              </button>`,
            )}
            ${t
              ? html`<div class="sdu-step-body">
                  ${t.error ? html`<p class="sdu-error">${t.error}</p>` : renderChange(lib.describeStep(t.input, t.output))}
                  ${renderValues(t)}
                </div>`
              : nothing}
            ${editing && this._edit ? this._renderEditor(this._edit) : nothing}
          </li>`
        })}
      </ol>
    </section>`
  }
}

function defaultsOf(spec: ToolSpec | undefined): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const o of spec?.options ?? []) if (o.default !== undefined) out[o.key] = o.default
  return out
}

defineElement('sdu-recipe', SduRecipeElement)

declare global {
  interface HTMLElementTagNameMap {
    'sdu-recipe': SduRecipeElement
  }
}
