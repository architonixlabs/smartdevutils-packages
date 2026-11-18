# @smartdevutils/angular

Angular standalone components for SmartDevUtils tools, recipes and Mermaid diagrams. They use signal inputs and outputs, work with zone.js or zoneless change detection, are safe for server rendering, and do not need Tailwind.

| Component | Selector | What it does |
|-----------|----------|--------------|
| `SduToolComponent` | `sdu-tool` | A form for any tool that has a runner in `@smartdevutils/core/tools` |
| `SduJsonFormatterComponent`, `SduBase64Component`, `SduUrlEncoderComponent`, `SduHashGeneratorComponent`, `SduUuidGeneratorComponent` | `sdu-json-formatter`, `sdu-base64`, `sdu-url-encoder`, `sdu-hash-generator`, `sdu-uuid-generator` | `sdu-tool` fixed to one tool |
| `SduDiagramComponent` | `sdu-diagram` | Draws Mermaid source, with SVG and PNG download |
| `SduRecipeComponent` | `sdu-recipe` | Runs a recipe step by step, with "what changed", step editing and run files |
| `SduRecipeRunComponent` | `sdu-recipe-run` | Shows a recipe run, or one uploaded as a file |

## Install

```bash
npm i @smartdevutils/angular
```

- Angular 19, 20, 21 and 22 are supported (peer range `^19.0.0 || ^20.0.0 || ^21.0.0 || ^22.0.0`).
- The package is built with Angular 19 in partial-Ivy mode (Angular Package Format), and your app's Angular compiler finishes it. Angular 19 is the floor because signal inputs, `model()` and `output()` are stable there, and 17 and 18 are past Angular's support window.
- `@smartdevutils/core`, `@smartdevutils/recipes`, `@smartdevutils/browser` and `@smartdevutils/theme` are installed with it.

## Usage

```ts
import { Component, signal } from '@angular/core'
import { SduToolComponent, SduDiagramComponent, SduRecipeComponent, SduRecipeRunComponent, type SduToolResult } from '@smartdevutils/angular'
import type { RecipeRun } from '@smartdevutils/recipes'

@Component({
  selector: 'app-tools',
  imports: [SduToolComponent, SduDiagramComponent, SduRecipeComponent, SduRecipeRunComponent],
  template: `
    <sdu-tool tool="json-formatter" mode="format" [(value)]="json" (result)="onResult($event)" />
    <sdu-diagram [source]="flow" label="Release flow" />
    <sdu-recipe recipe="decode-base64-json-param" (run)="lastRun.set($event)" />
    <sdu-recipe-run [run]="lastRun()" upload />
  `,
})
export class ToolsComponent {
  json = signal('{"service":"billing"}')
  lastRun = signal<RecipeRun | null>(null)
  flow = 'graph LR; Commit-->Test-->Deploy'
  onResult(r: SduToolResult) { console.log(r.output, r.error) }
}
```

### `sdu-tool`

| Input / output | |
|---|---|
| `tool` (required) | Tool id or website slug |
| `[(mode)]`, `[(value)]` | Two-way: the mode id and the input text |
| `options` | Settings keyed by the spec's option keys. A new object resets edits made in the form |
| `manual` | Run only on the Run button or `run()`. Without it the tool runs as you type (after 200 ms) |
| `readonly`, `compact` (no heading), `label`, `theme` (`light`, `dark`, `auto`) | |
| `(result)`, `(error)` | `{ tool, mode, output, error?, meta? }` after each run |

The ready-made components take the same inputs and outputs, without `tool`. For example: `<sdu-base64 mode="decode" [(value)]="text" />`.

### `sdu-recipe` and `sdu-recipe-run`

