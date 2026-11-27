import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core'
import { toSignal } from '@angular/core/rxjs-interop'
import { Title } from '@angular/platform-browser'
import { ActivatedRoute, RouterLink } from '@angular/router'
import { DocsService } from '../core/docs.service'
import { hashCode } from '../lib/autosave'
import { importLines } from '../lib/integrate'
import { decodeShare, isShareHash } from '../lib/share-link'
import { CodeBlock } from '../shared/code-block'
import { InlineText } from '../shared/inline-text'
import { MarkdownView } from '../shared/markdown'
import { NotFound } from '../shared/not-found'
import { focusTab, tabKeyNav } from '../shared/tabs'
import { IntegratePanel } from './playground/integrate-panel'
import { Playground } from './playground/playground'

type Tab = 'playground' | 'integrate'

@Component({
  selector: 'pg-entry-page',
  imports: [RouterLink, CodeBlock, InlineText, MarkdownView, NotFound, Playground, IntegratePanel],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (ref(); as r) {
      <article class="page entry">
        <nav class="breadcrumbs" aria-label="Breadcrumb">
          <ol>
            <li><a routerLink="/">Packages</a></li>
            <li><a [routerLink]="['/', r.pkg.id]">{{ r.pkg.name }}</a></li>
            <li><a [routerLink]="['/', r.pkg.id, r.section.id]">{{ r.section.title }}</a></li>
            <li><a [routerLink]="['/', r.pkg.id, r.section.id, r.item.id]" aria-current="page">{{ r.item.name }}</a></li>
          </ol>
        </nav>

        <header class="page-head">
          <h1 class="entry-title">
            <span class="entry-name">{{ r.item.name }}</span>
            <span class="badge badge-{{ r.item.kind }}">{{ r.item.kind }}</span>
          </h1>
          <p class="module-path"><code>{{ r.item.module }}</code></p>
          @if (r.item.deprecated) {
            <p class="note note-warn" role="note"><strong>Deprecated.</strong> {{ r.item.deprecated }}</p>
          }
          <p class="lead"><pg-inline [text]="r.item.summary" /></p>
          @if (r.item.runtime?.length) {
            <p class="muted small">Needs: {{ r.item.runtime!.join(', ') }}</p>
          }
          @if (r.item.webUrl) {
            <p><a [href]="r.item.webUrl" rel="noopener">Open this tool on smartdevutils.com</a></p>
          }
        </header>

        <pg-code-block label="Import" [code]="imports()" />
        @if (r.item.signature) {
          <pg-code-block label="Signature" [code]="r.item.signature" />
        }

        @if (r.item.params?.length || r.item.returns) {
          <section aria-labelledby="params-title">
            <h2 id="params-title">Parameters</h2>
            @if (r.item.params?.length) {
              <div class="table-scroll" tabindex="0" role="region" aria-labelledby="params-title">
                <table class="params">
                  <thead>
                    <tr><th scope="col">Name</th><th scope="col">Type</th><th scope="col">Description</th></tr>
                  </thead>
                  <tbody>
                    @for (p of r.item.params; track p.name) {
                      <tr>
                        <td><code>{{ p.name }}</code>@if (p.optional) {<span class="muted small"> optional</span>}</td>
                        <td><code class="type">{{ p.type }}</code></td>
                        <td>{{ p.description || '' }}</td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            }
            @if (r.item.returns) {
              <p class="returns"><strong>Returns</strong><code class="type">{{ r.item.returns }}</code></p>
            }
          </section>
        }

        @if (r.item.docs) {
          <section aria-labelledby="docs-title">
            <h2 id="docs-title">Details</h2>
            <pg-markdown [source]="r.item.docs" [headingOffset]="2" />
          </section>
        }

        <section class="try" aria-labelledby="try-title">
          <h2 id="try-title">Try it</h2>
          @if (shareProblem(); as msg) {
            <p class="note note-error" role="alert">{{ msg }}</p>
          }
          @if (foreignShare(); as f) {
            <p class="note" role="note">
              This link carries code for another entry.
              <a [routerLink]="f.path" [fragment]="f.fragment">Open it there</a>.
            </p>
          }
          <div class="tabs" role="tablist" aria-label="Try it" (keydown)="onTabKey($event)">
            <button
              type="button"
              role="tab"
              class="tab"
              id="tab-playground"
              aria-controls="panel-playground"
              [attr.aria-selected]="tab() === 'playground'"
              [tabindex]="tab() === 'playground' ? 0 : -1"
              (click)="tab.set('playground')"
            >
              Playground
            </button>
            <button
              type="button"
              role="tab"
              class="tab"
              id="tab-integrate"
              aria-controls="panel-integrate"
              [attr.aria-selected]="tab() === 'integrate'"
              [tabindex]="tab() === 'integrate' ? 0 : -1"
              (click)="tab.set('integrate')"
            >
              Integrate
            </button>
          </div>

          <div
            id="panel-playground"
            role="tabpanel"
            aria-labelledby="tab-playground"
            class="tab-panel"
            [hidden]="tab() !== 'playground'"
          >
            @if (r.item.snippets.length || sharedPayload()) {
              @for (k of [playgroundKey()]; track k) {
                <pg-playground
                  [pkg]="r.pkg"
                  [section]="r.section"
                  [item]="r.item"
                  [version]="docs.version()"
                  [shared]="sharedPayload()"
                />
              }
            } @else {
              <p class="muted">There is no example for {{ r.item.name }} yet. The Integrate tab shows how to use it.</p>
            }
          </div>
          <div
            id="panel-integrate"
            role="tabpanel"
            aria-labelledby="tab-integrate"
            class="tab-panel"
            [hidden]="tab() !== 'integrate'"
          >
            <pg-integrate-panel [pkg]="r.pkg" [item]="r.item" [version]="docs.version()" />
          </div>
        </section>
      </article>
    } @else {
      <pg-not-found [message]="notFoundMessage()" />
    }
  `,
})
export class EntryPage {
  protected readonly docs = inject(DocsService)
  private readonly title = inject(Title)
  private readonly fragment = toSignal(inject(ActivatedRoute).fragment, { initialValue: null })

  readonly pkg = input.required<string>()
  readonly section = input.required<string>()
  readonly entry = input.required<string>()

  protected readonly tab = signal<Tab>('playground')
  protected readonly ref = computed(() => this.docs.entry(this.pkg(), this.section(), this.entry()))
  protected readonly imports = computed(() => {
    const r = this.ref()
    return r ? importLines(r.pkg, r.item).join('\n') : ''
  })

  private readonly decoded = computed(() => {
    const f = this.fragment()
    return isShareHash(f) ? decodeShare(f!) : null
  })
  protected readonly sharedPayload = computed(() => {
    const d = this.decoded()
    if (!d?.ok) return null
    const p = d.payload
    return p.pkg === this.pkg() && p.section === this.section() && p.entry === this.entry() ? p : null
  })
  protected readonly shareProblem = computed(() => {
    const d = this.decoded()
    return d && !d.ok ? `This shared link could not be opened: ${d.error}` : null
  })
  protected readonly foreignShare = computed(() => {
    const d = this.decoded()
    if (!d?.ok || this.sharedPayload()) return null
    const p = d.payload
    return { path: ['/', p.pkg, p.section, p.entry], fragment: this.fragment()!.replace(/^#/, '') }
  })
  /** Recreates the playground per entry and per shared link, so its state never leaks across. */
  protected readonly playgroundKey = computed(() => {
    const sp = this.sharedPayload()
    return `${this.pkg()}/${this.section()}/${this.entry()}${sp ? '#' + hashCode(sp.code + sp.snippetId) : ''}`
  })
  protected readonly notFoundMessage = computed(() => {
    const p = this.docs.package(this.pkg())
    if (!p) return `There is no package called “${this.pkg()}”.`
    if (!this.docs.section(this.pkg(), this.section())) return `${p.name} has no section called “${this.section()}”.`
    return `There is no entry called “${this.entry()}” in ${p.name}.`
  })

  constructor() {
    effect(() => {
      const r = this.ref()
      if (r) this.title.setTitle(`${r.item.name} — ${r.pkg.name} — SmartDevUtils Playground`)
    })
    // A new entry starts on the Playground tab.
    effect(() => {
      this.ref()
      this.tab.set('playground')
    })
  }

  protected onTabKey(e: KeyboardEvent): void {
    const next = tabKeyNav(e, ['playground', 'integrate'], this.tab()) as Tab | null
    if (next) {
      this.tab.set(next)
      focusTab('tab-' + next)
    }
  }
}
