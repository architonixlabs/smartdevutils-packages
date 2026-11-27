// README and CHANGELOG parsing: fenced code blocks with their nearest heading, and the latest release.

const SNIPPET_LANGS = { ts: 'ts', typescript: 'ts', tsx: 'tsx', js: 'js', javascript: 'js', mjs: 'js', html: 'html' }
const SHELL_LANGS = new Set(['bash', 'sh', 'shell', 'console', 'powershell', 'ps1', 'cmd', 'zsh'])

/**
 * Fenced code blocks of a Markdown document.
 * @returns {{ lang: string, rawLang: string, code: string, heading: string, headings: string[], shell: boolean, snippetLang?: string }[]}
 */
export function codeBlocks(md) {
  const lines = md.split(/\r?\n/)
  const out = []
  const headings = []
  let fence = null
  for (const line of lines) {
    if (fence) {
      if (line.trimStart().startsWith(fence.marker) && line.trim().replace(/`+|~+/, '') === '') {
        const rawLang = fence.lang
        out.push({
          rawLang,
          lang: SNIPPET_LANGS[rawLang] ?? rawLang,
          code: fence.lines.join('\n').replace(/^\n+|\s+$/g, ''),
          heading: headings.at(-1)?.text ?? '',
          headings: headings.map((h) => h.text),
          shell: SHELL_LANGS.has(rawLang),
          snippetLang: SNIPPET_LANGS[rawLang],
        })
        fence = null
      } else {
        fence.lines.push(line)
      }
      continue
    }
    const open = /^\s*(`{3,}|~{3,})\s*([\w-]*)/.exec(line)
    if (open) {
      fence = { marker: open[1], lang: open[2].toLowerCase(), lines: [] }
      continue
    }
    const h = /^(#{1,6})\s+(.*)$/.exec(line)
    if (h) {
      const level = h[1].length
      while (headings.length && headings.at(-1).level >= level) headings.pop()
      headings.push({ level, text: h[2].replace(/`/g, '').trim() })
    }
  }
  return out
}

/** The README without its first `# title` line (the UI shows the package name itself). */
export function readmeBody(md) {
  return md.replace(/^﻿?#\s+[^\n]*\n+/, '').trim()
}

/** The latest `## x.y.z` section of a changesets CHANGELOG, without its heading. */
export function latestChangelog(md) {
  const lines = md.split(/\r?\n/)
  const start = lines.findIndex((l) => /^##\s+\d+\.\d+\.\d+/.test(l))
  if (start < 0) return undefined
  let end = lines.findIndex((l, i) => i > start && /^##\s+\d+\.\d+\.\d+/.test(l))
  if (end < 0) end = lines.length
  const version = lines[start].replace(/^##\s+/, '').trim()
  const body = lines.slice(start + 1, end).join('\n').trim()
  return { version, markdown: body }
}

/** URL-safe id: letters, digits, dash and underscore. */
export function slug(text) {
  return (
    String(text)
      .replace(/[`'"<>]/g, '')
      .trim()
      .replace(/[^A-Za-z0-9_-]+/g, '-')
      .replace(/-{2,}/g, '-')
      .replace(/^-|-$/g, '') || 'item'
  )
}

/** Lower-case slug, for headings and titles. */
export function lowerSlug(text) {
  return slug(String(text).toLowerCase())
}
