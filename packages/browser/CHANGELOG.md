# @smartdevutils/browser

## 1.3.1

### Patch Changes

- Updated dependencies
  - @smartdevutils/core@1.3.1

## 1.3.0

### Patch Changes

- Version aligned with the other @smartdevutils packages: every package now ships under one shared version. No API change from 1.1.0.

## 1.1.0

### Minor Changes

- New `@smartdevutils/browser/mermaid`: lazy Mermaid rendering shared by the UI packages. `renderMermaid(source, { dark })` always uses `securityLevel: 'strict'` and SVG text labels, runs renders one at a time and never throws. `setMermaidLoader()` or `setMermaidUrl()` choose where Mermaid comes from (default: a pinned jsDelivr build; `globalThis.SDU_MERMAID_URL` also works). Also `svgToPng`, `svgSize` and `prefersDark`.

  `file`: new `downloadText(text, filename, type)`. `downloadBlob` now adds the link to the page before clicking it and revokes the object URL a second later, so the download also starts in browsers that start it after `click()` returns.

### Patch Changes

- axe-core, DOMPurify, qrcode and ua-parser-js are no longer copied into `dist`. They load from `dependencies`, so `accessibility.js` drops from 1,413 kB to 1 kB and the root entry from 1,527 kB to 6 kB (raw). axe-core (MPL-2.0) is now used as a normal dependency instead of being shipped inside this package. The `@smartdevutils/core` dependency is published as a `^` range. `"sideEffects": false`; Node 20.19 or later.
- Updated dependencies
- Updated dependencies
  - @smartdevutils/core@1.3.0
