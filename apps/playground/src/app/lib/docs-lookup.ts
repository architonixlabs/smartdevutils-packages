// Lookups over the docs data. Decorator-free so vitest can cover it without Angular.
import type { ApiItem, DocSection, PackageDoc, PlaygroundDocs } from '../core/model'

export interface EntryRef {
  pkg: PackageDoc
  section: DocSection
  item: ApiItem
}

export function findPackage(docs: PlaygroundDocs, pkgId: string): PackageDoc | undefined {
  return docs.packages.find((p) => p.id === pkgId)
}

export function findSection(pkg: PackageDoc, sectionId: string): DocSection | undefined {
  return pkg.sections.find((s) => s.id === sectionId)
}

export function findEntry(
  docs: PlaygroundDocs,
  pkgId: string,
  sectionId: string,
  itemId: string,
): EntryRef | undefined {
  const pkg = findPackage(docs, pkgId)
  const section = pkg && findSection(pkg, sectionId)
  const item = section?.items.find((i) => i.id === itemId)
  return pkg && section && item ? { pkg, section, item } : undefined
}

/** The README of a package: the overview section's Markdown, if there is one. */
export function packageReadme(pkg: PackageDoc): string | undefined {
  return pkg.sections.find((s) => s.kind === 'overview')?.markdown
}

/** Router link segments for an entry, relative to the app root. */
export function entryLink(pkgId: string, sectionId: string, itemId: string): string[] {
  return ['/', pkgId, sectionId, itemId]
}

/** Short package name without the scope: `@smartdevutils/core` → `core`. */
export function shortName(pkgName: string): string {
  const i = pkgName.lastIndexOf('/')
  return i >= 0 ? pkgName.slice(i + 1) : pkgName
}
