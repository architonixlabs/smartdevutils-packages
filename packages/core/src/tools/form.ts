import type { ToolOptionSpec, ToolSpec } from './types'

/** The settings that apply in a mode (those without `modes`, plus those listing it). For generic forms. */
export function optionsForMode(spec: ToolSpec, mode?: string): ToolOptionSpec[] {
  const m = mode ?? spec.defaultMode ?? ''
  return spec.options.filter((o) => !o.modes || o.modes.includes(m))
}

/** The labels a form shows for a mode: input and output panel titles, with plain fallbacks. */
export function modeLabels(spec: ToolSpec, mode?: string): { input: string; output: string } {
  const m = spec.modes.find((x) => x.id === (mode ?? spec.defaultMode)) ?? spec.modes[0]
  return {
    input: m?.inputLabel ?? spec.input.label ?? 'Input',
    output: m?.outputLabel ?? (spec.output === 'report' ? 'Report' : 'Output'),
  }
}

/** The settings with their spec defaults filled in, for a form's starting state. */
export function defaultOptions(spec: ToolSpec): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const o of spec.options) if (o.default !== undefined) out[o.key] = o.default
  return out
}
