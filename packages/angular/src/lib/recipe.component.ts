import { ChangeDetectionStrategy, Component, computed, effect, input, output, signal, untracked } from '@angular/core'
import {
  RUN_IMPORT_MAX_BYTES,
  STEP_STATUS_LABEL,
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
import { SduOptionFieldsComponent, type SduOptionChange } from './option-fields.component'
import { SduStepDetailComponent } from './step-detail.component'
import { SduStylesComponent } from './styles.component'
import { errorText, nextId, themeAttr, type SduTheme } from './util'

export interface SduStepEvent {
  index: number
  step: RecipePlanStep
  trace: RecipeTraceStep
}

interface StepEditState {
  index: number
  input: string
  mode: string
  options: Record<string, unknown>
  modes: readonly ToolModeSpec[]
  spec: ToolSpec | undefined
}

/**
 * `<sdu-recipe recipe="decode-base64-json-param" (run)="saved = $event" />`
 *
 * Runs a built-in recipe (or your own `steps`) in the page: steps, Run all, per-step input, output
 * and "what changed", edit a step and run again from it, download and upload `sdu-recipe-run/1` files.
 * Runs start from a click, so nothing runs during server rendering.
 */
@Component({
  selector: 'sdu-recipe',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SduStylesComponent, SduStepDetailComponent, SduOptionFieldsComponent],
  host: { '[attr.data-theme]': 'dataTheme()', style: 'display:block' },
  template: `
    <sdu-styles />
    <section class="sdu-root sdu-stack" [attr.aria-label]="title()">
      <header class="sdu-stack">
        <h2 class="sdu-title">{{ title() }}</h2>
        @if (builtin(); as r) {
          <p class="sdu-desc">{{ r.description }}</p>
        }
      </header>
      @if (missing().length) {
        <p class="sdu-error" role="alert">
          This recipe cannot run in the page yet: {{ missing().join(', ') }} {{ missing().length === 1 ? 'has' : 'have' }} no runner in
          &#64;smartdevutils/core. Open it on smartdevutils.com instead.
        </p>
      }
      <div class="sdu-field">
        <label class="sdu-label" [for]="uid + '-input'">Input for step 1</label>
        <textarea [id]="uid + '-input'" class="sdu-textarea" spellcheck="false" [value]="text()" (input)="text.set($any($event.target).value)"></textarea>
      </div>
      <div class="sdu-actions">
        <button type="button" class="sdu-btn sdu-btn-primary" [disabled]="busy() || missing().length > 0 || !plan().length" (click)="runAll()">
          {{ busy() ? 'Running…' : 'Run all steps' }}
        </button>
        <button type="button" class="sdu-btn" [disabled]="!current() || busy()" (click)="download()">Download run</button>
        <label class="sdu-btn">
          Upload run
          <input class="sdu-visually-hidden" type="file" accept=".json,application/json" (change)="upload($event)" />
        </label>
        <span class="sdu-status" role="status" aria-live="polite">{{ status() }}</span>
      </div>
      @if (error()) {
        <p class="sdu-error" role="alert">{{ error() }}</p>
      }
      @if (notes().length) {
        <ul class="sdu-muted">
          @for (n of notes(); track $index) {
            <li>{{ n }}</li>
          }
        </ul>
      }
      @if (current()?.stopped; as stop) {
        <p class="sdu-error" role="alert">Stopped at step {{ stop.index + 1 }}: {{ stop.reason }}</p>
      }
      @if (finished()) {
        <p class="sdu-ok" data-role="finished">Every step ran.</p>
      }
      <ol class="sdu-steps" aria-label="Steps">
        @for (s of plan(); track $index; let i = $index) {
          <li class="sdu-step" [attr.data-state]="statusOf(i)">
            <div class="sdu-step-head">
              <span class="sdu-badge">Step {{ i + 1 }}</span>
              <span class="sdu-step-name">{{ s.name }}</span>
              @if (s.mode) {
                <span class="sdu-badge" title="Mode">{{ s.mode }}</span>
              }
              <span class="sdu-status" data-role="state">{{ labelOf(i) }}</span>
              <button type="button" class="sdu-btn sdu-btn-small" [attr.aria-expanded]="edit()?.index === i" [disabled]="busy()" (click)="openEditor(i)">
                Edit step {{ i + 1 }}
              </button>
            </div>
            @if (current()?.trace?.[i]; as t) {
              <sdu-step-detail [trace]="t" />
            }
            @if (edit(); as e) {
              @if (e.index === i) {
                <form class="sdu-step-body sdu-stack" [attr.aria-label]="'Edit step ' + (i + 1)" (submit)="$event.preventDefault(); applyEdit()">
                  @if (e.modes.length > 1) {
                    <div class="sdu-field">
                      <label class="sdu-label" [for]="uid + '-edit-mode'">Mode</label>
                      <select [id]="uid + '-edit-mode'" class="sdu-select" (change)="patchEdit({ mode: $any($event.target).value })">
                        @for (m of e.modes; track m.id) {
                          <option [value]="m.id" [selected]="editMode() === m.id">{{ m.label }}</option>
                        }
                      </select>
                    </div>
                  }
                  <sdu-option-fields [options]="editOptions()" [values]="editValues()" [idPrefix]="uid + '-edit'" (optionChange)="setEditOption($event)" />
                  <div class="sdu-field">
                    <label class="sdu-label" [for]="uid + '-edit-input'">Input for step {{ i + 1 }}</label>
                    <textarea [id]="uid + '-edit-input'" class="sdu-textarea" spellcheck="false" [value]="e.input" (input)="patchEdit({ input: $any($event.target).value })"></textarea>
                  </div>
                  <div class="sdu-actions">
                    <button type="submit" class="sdu-btn sdu-btn-primary" [disabled]="busy()">Run from this step</button>
                    <button type="button" class="sdu-btn" (click)="edit.set(null)">Cancel</button>
                  </div>
                </form>
              }
            }
          </li>
        }
      </ol>
    </section>
  `,
})
export class SduRecipeComponent {
  /** A built-in recipe id. */
  readonly recipe = input('')
  /** Your own chain instead of a built-in recipe. */
  readonly steps = input<StepInput[] | null>(null)
  /** Name of your own chain. */
  readonly name = input('')
  /** Input for step 1; defaults to the recipe's synthetic sample. */
  readonly initialInput = input<string | undefined>(undefined, { alias: 'input' })
  /** The step 1 input as it is now (edited in the form or loaded from a run file). */
  readonly text = signal('')
  readonly label = input('')
  readonly theme = input<SduTheme>('auto')
  /** Each finished step. */
  readonly step = output<SduStepEvent>()
  /** Each finished run, and each uploaded run file. */
  readonly run = output<RecipeRun>()

