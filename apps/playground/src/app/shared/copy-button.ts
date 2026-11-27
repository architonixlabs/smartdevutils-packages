import { ChangeDetectionStrategy, Component, input, signal } from '@angular/core'
import { copyText } from '../core/clipboard'

@Component({
  selector: 'pg-copy-button',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button type="button" class="btn btn-sm" (click)="copy()" [attr.aria-label]="label()">
      {{ state() === 'done' ? 'Copied' : state() === 'fail' ? 'Copy failed' : text() }}
    </button>
    <span class="sr-only" aria-live="polite">{{ state() === 'done' ? 'Copied to clipboard' : state() === 'fail' ? 'Could not copy' : '' }}</span>
  `,
})
export class CopyButton {
  readonly value = input.required<string>()
  /** Accessible name, e.g. "Copy install command". */
  readonly label = input('Copy to clipboard')
  readonly text = input('Copy')

  protected readonly state = signal<'idle' | 'done' | 'fail'>('idle')
  private timer: ReturnType<typeof setTimeout> | undefined

  async copy(): Promise<void> {
    const ok = await copyText(this.value())
    this.state.set(ok ? 'done' : 'fail')
    clearTimeout(this.timer)
    this.timer = setTimeout(() => this.state.set('idle'), 2_000)
  }
}
