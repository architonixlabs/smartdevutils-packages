import { html, nothing, type PropertyValues } from 'lit'
import type { RecipeRun } from '@smartdevutils/recipes'
import { downloadText, readFileAsText } from '@smartdevutils/browser/file'
import { SduElement, defineElement, message } from './base'
import { loadRecipes, renderTrace, stoppedNote, type RecipesModule } from './recipe-view'

/**
 * `<sdu-recipe-run>` shows one recipe run: each step's input, output and "what changed".
 *
 * Give it a run with the `run` property (a RecipeRun from `@smartdevutils/recipes` or from
 * `<sdu-recipe>`'s `sdu-run` event), the text of an `sdu-recipe-run/1` file with `file-text` / `fileText`,
 * or a URL with `src`. Add `upload` to show an Upload button.
 *
 * @fires sdu-run - A run is shown. detail: { run }
 * @fires sdu-error - The run file could not be read. detail: { error }
 * @csspart root - The outer box
 * @csspart toolbar - The buttons
 * @csspart steps - The step list
 */
export class SduRecipeRunElement extends SduElement {
  static override properties = {
    ...SduElement.properties,
    run: { attribute: false },
    fileText: { type: String, attribute: 'file-text' },
    src: { type: String },
    upload: { type: Boolean },
    label: { type: String },
    _lib: { state: true },
    _shown: { state: true },
    _error: { state: true },
    _notes: { state: true },
    _status: { state: true },
  }

  declare run: RecipeRun | null
  /** The JSON text of an `sdu-recipe-run/1` file. */
  declare fileText: string
  /** A URL to fetch a run file from (same-origin or CORS-enabled). */
  declare src: string
  /** Show an Upload run button. */
  declare upload: boolean
  declare label: string

  declare _lib: RecipesModule | null
  declare _shown: RecipeRun | null
  declare _error: string
  declare _notes: string[]
  declare _status: string

  constructor() {
    super()
    this.run = null
    this.fileText = ''
    this.src = ''
    this.upload = false
    this.label = ''
    this._lib = null
    this._shown = null
    this._error = ''
    this._notes = []
    this._status = ''
  }

  /** The run being shown. */
  get shown(): RecipeRun | null {
    return this._shown
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('run') || changed.has('fileText') || changed.has('src')) void this._resolve(changed)
  }

  private async _resolve(changed: PropertyValues<this>) {
    try {
      const lib = this._lib ?? (await loadRecipes())
      this._lib = lib
      if (changed.has('run') && this.run) return this._show(this.run, [])
      if (changed.has('fileText') && this.fileText) return this.loadText(this.fileText)
      if (changed.has('src') && this.src) {
        const res = await fetch(this.src)
        if (!res.ok) throw new Error(`The run file could not be fetched (HTTP ${res.status}).`)
        return this.loadText(await res.text())
      }
    } catch (err) {
      this._fail(message(err))
    }
  }

  private _show(run: RecipeRun, notes: string[]) {
    this._shown = run
    this._notes = notes
    this._error = ''
    this.emit('sdu-run', { run })
  }

  private _fail(error: string) {
    this._error = error
    this.emit('sdu-error', { error })
  }

  /** Reads and shows run file text. Returns the error text, or '' on success. */
  async loadText(text: string): Promise<string> {
    const lib = this._lib ?? (await loadRecipes())
    this._lib = lib
    const read = lib.readRunFile(text)
    if ('error' in read) {
      this._fail(read.error)
      return read.error
    }
    this._show(read.run, read.notes)
    return ''
  }

  private _upload = async (e: Event) => {
    const el = e.target as HTMLInputElement
    const file = el.files?.[0]
    el.value = ''
    if (file) await this.loadText(await readFileAsText(file))
  }

  private _download = () => {
    const run = this._shown
    const lib = this._lib
    if (!run || !lib) return
    downloadText(lib.runFileText(run), lib.runFileName(run.name), 'application/json')
    this._status = 'Run file download started.'
  }

  protected override render() {
    const run = this._shown
    const lib = this._lib
    const title = this.label || run?.name || 'Recipe run'
    return html`<section class="sdu-root sdu-stack" part="root" aria-label=${title}>
      <header class="sdu-header">
        <h2 class="sdu-title">${title}</h2>
        ${run?.basedOn ? html`<span class="sdu-badge">Based on ${run.basedOn}</span>` : nothing}
      </header>
      <div class="sdu-actions" part="toolbar">
        <button class="sdu-btn" part="button download" ?disabled=${!run} @click=${this._download}>Download run</button>
        ${this.upload
          ? html`<label class="sdu-btn" part="button upload">
              Upload run
              <input class="sdu-visually-hidden" type="file" accept=".json,application/json" @change=${this._upload} />
            </label>`
          : nothing}
        <span class="sdu-status" role="status" aria-live="polite">${this._status}</span>
      </div>
      ${this._error ? html`<p class="sdu-error" role="alert" part="error">${this._error}</p>` : nothing}
      ${this._notes.length ? html`<ul class="sdu-muted">${this._notes.map((n) => html`<li>${n}</li>`)}</ul>` : nothing}
      ${stoppedNote(run)} ${lib && lib.runFinished(run) ? html`<p class="sdu-ok" data-role="finished">Every step ran.</p>` : nothing}
      ${run && lib ? renderTrace(lib, run) : html`<p class="sdu-status">No run to show yet.</p>`}
    </section>`
  }
}

defineElement('sdu-recipe-run', SduRecipeRunElement)

declare global {
  interface HTMLElementTagNameMap {
    'sdu-recipe-run': SduRecipeRunElement
  }
}