- `sdu-recipe` takes `recipe` (a built-in id) or `steps` (`[{ toolId, mode?, options? }]`, with `name`), plus `input` (default: the recipe's synthetic sample), `label` and `theme`.
- It emits `(step)` `{ index, step, trace }` and `(run)` with the finished `RecipeRun`.
- Public methods: `runAll()`, `runFrom(index, { input?, mode?, options? })`, `runFileText()` and `loadRunFile(text)`. The signal `current` holds the current run.
- Each step can be edited (mode, settings, input) and the run continued from it.
- **Download run** writes an `sdu-recipe-run/1` file, which smartdevutils.com can upload. **Upload run** reads one.
- `sdu-recipe-run` takes `run` or `fileText`, plus `upload`, `label` and `theme`. It emits `(loaded)` and `(failed)`.

### Mermaid

Mermaid is not bundled. It is loaded the first time a diagram is drawn, in the browser only, and always runs with `securityLevel: 'strict'` and SVG text labels. To use the `mermaid` package from your own install (an optional peer, `^11 || ^12`) instead of the default pinned jsDelivr build:

```ts
import { provideSmartDevUtils } from '@smartdevutils/angular'

bootstrapApplication(App, {
  providers: [provideSmartDevUtils({ mermaid: () => import('mermaid') })], // or { mermaidUrl: '/assets/mermaid.esm.min.mjs' }
})
```

The Angular CLI warns about CommonJS dependencies of Mermaid and of some core runners. List them in `angular.json` under `allowedCommonJsDependencies` if you want a quiet build: `crypto-js`, `he`, `js-beautify`, `@braintree/sanitize-url`, `cytoscape-cose-bilkent`, `cytoscape-fcose`, `dayjs` and `elkjs`.

## Server rendering

- Nothing touches `window` or `document` when the package is imported or when a component is created on the server.
- **Tools run on the server too.** The runners are pure functions, and each run is registered with Angular's `PendingTasks`, so the server waits for it. The HTML the server sends already holds the output. `examples/angular-22-ssr` checks this.
- **Diagrams are drawn only in the browser,** after hydration (`afterNextRender`). The server sends the frame and the diagram source.
- **Recipes run when the visitor presses Run,** so nothing runs on the server.
- Clipboard and download code runs only from clicks.
- Ids for label/for pairs come from a counter in the root injector, so each request numbers from 1, the same as the browser.

## Theming

- The components add the `@smartdevutils/theme` stylesheet to the page once, the first time one of them renders, including during server rendering.
- Restyle with the `--sdu-*` custom properties, for example `:root { --sdu-accent: #0f766e }`. The tokens have zero specificity, so your values win.
- Dark mode follows the `theme` input, then `data-theme="light|dark"` on any ancestor, then the OS.
- The `.sdu-*` class names are listed in the theme README.

## Selector names

These components use the same `sdu-*` tag names as `@smartdevutils/elements`. Use one package or the other on a page, not both: a registered custom element and an Angular component with the same tag would both act on it.

## What can run

Tools with runners (20): `base64-encoder-decoder`, `url-encoder-decoder`, `json-formatter`, `hash-generator`, `uuid-generator`, `sql-create-table`, `ddl-diff`, `index-advisor`, `slow-query-detector`, `migration-generator`, `cicd-pipeline-builder`, `k8s-yaml-validator`, `docker-tag-checker`, `log-parser`, `system-prompt-analyzer`, `training-data-formatter`, `gantt-generator`, `sprint-velocity`, `boundary-value-analyzer`, `performance-sla-checker`.

Built-in recipes that run today: `decode-base64-json-param` and `json-to-base64-env`. The others show which tools they still need.

## Development

- `pnpm build` runs ng-packagr (`ng-package.json`, `tsconfig.lib.json`). The output is `dist/`, published from the package root.
- `pnpm test` runs the component tests with vitest and `@analogjs/vite-plugin-angular` (TestBed, jsdom).
- The example apps `examples/angular-19` and `examples/angular-22-ssr` build against this package. `node scripts/e2e-ui.mjs` drives them in Edge.

## Licence

MIT © ArchitonixLabs
