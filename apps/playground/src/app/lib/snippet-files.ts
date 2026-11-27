// File names, extensions and import scanning for snippets.
import type { SnippetLang } from '../core/model'

export function fileExtension(lang: SnippetLang): string {
  switch (lang) {
    case 'ts':
      return 'ts'
    case 'js':
      return 'js'
    case 'tsx':
      return 'tsx'
    case 'html':
      return 'html'
  }
}

export function mimeType(lang: SnippetLang): string {
  return lang === 'html' ? 'text/html' : lang === 'js' ? 'text/javascript' : 'text/plain'
}

/** `sdu-tool` + `basic` + `html` → `sdu-tool-basic.html`. Only safe file-name characters. */
export function downloadFileName(itemId: string, snippetId: string, lang: SnippetLang): string {
  const clean = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'snippet'
  return `${clean(itemId)}-${clean(snippetId)}.${fileExtension(lang)}`
}

const IMPORT_RE =
  /(?:^|[;\s])(?:import|export)\s+(?:type\s+)?(?:[\w*{}\s,$]+?\s+from\s+)?['"]([^'"\n]+)['"]|import\(\s*['"]([^'"\n]+)['"]\s*\)/g

/** Bare module specifiers the code imports (no relative paths, URLs or `node:` builtins), in order. */
export function bareImports(code: string): string[] {
  const seen = new Set<string>()
  for (const m of code.matchAll(IMPORT_RE)) {
    const spec = m[1] ?? m[2]
    if (!spec || /^(\.|\/|[a-z]+:)/i.test(spec)) continue
    seen.add(spec)
  }
  return [...seen]
}

/** `@scope/name/sub/path` → `@scope/name`; `lodash/fp` → `lodash`. */
export function packageOf(specifier: string): string {
  const parts = specifier.split('/')
  return specifier.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0]
}

/**
 * Whether the playground runs a snippet. Angular code never runs here (it needs the Angular compiler),
 * even when the docs data marks it `run`.
 */
export function isRunnable(snippet: { mode: string; lang: SnippetLang; code: string }): boolean {
  if (snippet.mode !== 'run') return false
  return !(snippet.lang === 'ts' && /from\s+['"]@angular\/(core|common|platform-browser)['"]/.test(snippet.code))
}
