import { ChangeDetectionStrategy, Component, computed, effect, inject, input } from '@angular/core'
import { Title } from '@angular/platform-browser'
import { RouterLink } from '@angular/router'
import { DocsService } from '../core/docs.service'
import { packageReadme } from '../lib/docs-lookup'
import { CopyButton } from '../shared/copy-button'
import { MarkdownView } from '../shared/markdown'
import { NotFound } from '../shared/not-found'

@Component({
  selector: 'pg-package-page',
  imports: [RouterLink, CopyButton, MarkdownView, NotFound],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (doc(); as p) {
      <article class="page">
        <nav class="breadcrumbs" aria-label="Breadcrumb">
          <ol>
            <li><a routerLink="/">Packages</a></li>
            <li><a [routerLink]="['/', p.id]" aria-current="page">{{ p.name }}</a></li>
          </ol>
        </nav>
        <header class="page-head">
          <h1>{{ p.name }} <span class="version-inline">v{{ p.version }}</span></h1>
          <p class="lead">{{ p.description }}</p>
          <div class="install-line install-line-lg">
            <code>{{ p.install }}</code>
            <pg-copy-button [value]="p.install" label="Copy install command" />
          </div>
          <p class="muted small">
            For: {{ p.frameworks.join(', ') }} ·
            <a [href]="'https://www.npmjs.com/package/' + p.name" rel="noopener">npm</a>
          </p>
        </header>

        <section aria-labelledby="sections-title">
          <h2 id="sections-title">Sections</h2>
          <ul class="section-list">
            @for (s of browsable(); track s.id) {
              <li>
                <a [routerLink]="['/', p.id, s.id]">{{ s.title }}</a>
                <span class="muted small">{{ s.items.length }} {{ s.items.length === 1 ? 'entry' : 'entries' }}</span>
              </li>
            } @empty {
              <li class="muted">This package has no API sections.</li>
            }
          </ul>
        </section>

        @if (p.exports.length) {
          <section aria-labelledby="exports-title">
            <h2 id="exports-title">Exports</h2>
            <ul class="exports">
              @for (e of p.exports; track e) {
                <li><code>{{ exportPath(p.name, e) }}</code></li>
              }
            </ul>
          </section>
        }

        @if (p.changelog) {
          <section aria-labelledby="changelog-title">
            <h2 id="changelog-title">Latest changes</h2>
            <pg-markdown [source]="p.changelog" [headingOffset]="2" />
          </section>
        }

        @if (readme(); as md) {
          <section aria-labelledby="readme-title" class="readme">
            <h2 id="readme-title">README</h2>
            <pg-markdown [source]="md" [headingOffset]="2" />
          </section>
        }
      </article>
    } @else {
      <pg-not-found [message]="'There is no package called “' + pkg() + '”.'" />
    }
  `,
})
export class PackagePage {
  private readonly docs = inject(DocsService)
  private readonly title = inject(Title)
  readonly pkg = input.required<string>()

  protected readonly doc = computed(() => this.docs.package(this.pkg()))
  protected readonly readme = computed(() => {
    const p = this.doc()
    return p ? packageReadme(p) : undefined
  })
  protected readonly browsable = computed(() =>
    (this.doc()?.sections ?? []).filter((s) => s.kind !== 'overview' || s.items.length),
  )

  constructor() {
    effect(() => {
      const p = this.doc()
      if (p) this.title.setTitle(`${p.name} — SmartDevUtils Playground`)
    })
  }

  protected exportPath(name: string, sub: string): string {
    return sub === '.' ? name : `${name}/${sub.replace(/^\.\//, '')}`
  }
}
