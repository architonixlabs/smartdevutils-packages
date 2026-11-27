import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, viewChild } from '@angular/core'
import { RouterLink } from '@angular/router'
import { DocsService } from '../core/docs.service'
import { SearchBox } from './search-box'

export interface RouteLocation {
  pkg?: string
  section?: string
  entry?: string
}

/** Search plus the packages → sections → items tree. Only expanded branches are rendered. */
@Component({
  selector: 'pg-sidebar',
  imports: [RouterLink, SearchBox],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <pg-search-box (navigated)="navigated.emit()" />
    <nav class="tree" aria-label="Packages">
      <ul class="tree-root">
        <li>
          <a class="tree-link tree-home" routerLink="/" [attr.aria-current]="!loc().pkg ? 'page' : null">All packages</a>
        </li>
        @for (pkg of docs.packages(); track pkg.id) {
          <li class="tree-pkg">
            <div class="tree-row">
              <button
                type="button"
                class="tree-toggle"
                [attr.aria-expanded]="isOpen('p:' + pkg.id)"
                [attr.aria-controls]="'tree-p-' + pkg.id"
                [attr.aria-label]="(isOpen('p:' + pkg.id) ? 'Collapse ' : 'Expand ') + pkg.name"
                (click)="toggle('p:' + pkg.id)"
              >
                <span class="chev" aria-hidden="true"></span>
              </button>
              <a
                class="tree-link tree-pkg-link"
                [routerLink]="['/', pkg.id]"
                [attr.aria-current]="loc().pkg === pkg.id && !loc().section ? 'page' : null"
                (click)="expand('p:' + pkg.id)"
                >{{ pkg.name }}</a
              >
            </div>
            @if (isOpen('p:' + pkg.id)) {
              <ul [id]="'tree-p-' + pkg.id" class="tree-sections">
                @for (sec of pkg.sections; track sec.id) {
                  @if (sec.kind !== 'overview' || sec.items.length) {
                    <li>
                      <div class="tree-row">
                        <button
                          type="button"
                          class="tree-toggle"
                          [attr.aria-expanded]="isOpen('s:' + pkg.id + '/' + sec.id)"
                          [attr.aria-controls]="'tree-s-' + pkg.id + '-' + sec.id"
                          [attr.aria-label]="(isOpen('s:' + pkg.id + '/' + sec.id) ? 'Collapse ' : 'Expand ') + sec.title"
                          (click)="toggle('s:' + pkg.id + '/' + sec.id)"
                        >
                          <span class="chev" aria-hidden="true"></span>
                        </button>
                        <a
                          class="tree-link"
                          [routerLink]="['/', pkg.id, sec.id]"
                          [attr.aria-current]="loc().pkg === pkg.id && loc().section === sec.id && !loc().entry ? 'page' : null"
                          >{{ sec.title }} @if (sec.items.length) {<span class="tree-count">{{ sec.items.length }}</span>}</a
                        >
                      </div>
                      @if (isOpen('s:' + pkg.id + '/' + sec.id)) {
                        <ul [id]="'tree-s-' + pkg.id + '-' + sec.id" class="tree-items">
                          @for (item of sec.items; track item.id) {
                            <li>
                              <a
                                class="tree-link tree-item"
                                [class.deprecated]="!!item.deprecated"
                                [routerLink]="['/', pkg.id, sec.id, item.id]"
                                [attr.aria-current]="isCurrent(pkg.id, sec.id, item.id) ? 'page' : null"
                                >{{ item.name }}</a
                              >
                            </li>
                          }
                        </ul>
                      }
                    </li>
                  }
                }
              </ul>
            }
          </li>
        }
      </ul>
    </nav>
  `,
})
export class Sidebar {
  protected readonly docs = inject(DocsService)
  readonly loc = input<RouteLocation>({})
  readonly navigated = output<void>()
  private readonly searchBox = viewChild.required(SearchBox)

  private readonly expanded = signal<ReadonlySet<string>>(new Set())
  private readonly expandedView = computed(() => this.expanded())

  constructor() {
    // Open the branch of the current page whenever the route changes.
    effect(() => {
      const { pkg, section } = this.loc()
      if (!pkg) return
      const keys = [`p:${pkg}`, ...(section ? [`s:${pkg}/${section}`] : [])]
      const cur = this.expanded()
      if (keys.every((k) => cur.has(k))) return
      this.expanded.set(new Set([...cur, ...keys]))
    })
  }

  focusSearch(): void {
    this.searchBox().focus()
  }

  protected isOpen(key: string): boolean {
    return this.expandedView().has(key)
  }

  protected toggle(key: string): void {
    const next = new Set(this.expanded())
    if (next.has(key)) next.delete(key)
    else next.add(key)
    this.expanded.set(next)
  }

  protected expand(key: string): void {
    if (!this.expanded().has(key)) this.toggle(key)
  }

  protected isCurrent(pkg: string, sec: string, item: string): boolean {
    const l = this.loc()
    return l.pkg === pkg && l.section === sec && l.entry === item
  }
}
