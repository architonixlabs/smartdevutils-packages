import { ChangeDetectionStrategy, Component, input } from '@angular/core'
import { CopyButton } from './copy-button'

/** Read-only code with a copy button. */
@Component({
  selector: 'pg-code-block',
  imports: [CopyButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="code-block">
      <div class="code-block-bar">
        <span class="code-block-label">{{ label() }}</span>
        <pg-copy-button [value]="code()" [label]="'Copy ' + (label() || 'code')" />
      </div>
      <pre tabindex="0" [attr.aria-label]="label() || 'Code'"><code>{{ code() }}</code></pre>
    </div>
  `,
})
export class CodeBlock {
  readonly code = input.required<string>()
  readonly label = input('')
}
