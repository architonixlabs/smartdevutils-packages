import { Injectable, signal } from '@angular/core'

export type ColorScheme = 'light' | 'dark'

const KEY = 'sdu-playground:theme'

/** Light/dark theme: the visitor's choice (persisted) or the OS preference. Sets `<html data-theme>`. */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly scheme = signal<ColorScheme>(this.initial())

  constructor() {
    this.apply(this.scheme())
  }

  toggle(): void {
    const next: ColorScheme = this.scheme() === 'dark' ? 'light' : 'dark'
    this.scheme.set(next)
    this.apply(next)
    try {
      localStorage.setItem(KEY, next)
    } catch {
      /* storage unavailable: the choice lasts for this page only */
    }
  }

  private initial(): ColorScheme {
    try {
      const v = localStorage.getItem(KEY)
      if (v === 'light' || v === 'dark') return v
    } catch {
      /* storage unavailable */
    }
    try {
      return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    } catch {
      return 'light'
    }
  }

  private apply(s: ColorScheme): void {
    document.documentElement.dataset['theme'] = s
  }
}
