# @smartdevutils/elements

SmartDevUtils tools, recipes and diagrams as Web Components, built with [Lit](https://lit.dev). They work in plain HTML and in any framework: Vue, Svelte, Angular, React, or a CMS page.

| Element | What it does |
|---------|--------------|
| `<sdu-tool tool="…">` | A form for any tool that has a runner in `@smartdevutils/core/tools`: mode tabs, the tool's settings, input, output with Copy and Download |
| `<sdu-json-formatter>`, `<sdu-base64>`, `<sdu-url-encoder>`, `<sdu-hash-generator>`, `<sdu-uuid-generator>` | `<sdu-tool>` fixed to one tool |
| `<sdu-diagram>` | Draws Mermaid source as SVG, with SVG and PNG download |
| `<sdu-recipe recipe="…">` | Runs a recipe step by step in the page, with "what changed" per step, step editing and run files |
| `<sdu-recipe-run>` | Shows a recipe run, from a run object, run file text, a URL or an upload |

## Install

**With a bundler:**

```bash
npm i @smartdevutils/elements
```

```js
import '@smartdevutils/elements'            // registers every element
// or only what you use:
import '@smartdevutils/elements/tool'       // <sdu-tool>
import '@smartdevutils/elements/diagram'    // <sdu-diagram>
import '@smartdevutils/elements/recipe'     // <sdu-recipe>
```

**From a CDN, with no build step:** one script tag registers every element. Tool runners and the recipe engine are separate files, fetched the first time an element needs them.

```html
<script type="module" src="https://cdn.jsdelivr.net/npm/@smartdevutils/elements@1/dist/cdn/sdu-elements.js"></script>
```

To self-host instead of using the CDN, copy `dist/cdn/` to your own server (see `examples/plain-html-cdn`).

Registering is idempotent: loading two bundles that both contain the elements does not throw, and the first registration is kept.

## `<sdu-tool>`

```html
<sdu-tool tool="base64-encoder-decoder" mode="decode" value="aGVsbG8="></sdu-tool>

<script type="module">
  const el = document.querySelector('sdu-tool')
  el.options = { variant: 'urlsafe' }                  // settings: property only
  el.addEventListener('sdu-output', (e) => console.log(e.detail.output, e.detail.error))
  await el.setInput('aGk=', { mode: 'decode' })        // set input and run
</script>
```

| Attribute / property | |
|---|---|
| `tool` | Tool id or website slug. Required |
| `mode` | One of the tool's mode ids; the first mode by default |
| `value` (property also `input`) | The input text |
| `options` (property only) | Settings keyed by the spec's option keys. Setting it resets edits made in the form |
| `manual` | Run only on the Run button or `run()`. Without it the tool runs as you type (after 200 ms) |
| `readonly`, `compact` (no heading), `label` (heading text), `theme` (`light`, `dark`, `auto`) | |

Methods: `run()` and `setInput(text, { mode, options })`, both returning `{ output, error?, meta? }`. The `ready` promise resolves when the tool's spec has loaded.

Events (they bubble and cross shadow roots): `sdu-ready` `{ tool, spec }`, `sdu-output` `{ tool, mode, output, error?, meta? }` and `sdu-error` `{ tool, mode, error }`.

Report tools (analyzers) show their report in the output panel and their findings as JSON under "Findings as JSON".

## `<sdu-diagram>`

```html
<sdu-diagram label="Deploy flow" source="graph LR; Build-->Test-->Deploy"></sdu-diagram>

<sdu-diagram label="Pipeline">
graph LR
  A[Push] --> B[Test] --> C[Deploy]
</sdu-diagram>
```

- The source comes from the `source` attribute or property, otherwise from the element's text content.
- Mermaid is not bundled. It is loaded on first use, in the browser only, and always runs with `securityLevel: 'strict'` and SVG text labels (no HTML in labels). Sources over 50,000 characters are refused.
- Where Mermaid comes from:
  - by default, a pinned jsDelivr build (`MERMAID_CDN_URL`);
  - `window.SDU_MERMAID_URL = '/assets/mermaid.esm.min.mjs'` before the elements load, to self-host it;
  - `setMermaidLoader(() => import('mermaid'))` to use the `mermaid` package your bundler installs (an optional peer dependency, `^11 || ^12`).
- The diagram is redrawn when the theme changes: the `theme` attribute, then the nearest `data-theme`, then the OS setting.
- Buttons download SVG and PNG. Methods `toSvg()` and `toPng()`; property `rendered` (a promise). Event `sdu-rendered` `{ ok, error? }`.

## `<sdu-recipe>` and `<sdu-recipe-run>`

```html
<sdu-recipe recipe="decode-base64-json-param"></sdu-recipe>
<sdu-recipe-run upload></sdu-recipe-run>

<script type="module">
  const recipe = document.querySelector('sdu-recipe')
  recipe.addEventListener('sdu-run', (e) => (document.querySelector('sdu-recipe-run').run = e.detail.run))
</script>
```

`<sdu-recipe>`:

- shows the steps and an input for step 1, filled with the recipe's synthetic sample;
- **Run all steps** pipes each step's output into the next, using `@smartdevutils/recipes`;
- shows, per step, its input and output and what changed, for example "Same JSON values, reformatted (1 -> 4 lines); 29 -> 38 characters.", with the JSON values that changed and a line diff;
- **Edit step N** changes a step's mode, settings or input, then **Run from this step** runs that step and the ones after it;
- **Download run** saves an `sdu-recipe-run/1` file that smartdevutils.com/recipes/run can upload. **Upload run** reads one, including files downloaded from the website.

Attributes: `recipe` (or `recipe-id`), `input`, `label`, `theme`. Property `steps` takes your own chain instead (`[{ toolId, mode?, options? }]`, with `name`). Methods: `runAll()`, `runFrom(index, { input?, mode?, options? })`, `runFileText()`, `loadRunFile(text)`. Events: `sdu-ready`, `sdu-step` `{ index, step, trace }`, `sdu-run` `{ run }`, `sdu-error` `{ error }`.

A recipe that uses a tool without a runner shows which tools are missing and keeps Run disabled.

`<sdu-recipe-run>` shows a run read-only. Give it a run with the `run` property, the text of a run file with `file-text`, or a URL with `src`. `upload` adds an Upload button. Run files are treated as untrusted: they must be 2 MB or less and match the schema exactly, and tools are looked up by slug in the catalog.

## Theming

- The elements use Shadow DOM (open) and work with no page CSS.
- Restyle them with the `--sdu-*` custom properties from `@smartdevutils/theme`, which pass into the shadow roots: `sdu-tool { --sdu-accent: #0f766e; }`.
- For deeper changes use `::part()`: `root`, `tabs`, `options`, `input`, `toolbar`, `button`, `output`, `error`, `diagram`, `steps`, `step`, `editor` and `change`.
- Dark mode follows the `theme` attribute, then the nearest `data-theme="light|dark"` on any ancestor, then the OS. The element writes the result to `data-sdu-scheme`.

## Frameworks

- **Vue:** tell the compiler the tags are custom elements: `vue({ template: { compilerOptions: { isCustomElement: (t) => t.startsWith('sdu-') } } })`. Then `:value="text"`, `@sdu-output="onOutput"`. See `examples/vue-vite`.
- **React 19:** custom elements work directly. On React 18 set `options` through a ref. `@smartdevutils/react` has native components with the same features.
- **Angular:** add `CUSTOM_ELEMENTS_SCHEMA`, or use `@smartdevutils/angular`. Do not load both on one page: they use the same `sdu-*` tag names.
- **Server rendering:** the modules can be imported in Node (registration is skipped when there is no `customElements`), but the elements render only in the browser.

## Accessibility

- Every field has a label.
- Mode tabs follow the WAI-ARIA tabs pattern: arrow keys, Home and End, with a roving tab index.
- Errors use `role="alert"`, and status messages use a polite live region.
- The output is a focusable, labelled region.
- The diagram has `role="img"` with its label as the accessible name. Its source is available in a disclosure below it.

## What can run

Tools with runners in `@smartdevutils/core` (20): `base64-encoder-decoder`, `url-encoder-decoder`, `json-formatter`, `hash-generator`, `uuid-generator`, `sql-create-table`, `ddl-diff`, `index-advisor`, `slow-query-detector`, `migration-generator`, `cicd-pipeline-builder`, `k8s-yaml-validator`, `docker-tag-checker`, `log-parser`, `system-prompt-analyzer`, `training-data-formatter`, `gantt-generator`, `sprint-velocity`, `boundary-value-analyzer`, `performance-sla-checker`.

Built-in recipes that run in the page today: `decode-base64-json-param` and `json-to-base64-env`. The other 53 show which tools they still need. More become runnable as core adds runners, with no change to this package.

## Licence

MIT © ArchitonixLabs