  protected readonly uid = nextId('sdu-recipe')
  protected readonly builtin = signal<BuiltinRecipe | null>(null)
  protected readonly plan = signal<RecipePlanStep[]>([])
  /** The current run (null before the first run or upload). */
  readonly current = signal<RecipeRun | null>(null)
  protected readonly running = signal<number | null>(null)
  protected readonly edit = signal<StepEditState | null>(null)
  protected readonly error = signal('')
  protected readonly notes = signal<string[]>([])
  protected readonly status = signal('')
  protected readonly busy = computed(() => this.running() !== null)
  protected readonly title = computed(() => this.label() || this.builtin()?.name || this.name() || 'Recipe')
  protected readonly missing = computed(() => this.plan().filter((s) => !isRunnable({ steps: [{ toolId: s.toolId }] })).map((s) => s.name))
  protected readonly finished = computed(() => runFinished(this.current()))
  protected readonly dataTheme = computed(() => themeAttr(this.theme()))
  protected readonly editMode = computed(() => {
    const e = this.edit()
    return e ? e.mode || e.spec?.defaultMode || '' : ''
  })
  protected readonly editOptions = computed(() => {
    const e = this.edit()
    const m = this.editMode()
    return e?.spec ? e.spec.options.filter((o) => !o.modes || o.modes.includes(m)) : []
  })
  protected readonly editValues = computed(() => {
    const e = this.edit()
    const d: Record<string, unknown> = {}
    for (const o of e?.spec?.options ?? []) if (o.default !== undefined) d[o.key] = o.default
    return { ...d, ...(e?.options ?? {}) }
  })

  constructor() {
    effect(() => {
      const id = this.recipe()
      const custom = this.steps()
      const given = this.initialInput()
      untracked(() => this.load(id, custom, given))
    })
  }

  private load(id: string, custom: StepInput[] | null, given: string | undefined): void {
    this.error.set('')
    this.current.set(null)
    this.edit.set(null)
    try {
      if (custom?.length) {
        this.builtin.set(null)
        this.plan.set(resolveSteps(custom))
      } else if (id) {
        const r = getRecipe(id)
        if (!r) throw new Error(`There is no built-in recipe "${id}".`)
        this.builtin.set(r)
        this.plan.set(recipeSteps(r))
      } else {
        this.plan.set([])
      }
      this.text.set(given ?? this.builtin()?.sample ?? '')
    } catch (err) {
      this.plan.set([])
      this.error.set(errorText(err))
    }
  }

  protected statusOf(i: number) {
    return stepStatus(this.current(), i, this.running())
  }

  protected labelOf(i: number): string {
    return STEP_STATUS_LABEL[this.statusOf(i)]
  }

