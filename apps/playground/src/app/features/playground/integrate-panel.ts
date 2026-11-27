import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core'
import type { ApiItem, PackageDoc } from '../../core/model'
import { buildIntegrateGuide } from '../../lib/integrate'
import { CodeBlock } from '../../shared/code-block'

@Component({
  selector: 'pg-integrate-panel',
  imports: [CodeBlock],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let g = guide();
    @if (g.note) {
      <p class="note note-info" role="note">{{ g.note }}</p>
    }
    <h3 class="sub-heading">1. Install</h3>
    <pg-code-block label="Terminal" [code]="g.install.code" />
    <h3 class="sub-heading">2. Import</h3>
    <pg-code-block label="Import" [code]="g.imports.code" />
    @if (g.targets.length) {
      <h3 class="sub-heading">3. Use it</h3>
      @for (t of g.targets; track t.id) {
        <section class="integrate-target" [attr.aria-labelledby]="'int-' + t.id">
          <h4 [id]="'int-' + t.id">{{ t.title }}</h4>
          @if (t.note) {
            <p class="muted small">{{ t.note }}</p>
          }
          <pg-code-block [label]="t.title" [code]="t.code" />
        </section>
      }
    }
  `,
})
export class IntegratePanel {
  readonly pkg = input.required<PackageDoc>()
  readonly item = input.required<ApiItem>()
  readonly version = input.required<string>()

  protected readonly guide = computed(() => buildIntegrateGuide(this.pkg(), this.item(), this.version()))
}
