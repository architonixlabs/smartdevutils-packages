import { describe, expect, it } from 'vitest';
import { marked } from 'marked';
import { MAX_DIAGRAMS, extractMermaidBlocks, splitPreview } from './markdown-mermaid';

const render = (md: string) => {
  const { markdown, blocks } = extractMermaidBlocks(md);
  return splitPreview(marked.parse(markdown, { async: false }) as string, blocks);
};

describe('markdown mermaid blocks', () => {
  it('takes out a mermaid fence and keeps the text around it', () => {
    const segs = render('# Title\n\nBefore\n\n```mermaid\ngraph TD\n  A-->B\n```\n\nAfter');
    expect(segs.map(s => s.kind)).toEqual(['html', 'mermaid', 'html']);
    expect(segs[1]).toEqual({ kind: 'mermaid', source: 'graph TD\n  A-->B' });
    expect((segs[0] as { html: string }).html).toContain('Before');
    expect((segs[2] as { html: string }).html).toContain('After');
  });

  it('accepts ~~~ fences, upper case and a block at the very start', () => {
    const segs = render('~~~Mermaid\npie\n  "a" : 1\n~~~');
    expect(segs).toEqual([{ kind: 'mermaid', source: 'pie\n  "a" : 1' }]);
  });

  it('leaves other code blocks alone, including a mermaid fence shown inside a longer fence', () => {
    const md = '````markdown\n```mermaid\ngraph TD\n```\n````\n\n```js\nconst x = 1;\n```';
    const { blocks, markdown } = extractMermaidBlocks(md);
    expect(blocks).toEqual([]);
    expect(markdown).toBe(md);
  });

  it('a shorter closing fence does not close a longer opening one', () => {
    const { blocks } = extractMermaidBlocks('````mermaid\ngraph TD\n```\nA-->B\n````');
    expect(blocks).toEqual(['graph TD\n```\nA-->B']);
  });

  it('an unclosed mermaid fence runs to the end', () => {
    expect(extractMermaidBlocks('```mermaid\ngraph LR\n  A-->B').blocks).toEqual(['graph LR\n  A-->B']);
  });

  it('draws at most MAX_DIAGRAMS blocks and leaves the rest as code', () => {
    const md = Array.from({ length: MAX_DIAGRAMS + 2 }, (_, i) => `\`\`\`mermaid\ngraph TD\n  N${i}\n\`\`\``).join('\n\n');
    const segs = render(md);
    expect(segs.filter(s => s.kind === 'mermaid')).toHaveLength(MAX_DIAGRAMS);
    expect(segs.at(-1)).toMatchObject({ kind: 'html' });
    expect((segs.at(-1) as { html: string }).html).toContain('language-mermaid');
  });

  it('text that looks like a placeholder is not turned into a diagram', () => {
    const segs = render('SDUMERMAIDBLOCK0X');
    expect(segs).toEqual([{ kind: 'html', html: '<p>SDUMERMAIDBLOCK0X</p>\n' }]);
  });

  it('no mermaid blocks: one html segment', () => {
    expect(render('Just **text**')).toEqual([{ kind: 'html', html: '<p>Just <strong>text</strong></p>\n' }]);
  });
});
