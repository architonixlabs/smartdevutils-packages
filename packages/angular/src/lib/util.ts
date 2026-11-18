import { Injectable, inject } from '@angular/core'

export type SduTheme = 'light' | 'dark' | 'auto'

/** The data-theme attribute value for a theme input: null for `auto`, so the page decides. */
export const themeAttr = (theme: SduTheme): string | null => (theme === 'light' || theme === 'dark' ? theme : null)

export const errorText = (err: unknown): string => (err instanceof Error ? err.message : String(err))

/** A file name made from free text. */
export const fileSlug = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'output'

/**
 * Ids for label/for pairs, unique per component instance. The counter lives in the app's root
 * injector, so each server-rendered request numbers from 1, the same as the browser.
 */
@Injectable({ providedIn: 'root' })
export class SduIdService {
  private n = 0
  next(prefix: string): string {
    return `${prefix}-${++this.n}`
  }
}

/** Call in an injection context (a field initializer or constructor). */
export const nextId = (prefix: string): string => inject(SduIdService).next(prefix)

export function looksLikeJson(text: string): boolean {
  if (!/^\s*[[{]/.test(text)) return false
  try {
    JSON.parse(text)
    return true
  } catch {
    return false
  }
}
