// Summaries are one line of Markdown-ish text: `code` spans are the only markup worth rendering.
export interface InlineSegment {
  code: boolean
  text: string
}

export function inlineSegments(text: string): InlineSegment[] {
  const out: InlineSegment[] = []
  const re = /`([^`\n]+)`/g
  let last = 0
  for (const m of text.matchAll(re)) {
    const i = m.index ?? 0
    if (i > last) out.push({ code: false, text: text.slice(last, i) })
    out.push({ code: true, text: m[1] })
    last = i + m[0].length
  }
  if (last < text.length) out.push({ code: false, text: text.slice(last) })
  return out
}
