# @smartdevutils/angular

## 1.3.0

### Patch Changes

- Version aligned with the other @smartdevutils packages: every package now ships under one shared version. No API change from 0.1.0.

## 0.1.0

### Minor Changes

- First release of `@smartdevutils/angular`, standalone components built with ng-packagr (partial Ivy, for Angular 19 to 22).
  - `SduToolComponent` (`<sdu-tool>`): a form for any tool with a runner, with signal inputs, `[(mode)]` and `[(value)]` two-way bindings, `options`, and `(result)` and `(error)` outputs.
  - Ready-made tool components: `SduJsonFormatterComponent`, `SduBase64Component`, `SduUrlEncoderComponent`, `SduHashGeneratorComponent`, `SduUuidGeneratorComponent`.
  - `SduDiagramComponent`, `SduRecipeComponent` and `SduRecipeRunComponent`, matching the elements.
  - `provideSmartDevUtils({ mermaid })` sets where Mermaid comes from.
  - SSR-safe: nothing touches `window` or `document` at import time. Tools also run on the server, so the server HTML holds the output; diagrams are drawn in the browser after hydration.
  - Styles come from `@smartdevutils/theme` and are added once by the components. No Tailwind.

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
