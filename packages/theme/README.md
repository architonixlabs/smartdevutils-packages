# @smartdevutils/theme

The CSS shared by the SmartDevUtils UI packages (`@smartdevutils/elements`, `@smartdevutils/angular` and the `Sdu*` components of `@smartdevutils/react`): design tokens as CSS custom properties, light and dark, and a small set of plain class names. You do not need Tailwind or any build step.

## Install

```bash
npm i @smartdevutils/theme
```

The UI packages install it for you. Install it yourself only to load the stylesheet in a page or to read the token values.

## Files

| Import | What it holds |
|--------|---------------|
| `@smartdevutils/theme/tokens.css` | The `--sdu-*` custom properties for light and dark |
| `@smartdevutils/theme/base.css` | The `.sdu-*` classes (`.sdu-root`, `.sdu-btn`, `.sdu-textarea`, `.sdu-tabs`, `.sdu-output`, `.sdu-error`, `.sdu-steps`, …) |
| `@smartdevutils/theme/styles.css` | Both, in that order |
| `@smartdevutils/theme` (JS) | The same CSS as strings (`stylesCss`, `baseCss`, `tokensCss`, `hostCss` for Shadow DOM) and the token values (`TOKENS`, `TOKEN_NAMES`) |

- **React:** `import '@smartdevutils/theme/styles.css'` once, for example in `main.tsx`.
- **Angular:** nothing to do. The components add `styles.css` to the page once, the first time one of them renders, including during server rendering.
- **Web Components:** nothing to do. Each element carries the styles in its shadow root. Loading `tokens.css` in the page is optional (see below).

## Light and dark

The colour scheme is chosen in this order:

1. `data-theme="light"` or `data-theme="dark"` on the element or any ancestor, for example `<html data-theme="dark">`;
2. otherwise the OS setting (`prefers-color-scheme`).

Components also take a `theme` input or attribute (`light`, `dark` or `auto`), which sets `data-theme` on that component only.

## Tokens

| Token | Light | Dark | Used for |
|-------|-------|------|----------|
| `--sdu-bg` | `#ffffff` | `#14161a` | Component background |
| `--sdu-surface` | `#f5f6f8` | `#1d2026` | Output panels, buttons |
| `--sdu-fg` | `#1a1d23` | `#e8eaed` | Text |
| `--sdu-muted` | `#545d6b` | `#a6aebb` | Secondary text |
| `--sdu-border` | `#c9ced6` | `#3d434e` | Borders |
| `--sdu-accent` | `#1d4ed8` | `#86a8ff` | Primary button, selected tab |
| `--sdu-accent-fg` | `#ffffff` | `#0b1020` | Text on the accent |
| `--sdu-danger`, `--sdu-danger-bg` | `#b42318`, `#fef3f2` | `#ff8f85`, `#3b1b19` | Errors |
| `--sdu-success` | `#067647` | `#74d69d` | Finished runs |
| `--sdu-add-bg`, `--sdu-del-bg` | `#e3f4e8`, `#fde8e6` | `#173522`, `#3d1e1c` | Line diffs |
| `--sdu-focus` | `#1d4ed8` | `#86a8ff` | Focus ring |
| `--sdu-font`, `--sdu-font-mono` | system UI and monospace stacks | same | Text and code |
| `--sdu-font-size`, `--sdu-radius`, `--sdu-gap` | `14px`, `6px`, `0.75rem` | same | Size and spacing |

Text colours meet WCAG AA contrast (4.5:1) on `--sdu-bg` and `--sdu-surface` in both themes. The tests check this.

## Restyling

Set any token wherever you like. The tokens in `tokens.css` use `:where()`, which has zero specificity, so your rule wins whatever the load order:

```css
:root { --sdu-accent: #0f766e; --sdu-radius: 10px; }
[data-theme='dark'] { --sdu-accent: #5eead4; }
.sidebar sdu-tool { --sdu-font-size: 13px; }
```

The custom properties pass into the Web Components' shadow roots, so the same rules restyle all three UI packages.

How Shadow DOM gets its defaults: inside each element, `host.css` sets fallback values (`--sdu-d-*`), and the `.sdu-root` class reads your `--sdu-*` value first and the fallback second. So the elements look right with no page CSS at all, and still pick up any token you set.

## Licence

MIT © ArchitonixLabs
