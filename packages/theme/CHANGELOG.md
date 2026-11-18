# @smartdevutils/theme

## 0.1.0

### Minor Changes

- First release of `@smartdevutils/theme`, the CSS that the SmartDevUtils UI packages share. No Tailwind or build step is needed.
  - `tokens.css`: the `--sdu-*` custom properties (colours, fonts, radius, spacing) for light and dark. Dark mode follows `prefers-color-scheme`, and `data-theme="light"` or `data-theme="dark"` on any ancestor overrides it. The tokens use `:where()`, so any rule of yours wins whatever the load order.
  - `base.css`: the `.sdu-*` classes used by the Angular and React components.
  - `styles.css`: both files together.
  - The JavaScript entry exports the same CSS as strings (`stylesCss`, `baseCss`, `tokensCss`, and `hostCss` for Shadow DOM) and the token values (`TOKENS`).
  - Text colours meet WCAG AA contrast (4.5:1) in both themes; a test checks this.
