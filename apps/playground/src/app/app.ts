import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core'
import { toSignal } from '@angular/core/rxjs-interop'
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router'
import { filter, map } from 'rxjs'
import { DocsService } from './core/docs.service'
import { ThemeService } from './core/theme.service'
import { Sidebar, type RouteLocation } from './layout/sidebar'

declare const ngDevMode: unknown

@Component({
  selector: 'pg-root',
  imports: [RouterOutlet, RouterLink, Sidebar],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:keydown)': 'onGlobalKey($event)',
  },
  template: `
    <a class="skip-link" href="#main" (click)="skipToMain($event)">Skip to content</a>
    <header class="app-header">
      <button
        #menuBtn
        type="button"
        class="btn btn-icon menu-btn"
        aria-controls="pg-sidebar"
        [attr.aria-expanded]="navOpen()"
        (click)="navOpen.set(!navOpen())"
      >
        <span class="menu-icon" aria-hidden="true"></span>
        <span class="sr-only">{{ navOpen() ? 'Close navigation' : 'Open navigation' }}</span>
      </button>
      <a class="brand" routerLink="/">
        <img src="favicon.svg" alt="" width="24" height="24" />
        <span>SmartDevUtils <span class="brand-sub">Playground</span></span>
      </a>
      @if (docs.version()) {
        <span class="version" title="Version of every @smartdevutils package">v{{ docs.version() }}</span>
      }
      <span class="header-spacer"></span>
      <button
        type="button"
        class="btn btn-icon"
        (click)="theme.toggle()"
        [attr.aria-label]="theme.scheme() === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'"
        [attr.title]="theme.scheme() === 'dark' ? 'Light theme' : 'Dark theme'"
      >
        <span class="theme-icon" [class.is-dark]="theme.scheme() === 'dark'" aria-hidden="true"></span>
      </button>
      <a class="header-link" href="https://smartdevutils.com">smartdevutils.com</a>
    </header>

    <div class="app-body">
      <aside id="pg-sidebar" class="sidebar" [class.open]="navOpen()" aria-label="Navigation">
        <pg-sidebar [loc]="loc()" (navigated)="afterSearchNav()" />
      </aside>
      @if (navOpen()) {
        <div class="scrim" (click)="closeNav()" aria-hidden="true"></div>
      }
      <main id="main" class="main" tabindex="-1" #main>
        @switch (docs.status()) {
          @case ('ready') {
            <router-outlet />
          }
          @case ('loading') {
            <p class="state-panel muted" role="status">Loading the docs…</p>
          }
          @case ('error') {
            <section class="state-panel" role="alert" aria-labelledby="load-err">
              <h1 id="load-err">The docs could not be loaded</h1>
              <p>{{ docs.error() }}</p>
              <p class="btn-row">
                <button type="button" class="btn btn-primary" (click)="docs.retry()">Try again</button>
                @if (devMode) {
                  <button type="button" class="btn" (click)="useFixture()">Use sample data (development)</button>
                }
              </p>
            </section>
          }
        }
      </main>
    </div>
  `,
})
export class App {
  protected readonly docs = inject(DocsService)
  protected readonly theme = inject(ThemeService)
  private readonly router = inject(Router)
  private readonly sidebar = viewChild.required(Sidebar)
  private readonly mainEl = viewChild.required<ElementRef<HTMLElement>>('main')
  private readonly menuBtn = viewChild.required<ElementRef<HTMLButtonElement>>('menuBtn')

  protected readonly devMode = typeof ngDevMode !== 'undefined' && !!ngDevMode
  protected readonly navOpen = signal(false)
  private focusMainOnNav = false

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  )

  protected readonly loc = computed<RouteLocation>(() => {
    const path = this.url().split(/[?#]/)[0]
    const [pkg, section, entry] = path
      .split('/')
      .filter(Boolean)
      .map((s) => {
        try {
          return decodeURIComponent(s)
        } catch {
          return s
        }
      })
    return { pkg, section, entry }
  })

  constructor() {
    this.docs.load()
    this.router.events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe(() => {
      const wasOpen = this.navOpen()
      this.navOpen.set(false)
      if (this.focusMainOnNav || wasOpen) {
        this.focusMainOnNav = false
        // Wait for the routed page to render its heading.
        setTimeout(() => this.focusMain(), 50)
      }
    })
  }

  protected afterSearchNav(): void {
    this.focusMainOnNav = true
  }

  protected closeNav(): void {
    this.navOpen.set(false)
    this.menuBtn().nativeElement.focus()
  }

  protected skipToMain(e: Event): void {
    e.preventDefault()
    this.focusMain()
  }

  private focusMain(): void {
    const main = this.mainEl().nativeElement
    const h1 = main.querySelector<HTMLElement>('h1')
    if (h1) {
      h1.tabIndex = -1
      h1.focus()
    } else main.focus()
  }

  protected onGlobalKey(e: KeyboardEvent): void {
    if (e.key === 'Escape' && this.navOpen()) {
      this.closeNav()
      return
    }
    if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const t = e.target as HTMLElement | null
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return
      e.preventDefault()
      if (matchMedia('(max-width: 860px)').matches) this.navOpen.set(true)
      setTimeout(() => this.sidebar().focusSearch())
    }
  }

  protected async useFixture(): Promise<void> {
    // Compiled out of production builds (ngDevMode is false there).
    if (typeof ngDevMode !== 'undefined' && ngDevMode) {
      const { DOCS_FIXTURE } = await import('./testing/docs.fixture')
      this.docs.useData(DOCS_FIXTURE)
    }
  }
}
