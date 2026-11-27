import { ChangeDetectionStrategy, Component, computed, effect, inject, input } from '@angular/core'
import { Title } from '@angular/platform-browser'
import { RouterLink } from '@angular/router'
import { DocsService } from '../core/docs.service'
import { InlineText } from '../shared/inline-text'
import { MarkdownView } from '../shared/markdown'
import { NotFound } from '../shared/not-found'

@Component({
  selector: 'pg-section-page',
  imports: [RouterLink, InlineText, MarkdownView, NotFound],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (pkgDoc(); as p) {
      @if (sectionDoc(); as s) {
        <article class="page">
          <nav class="breadcrumbs" aria-label="Breadcrumb">
            <ol>
              <li><a routerLink="/">Packages</a></li>
              <li><a [routerLink]="['/', p.id]">{{ p.name }}</a></li>
              <li><a [routerLink]="['/', p.id, s.id]" aria-current="page">{{ s.title }}</a></li>
            </ol>
          </nav>
          <header class="page-head">
            <h1>{{ s.title }}</h1>
            <p class="muted">{{ p.name }} · {{ s.items.length }} {{ s.items.length === 1 ? 'entry' : 'entries' }}</p>
          </header>
          @if (s.markdown && s.kind !== 'overview') {
            <pg-markdown [source]="s.markdown" />
          }
          <ul class="item-list">
            @for (item of s.items; track item.id) {
              <li class="item-row">
                <a class="item-name" [routerLink]="['/', p.id, s.id, item.id]">{{ item.name }}</a>
                <span class="item-badges">
                  <span class="badge badge-{{ item.kind }}">{{ item.kind }}</span>
                  @if (item.snippets.length) {
                    <span class="badge badge-live" title="Has a runnable or copyable example">example</span>
                  }
                </span>
                <span class="item-summary"><pg-inline [text]="item.summary" /></span>
              </li>
            } @empty {
              <li class="muted">No entries in this section.</li>
            }
          </ul>
        </article>
      } @else {
        <pg-not-found [message]="p.name + ' has no section called “' + section() + '”.'" />
      }
    } @else {
      <pg-not-found [message]="'There is no package called “' + pkg() + '”.'" />
    }
  `,
})
export class SectionPage {
  private readonly docs = inject(DocsService)
  private readonly title = inject(Title)
  readonly pkg = input.required<string>()
  readonly section = input.required<string>()

  protected readonly pkgDoc = computed(() => this.docs.package(this.pkg()))
  protected readonly sectionDoc = computed(() => this.docs.section(this.pkg(), this.section()))

  constructor() {
    effect(() => {
      const p = this.pkgDoc()
      const s = this.sectionDoc()
      if (p && s) this.title.setTitle(`${s.title} — ${p.name} — SmartDevUtils Playground`)
    })
  }
}
