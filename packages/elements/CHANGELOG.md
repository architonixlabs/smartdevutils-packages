# @smartdevutils/elements

## 1.3.1

### Patch Changes

- Updated dependencies
  - @smartdevutils/core@1.3.1
  - @smartdevutils/browser@1.3.1
  - @smartdevutils/recipes@1.3.1
  - @smartdevutils/theme@1.3.1

## 1.3.0

### Patch Changes

- Version aligned with the other @smartdevutils packages: every package now ships under one shared version. No API change from 0.1.0.

## 0.1.0

### Minor Changes

- First release of `@smartdevutils/elements`, Web Components built with Lit.
  - `<sdu-tool tool="…">`: a form for any tool with a runner in `@smartdevutils/core/tools`, built from its `ToolSpec`: mode tabs (arrow keys, Home, End), the tool's settings, input, output with Copy and Download, and an error state. Attributes `tool`, `mode`, `value`, `label`, `manual`, `readonly`, `compact`, `theme`; properties `input`/`value` and `options`; methods `run()` and `setInput()`; events `sdu-ready`, `sdu-output` and `sdu-error`.
  - Ready-made tool elements: `<sdu-json-formatter>`, `<sdu-base64>`, `<sdu-url-encoder>`, `<sdu-hash-generator>`, `<sdu-uuid-generator>`.
  - `<sdu-diagram>`: draws Mermaid source (attribute or text content). Mermaid loads on first use, in the browser only, with `securityLevel: 'strict'`. SVG and PNG download; the theme follows the page. Event `sdu-rendered`.
  - `<sdu-recipe recipe="…">`: runs a built-in recipe (or your own `steps`) in the page, shows each step's input, output and "what changed", lets you edit a step and run again from it, and downloads and uploads `sdu-recipe-run/1` run files. Events `sdu-ready`, `sdu-step`, `sdu-run`, `sdu-error`.
  - `<sdu-recipe-run>`: shows a run from a `RecipeRun`, run file text, a URL, or an uploaded file.
  - Shadow DOM with `::part()` hooks and the `--sdu-*` custom properties. The colour scheme follows the `theme` attribute, then the nearest `data-theme`, then the OS.
  - Builds: one ES module per element (`@smartdevutils/elements/tool`, …) and a single-file CDN build, `dist/cdn/sdu-elements.js`, that registers every element and loads tool runners and the recipe engine on first use. Registering is idempotent. `custom-elements.json` is included.

### Patch Changes

- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
  - @smartdevutils/browser@1.1.0
  - @smartdevutils/core@1.3.0
  - @smartdevutils/recipes@0.1.0
  - @smartdevutils/theme@0.1.0
