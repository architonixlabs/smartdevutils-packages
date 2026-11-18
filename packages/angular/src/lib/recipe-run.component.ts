import { ChangeDetectionStrategy, Component, booleanAttribute, computed, effect, input, output, signal, untracked } from '@angular/core'
import { STEP_STATUS_LABEL, readRunFile, runFileName, runFileText, runFinished, stepStatus, type RecipeRun } from '@smartdevutils/recipes'
import { downloadText, readFileAsText } from '@smartdevutils/browser/file'
import { SduStepDetailComponent } from './step-detail.component'
import { SduStylesComponent } from './styles.component'
import { themeAttr, type SduTheme } from './util'

/**
 * `<sdu-recipe-run [run]="savedRun" />` or `<sdu-recipe-run [fileText]="json" upload />`
 *
 * Shows one recipe run: each step's input, output and "what changed", with Download run.
 */
@Component({
  selector: 'sdu-recipe-run',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SduStylesComponent, SduStepDetailComponent],
  host: { '[attr.data-theme]': 'dataTheme()', style: 'display:block' },
  template: `
    <sdu-styles />
    <section class="sdu-root sdu-stack" [attr.aria-label]="title()">
      <header class="sdu-header">
        <h2 class="sdu-title">{{ title() }}</h2>
        @if (shown()?.basedOn; as based) {
          <span class="sdu-badge">Based on {{ based }}</span>
        }
      </header>
      <div class="sdu-actions">
        <button type="button" class="sdu-btn" [disabled]="!shown()" (click)="download()">Download run</button>
        @if (upload()) {
          <label class="sdu-btn">
            Upload run
            <input class="sdu-visually-hidden" type="file" accept=".json,application/json" (change)="onUpload($event)" />
          </label>
        }
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
      @if (shown()?.stopped; as stop) {
        <p class="sdu-error" role="alert">Stopped at step {{ stop.index + 1 }}: {{ stop.reason }}</p>
      }
      @if (finished()) {
        <p class="sdu-ok" data-role="finished">Every step ran.</p>
      }
      @if (shown(); as r) {
        <ol class="sdu-steps" aria-label="Steps">
          @for (s of r.steps; track $index; let i = $index) {
            <li class="sdu-step" [attr.data-state]="statusOf(r, i)">
              <div class="sdu-step-head">
                <span class="sdu-badge">Step {{ i + 1 }}</span>
                <span class="sdu-step-name">{{ s.name }}</span>
                @if (s.mode) {
                  <span class="sdu-badge" title="Mode">{{ s.mode }}</span>
                }
                <span class="sdu-status" data-role="state">{{ labels[statusOf(r, i)] }}</span>
              </div>
              @if (r.trace[i]; as t) {
                <sdu-step-detail [trace]="t" />
              }
            </li>
          }
        </ol>
      } @else {
        <p class="sdu-status">No run to show yet.</p>
      }
    </section>
  `,
})
export class SduRecipeRunComponent {
  /** A run, for example from SduRecipeComponent's (run) output or runRecipe(). */
  readonly run = input<RecipeRun | null>(null)
  /** The JSON text of an `sdu-recipe-run/1` file, used when `run` is not given. */
  readonly fileText = input('')
  /** Show an Upload run button. */
  readonly upload = input(false, { transform: booleanAttribute })
  readonly label = input('')
  readonly theme = input<SduTheme>('auto')
  /** A run is shown (given, or read from a file). */
  readonly loaded = output<RecipeRun>()
  /** A run file could not be read. */
  readonly failed = output<string>()

  /** The run being shown. */
  readonly shown = signal<RecipeRun | null>(null)
  protected readonly error = signal('')
  protected readonly notes = signal<string[]>([])
  protected readonly status = signal('')
  protected readonly labels = STEP_STATUS_LABEL
  protected readonly title = computed(() => this.label() || this.shown()?.name || 'Recipe run')
  protected readonly finished = computed(() => runFinished(this.shown()))
  protected readonly dataTheme = computed(() => themeAttr(this.theme()))

  constructor() {
    effect(() => {
      const run = this.run()
      const text = this.fileText()
      untracked(() => {
        if (run) {
          this.shown.set(run)
          this.notes.set([])
          this.error.set('')
        } else if (text) this.loadText(text)
      })
    })
  }

  protected statusOf(run: RecipeRun, i: number) {
    return stepStatus(run, i)
  }

  /** Reads and shows run file text. Returns the error text, or '' on success. */
  loadText(text: string): string {
    const read = readRunFile(text)
    if ('error' in read) {
      this.error.set(read.error)
      this.failed.emit(read.error)
      return read.error
    }
    this.error.set('')
    this.shown.set(read.run)
    this.notes.set(read.notes)
    this.loaded.emit(read.run)
    return ''
  }

  protected async onUpload(e: Event): Promise<void> {
    const el = e.target as HTMLInputElement
    const file = el.files?.[0]
    el.value = ''
    if (file) this.loadText(await readFileAsText(file))
  }

  protected download(): void {
    const r = this.shown()
    if (!r) return
    downloadText(runFileText(r), runFileName(r.name), 'application/json')
    this.status.set('Run file download started.')
  }
}
