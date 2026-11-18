/**
 * The tool runner contract: one spec and one `run()` per SmartDevUtils tool, so any code
 * (a Node script, a recipe engine, a web component, an Angular or React wrapper) can run
 * "tool X in mode Y with options Z" without the website.
 */

/** The website's tool types. They decide what can be piped into what (see canPipe in @smartdevutils/recipes). */
export type ToolType = 'bidirectional' | 'single' | 'generator' | 'analyzer' | 'formatter' | 'compare'

/** One mode of a tool, as on the website (an "Encode" / "Decode" tab). */
export interface ToolModeSpec {
  id: string
  label: string
  inputLabel?: string
  outputLabel?: string
}

/** Light metadata for every website tool, runnable or not (see `@smartdevutils/core/tools/catalog`). */
export interface ToolCatalogEntry {
  id: string
  /** The website path segment: https://smartdevutils.com/tools/<slug>. Run files refer to tools by slug. */
  slug: string
  name: string
  category: string
  toolType: ToolType
  description: string
  modes: readonly ToolModeSpec[]
}

/** What the main input is. `none` means the tool generates from its options alone. */
export type ToolInputKind = 'text' | 'json' | 'yaml' | 'sql' | 'csv' | 'log' | 'none'

/**
 * One setting of a tool. Keys are the same names the website uses for the setting
 * (recipe `options` and the website's component fields), so a recipe means the same thing
 * on the website and headless.
 */
export interface ToolOptionSpec {
  key: string
  label: string
  type: 'select' | 'text' | 'textarea' | 'number' | 'boolean' | 'json'
  default?: unknown
  /** For `select`. */
  choices?: readonly { value: string; label: string }[]
  min?: number
  max?: number
  /** Only applies in these modes. */
  modes?: readonly string[]
  description?: string
}

/** Where a tool can run. A runner with no `runtime` entry runs anywhere (Node 20+, browsers, workers, edge). */
export type ToolRuntime = 'dom' | 'worker' | 'wasm' | 'network' | 'canvas' | 'speech'

export interface ToolSpec {
  id: string
  slug: string
  name: string
  category: string
  toolType: ToolType
  /** Same ids as the website. Empty for a tool with a single behaviour. */
  modes: readonly ToolModeSpec[]
  /** The mode used when `run()` gets none: the website's first mode. */
  defaultMode?: string
  input: { kind: ToolInputKind; label?: string }
  options: readonly ToolOptionSpec[]
  /**
   * `text`: `output` is the value the website shows in its output panel, ready to pipe on.
   * `report`: `output` is a readable report and `meta` holds the same findings as data.
   */
  output: 'text' | 'report'
  runtime?: readonly ToolRuntime[]
}

export interface ToolRunContext {
  /** One of `spec.modes[].id`. Defaults to `spec.defaultMode`. */
  mode?: string
  /** Keyed by `spec.options[].key`. Unknown keys are ignored. */
  options?: Record<string, unknown>
  signal?: AbortSignal
}

/**
 * `output` is always a string ('' when there is nothing to show). `error` is set when the
 * input could not be processed; `output` is then usually ''. `meta` carries structured data
 * (parsed values, findings, counts) for generic UIs.
 */
export interface ToolRunResult {
  output: string
  error?: string
  meta?: Record<string, unknown>
}

export interface ToolRunner {
  spec: ToolSpec
  /** Never throws for bad input: problems come back as `error`. May return a Promise. */
  run(input: string, ctx?: ToolRunContext): ToolRunResult | Promise<ToolRunResult>
}
