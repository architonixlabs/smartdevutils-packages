// The design tokens, one source for every generated stylesheet.
// Public names are --sdu-<name>. Set any of them on :root, on a container, or on one element to restyle.

/** Values that do not change between light and dark. */
export const COMMON = {
  font: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  'font-mono': 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace',
  'font-size': '14px',
  radius: '6px',
  gap: '0.75rem',
}

/** Colours. Text colours meet WCAG AA (4.5:1) on bg and surface in both themes. */
export const LIGHT = {
  bg: '#ffffff',
  surface: '#f5f6f8',
  fg: '#1a1d23',
  muted: '#545d6b',
  border: '#c9ced6',
  accent: '#1d4ed8',
  'accent-fg': '#ffffff',
  danger: '#b42318',
  'danger-bg': '#fef3f2',
  success: '#067647',
  'add-bg': '#e3f4e8',
  'del-bg': '#fde8e6',
  focus: '#1d4ed8',
}

export const DARK = {
  bg: '#14161a',
  surface: '#1d2026',
  fg: '#e8eaed',
  muted: '#a6aebb',
  border: '#3d434e',
  accent: '#86a8ff',
  'accent-fg': '#0b1020',
  danger: '#ff8f85',
  'danger-bg': '#3b1b19',
  success: '#74d69d',
  'add-bg': '#173522',
  'del-bg': '#3d1e1c',
  focus: '#86a8ff',
}

export const TOKEN_NAMES = [...Object.keys(COMMON), ...Object.keys(LIGHT)]
