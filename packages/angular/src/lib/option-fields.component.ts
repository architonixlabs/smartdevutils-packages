import { ChangeDetectionStrategy, Component, input, output } from '@angular/core'
import type { ToolOptionSpec } from '@smartdevutils/core/tools'

export interface SduOptionChange {
  key: string
  value: unknown
}

/** The settings form of a tool, built from its spec. Used inside SduToolComponent and the recipe step editor. */
@Component({
  selector: 'sdu-option-fields',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'sdu-options', '[hidden]': '!options().length' },
  template: `
    @for (o of options(); track o.key) {
      @switch (o.type) {
        @case ('boolean') {
          <label class="sdu-check" [attr.title]="o.description ?? null">
            <input [id]="idPrefix() + '-' + o.key" type="checkbox" [checked]="!!values()[o.key]" (change)="emit(o, $event)" />
            {{ o.label }}
          </label>
        }
        @case ('select') {
          <div class="sdu-field">
            <label class="sdu-label" [for]="idPrefix() + '-' + o.key">{{ o.label }}</label>
            <select [id]="idPrefix() + '-' + o.key" class="sdu-select" [attr.title]="o.description ?? null" (change)="emit(o, $event)">
              @for (c of o.choices ?? []; track c.value) {
                <option [value]="c.value" [selected]="shown(o) === c.value">{{ c.label }}</option>
              }
            </select>
          </div>
        }
        @case ('textarea') {
          <div class="sdu-field sdu-field-wide">
            <label class="sdu-label" [for]="idPrefix() + '-' + o.key">{{ o.label }}</label>
            <textarea [id]="idPrefix() + '-' + o.key" class="sdu-textarea" rows="3" spellcheck="false" [value]="shown(o)" (input)="emit(o, $event)"></textarea>
          </div>
        }
        @case ('json') {
          <div class="sdu-field sdu-field-wide">
            <label class="sdu-label" [for]="idPrefix() + '-' + o.key">{{ o.label }}</label>
            <textarea [id]="idPrefix() + '-' + o.key" class="sdu-textarea" rows="3" spellcheck="false" [value]="shown(o)" (input)="emit(o, $event)"></textarea>
          </div>
        }
        @default {
          <div class="sdu-field">
            <label class="sdu-label" [for]="idPrefix() + '-' + o.key">{{ o.label }}</label>
            <input
              [id]="idPrefix() + '-' + o.key"
              class="sdu-input"
              [type]="o.type === 'number' ? 'number' : 'text'"
              [attr.min]="o.min ?? null"
              [attr.max]="o.max ?? null"
              [attr.title]="o.description ?? null"
              spellcheck="false"
              [value]="shown(o)"
              (input)="emit(o, $event)"
            />
          </div>
        }
      }
    }
  `,
})
export class SduOptionFieldsComponent {
  readonly options = input.required<readonly ToolOptionSpec[]>()
  readonly values = input.required<Record<string, unknown>>()
  readonly idPrefix = input.required<string>()
  readonly optionChange = output<SduOptionChange>()

  shown(o: ToolOptionSpec): string {
    const v = this.values()[o.key]
    if (v === undefined || v === null) return ''
    return o.type === 'json' && typeof v !== 'string' ? JSON.stringify(v, null, 2) : String(v)
  }

  emit(o: ToolOptionSpec, e: Event): void {
    const el = e.target as HTMLInputElement
    let value: unknown = el.value
    if (o.type === 'boolean') value = el.checked
    else if (o.type === 'number') value = el.value.trim() === '' ? undefined : Number(el.value)
    else if (o.type === 'json') {
      try {
        value = JSON.parse(el.value)
      } catch {
        value = el.value
      }
    }
    this.optionChange.emit({ key: o.key, value })
  }
}
