import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core'
import type { SnippetLang } from '../../core/model'
import type { EditorController } from './codemirror-setup'

/** CodeMirror 6 editor; the CodeMirror chunk loads after first render. */
@Component({
  selector: 'pg-code-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="editor-host" #host [class.loading]="!ready()">
      @if (!ready()) {
        <pre class="editor-fallback" aria-hidden="true">{{ value() }}</pre>
      }
    </div>
    @if (failed()) {
      <p class="error-text small">The editor could not be loaded. The code is shown read-only.</p>
    }
  `,
})
export class CodeEditor {
  readonly value = input.required<string>()
  readonly lang = input.required<SnippetLang>()
  readonly readOnly = input(false)
  readonly label = input('Code editor')

  readonly valueChange = output<string>()
  readonly run = output<void>()

  protected readonly ready = signal(false)
  protected readonly failed = signal(false)
  private readonly host = viewChild.required<ElementRef<HTMLElement>>('host')
  private ctrl: EditorController | null = null

  constructor() {
    const destroyRef = inject(DestroyRef)
    let destroyed = false
    destroyRef.onDestroy(() => {
      destroyed = true
      this.ctrl?.destroy()
    })

    afterNextRender(() => {
      import('./codemirror-setup').then(
        ({ createEditor }) => {
          if (destroyed) return
          this.ctrl = createEditor(this.host().nativeElement, {
            doc: untracked(this.value),
            lang: untracked(this.lang),
            readOnly: untracked(this.readOnly),
            label: untracked(this.label),
            onChange: (code) => this.valueChange.emit(code),
            onRun: () => this.run.emit(),
          })
          this.ready.set(true)
        },
        () => this.failed.set(true),
      )
    })

    effect(() => {
      const v = this.value()
      if (this.ready()) this.ctrl?.setDoc(v)
    })
    effect(() => {
      const l = this.lang()
      if (this.ready()) this.ctrl?.setLang(l)
    })
    effect(() => {
      const ro = this.readOnly()
      if (this.ready()) this.ctrl?.setReadOnly(ro)
    })
    effect(() => {
      const lb = this.label()
      if (this.ready()) this.ctrl?.setLabel(lb)
    })
  }

  focus(): void {
    this.ctrl?.focus()
  }
}
