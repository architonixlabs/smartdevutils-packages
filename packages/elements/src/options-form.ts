import { html, nothing, type TemplateResult } from 'lit'
import { live } from 'lit/directives/live.js'
import type { ToolOptionSpec } from '@smartdevutils/core/tools'

/** Reads a form control's value into the type the option expects. */
export function readOptionValue(o: ToolOptionSpec, el: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement): unknown {
  if (o.type === 'boolean') return (el as HTMLInputElement).checked
  if (o.type === 'number') return el.value.trim() === '' ? undefined : Number(el.value)
  if (o.type === 'json') {
    try {
      return JSON.parse(el.value)
    } catch {
      return el.value
    }
  }
  return el.value
}

const show = (v: unknown, o: ToolOptionSpec): string => {
  if (v === undefined || v === null) return ''
  if (o.type === 'json' && typeof v !== 'string') return JSON.stringify(v, null, 2)
  return String(v)
}

/**
 * The fields for a tool's settings. `idPrefix` keeps label/for pairs unique when several forms share
 * one shadow root (a recipe's step editors).
 */
export function renderOptionFields(
  options: readonly ToolOptionSpec[],
  values: Record<string, unknown>,
  onChange: (key: string, value: unknown) => void,
  idPrefix: string,
  disabled = false,
): TemplateResult | typeof nothing {
  if (!options.length) return nothing
  return html`<div class="sdu-options" part="options">
    ${options.map((o) => {
      const id = `${idPrefix}-${o.key}`
      const v = values[o.key]
      const change = (e: Event) =>
        onChange(o.key, readOptionValue(o, e.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement))
      const title = o.description ?? nothing
      switch (o.type) {
        case 'boolean':
          return html`<label class="sdu-check" title=${title}>
            <input id=${id} type="checkbox" .checked=${live(Boolean(v))} ?disabled=${disabled} @change=${change} />
            ${o.label}
          </label>`
        case 'select':
          return html`<div class="sdu-field">
            <label class="sdu-label" for=${id}>${o.label}</label>
            <select id=${id} class="sdu-select" title=${title} ?disabled=${disabled} @change=${change}>
              ${(o.choices ?? []).map(
                (c) => html`<option value=${c.value} ?selected=${String(v ?? '') === c.value}>${c.label}</option>`,
              )}
            </select>
          </div>`
        case 'number':
          return html`<div class="sdu-field">
            <label class="sdu-label" for=${id}>${o.label}</label>
            <input
              id=${id}
              class="sdu-input"
              type="number"
              inputmode="numeric"
              title=${title}
              min=${o.min ?? nothing}
              max=${o.max ?? nothing}
              .value=${live(show(v, o))}
              ?disabled=${disabled}
              @input=${change}
            />
          </div>`
        case 'textarea':
        case 'json':
          return html`<div class="sdu-field sdu-field-wide">
            <label class="sdu-label" for=${id}>${o.label}</label>
            <textarea
              id=${id}
              class="sdu-textarea"
              rows="3"
              spellcheck="false"
              title=${title}
              .value=${live(show(v, o))}
              ?disabled=${disabled}
              @input=${change}
            ></textarea>
          </div>`
        default:
          return html`<div class="sdu-field">
            <label class="sdu-label" for=${id}>${o.label}</label>
            <input
              id=${id}
              class="sdu-input"
              type="text"
              spellcheck="false"
              title=${title}
              .value=${live(show(v, o))}
              ?disabled=${disabled}
              @input=${change}
            />
          </div>`
      }
    })}
  </div>`
}

/** Moves focus and selection along a tab list with the arrow keys, Home and End (WAI-ARIA tabs pattern). */
export function tabKeydown(e: KeyboardEvent, ids: readonly string[], current: string, select: (id: string) => void): void {
  const i = ids.indexOf(current)
  let next = -1
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (i + 1) % ids.length
  else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (i - 1 + ids.length) % ids.length
  else if (e.key === 'Home') next = 0
  else if (e.key === 'End') next = ids.length - 1
  if (next < 0) return
  e.preventDefault()
  select(ids[next]!)
  const list = (e.currentTarget as HTMLElement | null) ?? null
  queueMicrotask(() => list?.querySelector<HTMLElement>(`[data-mode="${ids[next]}"]`)?.focus())
}
