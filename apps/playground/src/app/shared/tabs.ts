/**
 * Arrow-key handling for an ARIA tablist (automatic activation): Left/Right (and Up/Down) move to the
 * previous/next tab, Home/End to the first/last. Returns the newly selected id, or null.
 */
export function tabKeyNav(e: KeyboardEvent, ids: readonly string[], current: string): string | null {
  const i = ids.indexOf(current)
  if (i < 0 || ids.length < 2) return null
  let next = i
  switch (e.key) {
    case 'ArrowRight':
    case 'ArrowDown':
      next = (i + 1) % ids.length
      break
    case 'ArrowLeft':
    case 'ArrowUp':
      next = (i - 1 + ids.length) % ids.length
      break
    case 'Home':
      next = 0
      break
    case 'End':
      next = ids.length - 1
      break
    default:
      return null
  }
  e.preventDefault()
  return ids[next]
}

/** Moves focus to the tab button with this DOM id after the view updates. */
export function focusTab(domId: string): void {
  setTimeout(() => document.getElementById(domId)?.focus())
}
