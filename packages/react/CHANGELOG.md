# @smartdevutils/react

## 1.3.0

### Minor Changes

- New generic components on the core tool runners, the recipe engine and Mermaid, matching `@smartdevutils/elements` and `@smartdevutils/angular`:
  - `SduTool`: a form for any tool with a runner, controlled (`value`/`onChange`, `mode`/`onModeChange`) or uncontrolled (`defaultValue`, `defaultMode`), with `options`, `onResult` and `onError`.
  - `SduDiagram`: draws Mermaid source in the browser (`securityLevel: 'strict'`), with SVG and PNG download.
  - `SduRecipe` and `SduRecipeRun`: run a recipe step by step with "what changed", edit a step and run again from it, and download or upload run files.
  - They use the `.sdu-*` classes: import `@smartdevutils/theme/styles.css` once. The existing 36 components are unchanged.
  - `setMermaidLoader`, `setMermaidUrl` and `MERMAID_CDN_URL` are re-exported from `@smartdevutils/browser/mermaid`.

### Patch Changes

- `@smartdevutils/core` and `@smartdevutils/browser` are no longer copied into `dist/index.js`. Subpath imports such as `@smartdevutils/core/hashing` were matched only by exact name before, so all of core, including faker, was bundled. They are now real imports of the dependencies. `dist/index.js` drops from 1,924 kB to 78 kB (raw, 470 kB to 12 kB gzip). The core and browser dependencies are published as `^` ranges. `"sideEffects": false`; Node 20.19 or later.
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
