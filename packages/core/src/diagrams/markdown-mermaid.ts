/** A piece of the Markdown preview: rendered HTML, or the source of one ```mermaid block to draw as a diagram. */
export type PreviewSegment = { kind: 'html'; html: string } | { kind: 'mermaid'; source: string };

const TOKEN = (i: number) => `SDUMERMAIDBLOCK${i}X`;
export const MAX_DIAGRAMS = 20;

/**
 * Takes the ```mermaid (or ~~~mermaid) fenced blocks out of Markdown and leaves a placeholder paragraph for each.
 * Tracks other fences so a mermaid fence shown inside a longer code block (````markdown … ````) stays code.
 * Only the first MAX_DIAGRAMS blocks are drawn; later ones are left as code.
 */
export function extractMermaidBlocks(markdown: string): { markdown: string; blocks: string[] } {
  const lines = markdown.split(/\r?\n/);
  const out: string[] = [];
  const blocks: string[] = [];
  let fence: { char: string; len: number; mermaid: boolean; body: string[]; open: string } | null = null;
  for (const line of lines) {
    if (!fence) {
      const m = /^ {0,3}(`{3,}|~{3,})\s*([^`\s]*)[^`]*$/.exec(line);
      if (m) {
        const mermaid = m[2].toLowerCase() === 'mermaid' && blocks.length < MAX_DIAGRAMS;
        fence = { char: m[1][0], len: m[1].length, mermaid, body: [], open: line };
        if (!mermaid) out.push(line);
        continue;
      }
      out.push(line);
      continue;
    }
    const close = new RegExp(`^ {0,3}\\${fence.char}{${fence.len},}\\s*$`).test(line);
    if (close) {
      if (fence.mermaid) {
        out.push('', TOKEN(blocks.length), '');
        blocks.push(fence.body.join('\n'));
      } else out.push(line);
      fence = null;
      continue;
    }
    if (fence.mermaid) fence.body.push(line);
    else out.push(line);
  }
  // an unclosed mermaid fence runs to the end, as in CommonMark
  if (fence?.mermaid) { out.push('', TOKEN(blocks.length), ''); blocks.push(fence.body.join('\n')); }
  return { markdown: out.join('\n'), blocks };
}

/** Splits the rendered HTML at the placeholders into HTML and diagram segments. */
export function splitPreview(html: string, blocks: string[]): PreviewSegment[] {
  const segs: PreviewSegment[] = [];
  const re = /<p>SDUMERMAIDBLOCK(\d+)X<\/p>/g;
  let last = 0;
  for (let m: RegExpExecArray | null; (m = re.exec(html)); ) {
    const src = blocks[Number(m[1])];
    if (src === undefined) continue; // the user's own text, not a placeholder
    const before = html.slice(last, m.index);
    if (before.trim()) segs.push({ kind: 'html', html: before });
    segs.push({ kind: 'mermaid', source: src });
    last = m.index + m[0].length;
  }
  const rest = html.slice(last);
  if (rest.trim()) segs.push({ kind: 'html', html: rest });
  return segs;
}
