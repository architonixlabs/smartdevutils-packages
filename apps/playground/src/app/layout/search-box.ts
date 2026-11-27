import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, output, signal, viewChild } from '@angular/core'
import { Router } from '@angular/router'
import { DocsService } from '../core/docs.service'
import type { SearchDoc } from '../lib/search'

/** Combobox search (ARIA 1.2 pattern): type, arrow through results, Enter opens, Escape clears. */
@Component({
  selector: 'pg-search-box',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="search" role="search">
      <label class="sr-only" for="pg-search">Search packages, functions, tools and elements</label>
      <input
        #box
        id="pg-search"
        type="search"
        class="search-input"
        role="combobox"
        autocomplete="off"
        spellcheck="false"
        placeholder="Search  ( / )"
        aria-autocomplete="list"
        aria-controls="pg-search-results"
        [attr.aria-expanded]="open()"
        [attr.aria-activedescendant]="activeId()"
        [value]="query()"
        (input)="onInput($event)"
        (keydown)="onKey($event)"
        (focus)="focused.set(true)"
        (blur)="onBlur()"
      />
      <ul
        id="pg-search-results"
        class="search-results"
        role="listbox"
        aria-label="Search results"
        [hidden]="!open()"
      >
        @for (hit of hits(); track hit.doc.key; let i = $index) {
          <li
            role="option"
            class="search-result"
            [id]="optionId(i)"
            [class.active]="i === active()"
            [attr.aria-selected]="i === active()"
            (mousedown)="$event.preventDefault()"
            (click)="go(hit.doc)"
            (mousemove)="active.set(i)"
          >
            <span class="search-result-name">{{ hit.doc.name }}</span>
            <span class="search-result-meta">
              @if (hit.doc.kind) {
                <span class="badge badge-{{ hit.doc.kind }}">{{ hit.doc.kind }}</span>
              } @else {
                <span class="badge">package</span>
              }
              {{ hit.doc.type === 'item' ? hit.doc.module : hit.doc.summary }}
            </span>
          </li>
        } @empty {
          <li class="search-empty" role="presentation">No matches for “{{ query() }}”</li>
        }
      </ul>
      <span class="sr-only" aria-live="polite">{{ liveText() }}</span>
    </div>
  `,
})
export class SearchBox {
  private readonly docs = inject(DocsService)
  private readonly router = inject(Router)
  private readonly box = viewChild.required<ElementRef<HTMLInputElement>>('box')

  /** Emitted after a result was opened (the drawer closes on it). */
  readonly navigated = output<void>()

  protected readonly query = signal('')
  protected readonly focused = signal(false)
  protected readonly active = signal(0)
  protected readonly hits = computed(() => (this.query().trim() ? this.docs.search(this.query(), 20) : []))
  protected readonly open = computed(() => this.focused() && this.query().trim().length > 0)
  protected readonly activeId = computed(() =>
    this.open() && this.hits().length ? this.optionId(this.active()) : null,
  )
  protected readonly liveText = computed(() => {
    if (!this.open()) return ''
    const n = this.hits().length
    return n ? `${n === 20 ? '20 or more' : n} results` : 'No results'
  })

  focus(): void {
    this.box().nativeElement.focus()
    this.box().nativeElement.select()
  }

  protected optionId(i: number): string {
    return `pg-search-opt-${i}`
  }

  protected onInput(e: Event): void {
    this.query.set((e.target as HTMLInputElement).value)
    this.active.set(0)
    this.focused.set(true)
  }

  protected onBlur(): void {
    this.focused.set(false)
  }

  protected onKey(e: KeyboardEvent): void {
    const n = this.hits().length
    switch (e.key) {
      case 'ArrowDown':
        if (!n) return
        e.preventDefault()
        this.focused.set(true)
        this.active.set((this.active() + 1) % n)
        this.scrollActive()
        break
      case 'ArrowUp':
        if (!n) return
        e.preventDefault()
        this.active.set((this.active() - 1 + n) % n)
        this.scrollActive()
        break
      case 'Home':
      case 'End':
        if (!this.open() || !n) return
        e.preventDefault()
        this.active.set(e.key === 'Home' ? 0 : n - 1)
        this.scrollActive()
        break
      case 'Enter': {
        const hit = this.hits()[this.active()]
        if (hit) {
          e.preventDefault()
          this.go(hit.doc)
        }
        break
      }
      case 'Escape':
        if (this.query()) {
          e.preventDefault()
          e.stopPropagation()
          this.query.set('')
        }
        break
    }
  }

  private scrollActive(): void {
    queueMicrotask(() => document.getElementById(this.optionId(this.active()))?.scrollIntoView({ block: 'nearest' }))
  }

  protected go(doc: SearchDoc): void {
    const path = doc.type === 'package' ? ['/', doc.pkgId] : ['/', doc.pkgId, doc.sectionId!, doc.itemId!]
    void this.router.navigate(path)
    this.query.set('')
    this.navigated.emit()
  }
}
