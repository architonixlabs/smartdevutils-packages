// Shared contract: the docs data scripts/build-docs.mjs writes to src/assets/docs.json and the UI reads.
// Change this file first, then the generator and the UI.

/** ts/js run as a module in the sandbox; tsx runs with React; html is placed in the preview body. */
export type SnippetLang = 'ts' | 'js' | 'tsx' | 'html'

/** Where a run shows its result. */
export type SnippetOutput = 'console' | 'preview'

/** How the snippet can be used in the playground. `docs` = shown and copyable, not runnable here (Angular). */
export type SnippetMode = 'run' | 'docs'

export interface Snippet {
  /** Unique within its entry. */
  id: string
  title: string
  lang: SnippetLang
  code: string
  mode: SnippetMode
  output: SnippetOutput
  description?: string
  /** `readme` = taken from the package README, `generated` = built from types/specs, `curated` = snippets/ folder. */
  source: 'readme' | 'generated' | 'curated'
  /** Runs without a DOM, so the test suite executes it in Node. */
  node?: boolean
}

export type ApiKind =
  | 'function'
  | 'class'
  | 'const'
  | 'type'
  | 'interface'
  | 'enum'
  | 'tool'
  | 'element'
  | 'component'

export interface ApiParam {
  name: string
  type: string
  optional: boolean
  description?: string
}

export interface ApiItem {
  /** URL-safe, unique within its section. */
  id: string
  name: string
  kind: ApiKind
  /** The import path that exposes it, e.g. `@smartdevutils/core/encoding`. */
  module: string
  /** One-line summary (first JSDoc sentence or spec description). */
  summary: string
  /** Full docs as Markdown (JSDoc body, element attributes table, tool options table). */
  docs?: string
  /** TypeScript signature, element tag or component selector. */
  signature?: string
  params?: ApiParam[]
  returns?: string
  /** Website page for tools: https://smartdevutils.com/tools/<slug>. */
  webUrl?: string
  /** Runs only in some environments (tool runtime: dom, network, ...). */
  runtime?: string[]
  deprecated?: string
  snippets: Snippet[]
}

export type SectionKind =
  | 'overview'
  | 'module'
  | 'tools'
  | 'elements'
  | 'components'
  | 'recipes'
  | 'theme'

export interface DocSection {
  /** URL-safe, unique within the package. */
  id: string
  title: string
  kind: SectionKind
  /** Markdown shown above the items (overview: the README). */
  markdown?: string
  items: ApiItem[]
}

export interface PackageDoc {
  /** `@smartdevutils/core` */
  name: string
  /** `core`: the URL segment. */
  id: string
  version: string
  description: string
  /** `npm install @smartdevutils/core` */
  install: string
  /** Export subpaths, e.g. `.`, `./encoding`. */
  exports: string[]
  /** Latest CHANGELOG section as Markdown. */
  changelog?: string
  /** Frameworks this package is for (drives the Integrate tab). */
  frameworks: Array<'node' | 'browser' | 'react' | 'angular' | 'html'>
  sections: DocSection[]
}

export interface PlaygroundDocs {
  /** ISO timestamp of the build. */
  generatedAt: string
  /** Shared version of all @smartdevutils packages (they release in lockstep). */
  version: string
  packages: PackageDoc[]
}
