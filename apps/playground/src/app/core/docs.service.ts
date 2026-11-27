import { Injectable, computed, signal } from '@angular/core'
import type { PlaygroundDocs } from './model'
import { buildSearchIndex, search, type SearchDoc, type SearchHit } from '../lib/search'
import { findEntry, findPackage, findSection, type EntryRef } from '../lib/docs-lookup'

export type DocsState =
  | { status: 'loading' }
  | { status: 'ready'; docs: PlaygroundDocs }
  | { status: 'error'; message: string }

/** Loads assets/docs.json once (relative to the base href) and answers lookups and searches. */
@Injectable({ providedIn: 'root' })
export class DocsService {
  private readonly state = signal<DocsState>({ status: 'loading' })
  private started = false

  readonly status = computed(() => this.state().status)
  readonly error = computed(() => {
    const s = this.state()
    return s.status === 'error' ? s.message : null
  })
  readonly docs = computed(() => {
    const s = this.state()
    return s.status === 'ready' ? s.docs : null
  })
  readonly version = computed(() => this.docs()?.version ?? '')
  readonly packages = computed(() => this.docs()?.packages ?? [])
  private readonly index = computed<SearchDoc[]>(() => {
    const d = this.docs()
    return d ? buildSearchIndex(d) : []
  })

  load(): void {
    if (this.started) return
    this.started = true
    void this.fetchDocs()
  }

  retry(): void {
    this.started = false
    this.state.set({ status: 'loading' })
    this.load()
  }

  /** Development only: use the bundled fixture when docs.json has not been generated yet. */
  useData(docs: PlaygroundDocs): void {
    this.state.set({ status: 'ready', docs })
  }

  private async fetchDocs(): Promise<void> {
    try {
      // Relative URL: resolved against <base href="/playground/">.
      const res = await fetch('assets/docs.json', { headers: { Accept: 'application/json' } })
      if (!res.ok) throw new Error(`HTTP ${res.status} loading assets/docs.json`)
      const data = (await res.json()) as unknown
      if (!isDocs(data)) throw new Error('assets/docs.json does not have the expected format')
      this.state.set({ status: 'ready', docs: data })
    } catch (e) {
      this.state.set({ status: 'error', message: e instanceof Error ? e.message : String(e) })
    }
  }

  package(id: string) {
    const d = this.docs()
    return d ? findPackage(d, id) : undefined
  }

  section(pkgId: string, sectionId: string) {
    const p = this.package(pkgId)
    return p ? findSection(p, sectionId) : undefined
  }

  entry(pkgId: string, sectionId: string, itemId: string): EntryRef | undefined {
    const d = this.docs()
    return d ? findEntry(d, pkgId, sectionId, itemId) : undefined
  }

  search(query: string, limit = 20): SearchHit[] {
    return search(this.index(), query, limit)
  }
}

function isDocs(v: unknown): v is PlaygroundDocs {
  if (!v || typeof v !== 'object') return false
  const d = v as Record<string, unknown>
  return (
    typeof d['version'] === 'string' &&
    Array.isArray(d['packages']) &&
    d['packages'].every(
      (p: unknown) =>
        !!p &&
        typeof p === 'object' &&
        typeof (p as Record<string, unknown>)['id'] === 'string' &&
        Array.isArray((p as Record<string, unknown>)['sections']),
    )
  )
}