  private onStep(progress: RecipeRun, total: number) {
    return (index: number, trace: RecipeTraceStep, step: RecipePlanStep) => {
      progress.trace = progress.trace.map((t, i) => (i === index ? trace : t))
      this.current.set({ ...progress })
      this.running.set(index + 1 < total ? index + 1 : null)
      this.step.emit({ index, step, trace })
    }
  }

  private finish(r: RecipeRun): RecipeRun {
    this.running.set(null)
    this.current.set(r)
    this.status.set(r.stopped ? `Stopped at step ${r.stopped.index + 1}.` : `All ${r.steps.length} steps ran.`)
    this.run.emit(r)
    return r
  }

  /** Runs every step on the current input. */
  async runAll(): Promise<RecipeRun | null> {
    const steps = this.plan()
    if (!steps.length) return null
    this.edit.set(null)
    this.error.set('')
    this.notes.set([])
    const progress: RecipeRun = { name: this.title(), steps, trace: steps.map(() => null), updatedAt: Date.now() }
    this.current.set(progress)
    this.running.set(0)
    const r = this.builtin()
    return this.finish(
      await runSteps(this.title(), steps, this.text(), { ...(r ? { basedOn: r.id } : {}), onStep: this.onStep(progress, steps.length) }),
    )
  }

  /** Runs again from step `index` (0-based) with an optional changed input, mode or settings. */
  async runFrom(index: number, change: { input?: string; mode?: string; options?: Record<string, unknown> } = {}): Promise<RecipeRun | null> {
    const base = this.current()
    if (!base) return null
    const progress: RecipeRun = { ...base, trace: base.trace.map((t, i) => (i < index ? t : null)) }
    delete progress.stopped
    this.current.set(progress)
    this.running.set(index)
    try {
      const r = await runFrom(base, index, change, { onStep: this.onStep(progress, this.plan().length) })
      this.plan.set(r.steps)
      this.edit.set(null)
      return this.finish(r)
    } catch (err) {
      this.running.set(null)
      this.current.set(base)
      this.error.set(errorText(err))
      return null
    }
  }

  protected openEditor(index: number): void {
    if (this.edit()?.index === index) return this.edit.set(null)
    const step = this.plan()[index]
    if (!step) return
    const run = this.current()
    this.edit.set({
      index,
      input: run?.trace[index]?.input ?? (index > 0 ? (run?.trace[index - 1]?.output ?? '') : this.text()),
      mode: step.mode ?? '',
      options: { ...(step.options ?? {}) },
      modes: findToolById(step.toolId)?.modes ?? [],
      spec: getToolSpec(step.toolId),
    })
  }

  protected patchEdit(patch: Partial<StepEditState>): void {
    this.edit.update((e) => (e ? { ...e, ...patch } : e))
  }

  protected setEditOption(c: SduOptionChange): void {
    this.edit.update((e) => (e ? { ...e, options: { ...e.options, [c.key]: c.value } } : e))
  }

  protected async applyEdit(): Promise<void> {
    const e = this.edit()
    if (!e) return
    if (!this.current()) {
      this.plan.update((p) => p.map((s, i) => (i === e.index ? { ...s, ...(e.mode ? { mode: e.mode } : {}), options: { ...e.options } } : s)))
      if (e.index === 0) this.text.set(e.input)
      await this.runAll()
      return
    }
    await this.runFrom(e.index, { input: e.input, mode: e.mode, options: e.options })
  }

  /** The current run as `sdu-recipe-run/1` JSON text, or null. */
  runFileText(): string | null {
    const r = this.current()
    return r ? runFileText(r) : null
  }

  protected download(): void {
    const r = this.current()
    if (!r) return
    downloadText(runFileText(r), runFileName(r.name), 'application/json')
    this.status.set('Run file download started.')
  }

  /** Reads and shows an `sdu-recipe-run/1` file. Returns the error text, or '' on success. */
  loadRunFile(text: string): string {
    const read = readRunFile(text)
    if ('error' in read) {
      this.error.set(read.error)
      return read.error
    }
    this.error.set('')
    this.builtin.set(read.run.basedOn ? (getRecipe(read.run.basedOn) ?? null) : null)
    this.plan.set(read.run.steps)
    this.current.set(read.run)
    this.edit.set(null)
    this.notes.set(read.notes)
    const first = read.run.trace[0]?.input
    if (first !== undefined) this.text.set(first)
    this.status.set(`Loaded the run file "${read.run.name}".`)
    this.run.emit(read.run)
    return ''
  }

  protected async upload(e: Event): Promise<void> {
    const el = e.target as HTMLInputElement
    const file = el.files?.[0]
    el.value = ''
    if (!file) return
    if (file.size > RUN_IMPORT_MAX_BYTES) {
      this.error.set('The file is larger than 2 MB.')
      return
    }
    this.loadRunFile(await readFileAsText(file))
  }
}
