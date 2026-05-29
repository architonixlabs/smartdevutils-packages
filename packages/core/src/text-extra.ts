import { marked } from 'marked'

export function readabilityScore(text: string): { fleschEase: number; fleschKincaid: number; level: string } {
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0)
  const words = text.split(/\s+/).filter(w => w.trim().length > 0)
  const syllables = words.reduce((acc, word) => acc + countSyllables(word), 0)
  const asl = words.length / Math.max(sentences.length, 1)
  const asw = syllables / Math.max(words.length, 1)
  const fleschEase = Math.round(206.835 - 1.015 * asl - 84.6 * asw)
  const fleschKincaid = Math.round((0.39 * asl + 11.8 * asw - 15.59) * 10) / 10
  const level =
    fleschEase >= 90 ? 'Very Easy' :
    fleschEase >= 70 ? 'Easy' :
    fleschEase >= 60 ? 'Standard' :
    fleschEase >= 50 ? 'Fairly Difficult' :
    fleschEase >= 30 ? 'Difficult' : 'Very Confusing'
  return { fleschEase, fleschKincaid, level }
}

function countSyllables(word: string): number {
  const clean = word.toLowerCase().replace(/[^a-z]/g, '')
  if (!clean) return 0
  const matches = clean.match(/[aeiouy]{1,2}/g)
  return Math.max(matches ? matches.length : 1, 1)
}

export function csvToMarkdownTable(csv: string): string {
  const lines = csv.split('\n').filter(l => l.trim())
  if (lines.length < 2) return ''
  const rows = lines.map(line => line.split(',').map(c => c.trim()))
  const header = '| ' + rows[0].join(' | ') + ' |'
  const separator = '| ' + rows[0].map(() => '---').join(' | ') + ' |'
  const body = rows.slice(1).map(row => '| ' + row.join(' | ') + ' |')
  return [header, separator, ...body].join('\n')
}

export function markdownToHtml(md: string): string {
  return marked.parse(md) as string
}

export function htmlToMarkdown(html: string): string {
  return html
    .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n')
    .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n')
    .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n')
    .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**')
    .replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**')
    .replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*')
    .replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*')
    .replace(/<code[^>]*>(.*?)<\/code>/gi, '`$1`')
    .replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)')
    .replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .trim()
}

export function detectNullValues(text: string): { isEmpty: boolean; isWhitespace: boolean; isNullLiteral: boolean } {
  return {
    isEmpty: text.length === 0,
    isWhitespace: text.length > 0 && text.trim().length === 0,
    isNullLiteral: ['null', 'NULL', 'Null', 'nil', 'NIL', 'undefined', 'N/A', 'n/a', 'none', 'NONE'].includes(text.trim()),
  }
}

export function numberFormat(n: number, locale?: string, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(locale, options).format(n)
}
