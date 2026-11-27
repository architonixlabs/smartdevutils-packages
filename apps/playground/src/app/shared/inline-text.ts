import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core'
import { inlineSegments } from '../lib/inline-code'

/** One line of text where `backtick` spans render as code. Plain interpolation: no HTML is parsed. */
@Component({
  selector: 'pg-inline',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `@for (seg of segments(); track $index) {@if (seg.code) {<code>{{ seg.text }}</code>} @else {{{ seg.text }}}}`,
})
export class InlineText {
  readonly text = input.required<string>()
  protected readonly segments = computed(() => inlineSegments(this.text()))
}
