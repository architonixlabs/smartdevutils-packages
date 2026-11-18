import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core'
import { describeStep, type RecipeTraceStep } from '@smartdevutils/recipes'

const SHOW_CHANGES = 12
const SHOW_DIFF_LINES = 200

/** One recorded step: "what changed" (headline, JSON value changes, line diff), then its input and output. */
@Component({
  selector: 'sdu-step-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'sdu-step-body' },
  template: `
    @if (trace().error) {
      <p class="sdu-error">{{ trace().error }}</p>
    } @else {
      <div class="sdu-change">
        <p class="sdu-change"><strong>What changed:</strong> <span data-role="headline">{{ change().headline }}</span></p>
        @if (jsonChanges().length) {
          <ul class="sdu-change-list" aria-label="Changed JSON values">
            @for (c of jsonChanges(); track $index) {
              <li>
                {{ c.path }}: {{ c.kind }}
                @switch (c.kind) {
                  @case ('changed') { {{ c.before }} → {{ c.after }} }
                  @case ('added') { {{ c.after }} }
                  @default { {{ c.before }} }
                }
              </li>
            }
            @if (hiddenChanges() > 0) {
              <li>and {{ hiddenChanges() }} more</li>
            }
          </ul>
        }
        @if (diff().length) {
          <details class="sdu-details">
            <summary>Line changes ({{ diff().length }})</summary>
            <ul class="sdu-diff">
              @for (l of diff().slice(0, maxLines); track $index) {
                <li [class]="l.op === 'add' ? 'sdu-diff-add' : 'sdu-diff-del'">
                  <span class="sdu-visually-hidden">{{ l.op === 'add' ? 'Added: ' : 'Removed: ' }}</span>{{ l.text }}
                </li>
              }
            </ul>
          </details>
        }
      </div>
    }
    <details class="sdu-details">
      <summary>Input ({{ count(trace().input) }} characters)</summary>
      <pre class="sdu-output" tabindex="0">{{ trace().input }}</pre>
    </details>
    @if (trace().noOutputPanel) {
      <p class="sdu-muted">This tool shows a report, so its result is not passed on.</p>
    }
    <details class="sdu-details" [open]="!trace().error">
      <summary>{{ trace().noOutputPanel ? 'Report' : 'Output' }} ({{ count(trace().output) }} characters)</summary>
      <pre class="sdu-output" tabindex="0" data-role="output">{{ trace().output }}</pre>
    </details>
    @if (trace().truncated) {
      <p class="sdu-muted">Long values were cut before they were stored.</p>
    }
  `,
})
export class SduStepDetailComponent {
  readonly trace = input.required<RecipeTraceStep>()
  protected readonly maxLines = SHOW_DIFF_LINES
  protected readonly change = computed(() => describeStep(this.trace().input, this.trace().output))
  protected readonly jsonChanges = computed(() => this.change().json?.changes.slice(0, SHOW_CHANGES) ?? [])
  protected readonly hiddenChanges = computed(() => {
    const j = this.change().json
    return j ? j.changes.length - this.jsonChanges().length + j.more : 0
  })
  protected readonly diff = computed(() => (this.change().lines ?? []).filter((l) => l.op !== 'same'))
  protected count(s: string): string {
    return s.length.toLocaleString('en-US')
  }
}
