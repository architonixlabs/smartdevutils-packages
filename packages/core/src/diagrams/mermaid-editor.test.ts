import { describe, expect, it } from 'vitest';
import {
  MAX_SHARE_CHARS, MERMAID_TEMPLATES, base64UrlDecode, base64UrlEncode, decodeShareFragment, detectDiagramType,
  encodeShareFragment, findTemplate, toMarkdownBlock,
} from './mermaid-editor';

describe('MERMAID_TEMPLATES', () => {
  it('has one starter per requested diagram type, with unique ids', () => {
    const ids = MERMAID_TEMPLATES.map(t => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(['flowchart', 'sequence', 'class', 'state', 'er', 'gantt', 'pie', 'xychart', 'sankey', 'quadrant',
      'mindmap', 'timeline', 'gitgraph', 'journey', 'radar', 'treemap']);
  });

  it('uses the keywords that were verified to render in Mermaid 12.2', () => {
    const first = Object.fromEntries(MERMAID_TEMPLATES.map(t => [t.id, t.source.split('\n')[0].split(' ')[0]]));
    expect(first).toMatchObject({ xychart: 'xychart-beta', sankey: 'sankey-beta', radar: 'radar-beta', treemap: 'treemap-beta', state: 'stateDiagram-v2' });
  });

  it('every starter is detected as a known type and uses synthetic data only', () => {
    for (const t of MERMAID_TEMPLATES) {
      expect(detectDiagramType(t.source), t.id).not.toBe('');
      expect(t.source).not.toMatch(/https?:\/\/(?!example\.com)/);
      expect(t.source.length).toBeLessThan(600);
    }
  });

  it('finds a template by id', () => {
    expect(findTemplate('pie')?.label).toBe('Pie chart');
    expect(findTemplate('nope')).toBeUndefined();
  });
});

describe('base64url', () => {
  it('round-trips bytes without padding or + and /', () => {
    const bytes = new Uint8Array(256).map((_, i) => i);
    const s = base64UrlEncode(bytes);
    expect(s).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(Array.from(base64UrlDecode(s)!)).toEqual(Array.from(bytes));
  });

  it('rejects text outside the alphabet and impossible lengths', () => {
    expect(base64UrlDecode('ab+c')).toBeNull();
    expect(base64UrlDecode('abcde')).toBeNull();
    expect(base64UrlDecode('<script>')).toBeNull();
  });
});

describe('share links', () => {
  const unicode = 'flowchart LR\n  A["Café – naïve ✓"] --> B["日本語 🚀"]\n  B --> C["Ünïcödé \u{1F600}"]';

  it('round-trips Unicode in plain form', async () => {
    const r = await encodeShareFragment(unicode, { compress: false });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.fragment).toMatch(/^code=[A-Za-z0-9_-]+$/);
    expect(await decodeShareFragment('#' + r.fragment)).toEqual({ ok: true, source: unicode });
  });

  it('compresses long sources when the runtime can, and still round-trips', async () => {
    const long = MERMAID_TEMPLATES.map(t => t.source).join('\n%% next\n').repeat(3).slice(0, 8000) + '\n%% ünïcode';
    const r = await encodeShareFragment(long);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    if (typeof CompressionStream !== 'undefined') expect(r.fragment.startsWith('code=z.')).toBe(true);
    expect(await decodeShareFragment(r.fragment)).toEqual({ ok: true, source: long });
  });

  it('reads the code from a fragment with other parameters', async () => {
    const r = await encodeShareFragment('pie\n  "A" : 1', { compress: false });
    if (!r.ok) throw new Error('encode failed');
    expect(await decodeShareFragment(`#theme=dark&${r.fragment}&x=1`)).toEqual({ ok: true, source: 'pie\n  "A" : 1' });
  });

  it('refuses an empty or oversize source', async () => {
    expect((await encodeShareFragment('   ')).ok).toBe(false);
    const big = await encodeShareFragment('a'.repeat(MAX_SHARE_CHARS + 1));
    expect(big.ok).toBe(false);
    if (!big.ok) expect(big.error).toContain('50,000');
    expect((await encodeShareFragment('a'.repeat(MAX_SHARE_CHARS), { compress: false })).ok).toBe(true);
  });

  it('returns null when there is no code in the fragment', async () => {
    expect(await decodeShareFragment('')).toBeNull();
    expect(await decodeShareFragment('#section-2')).toBeNull();
    expect(await decodeShareFragment('#mycode=abc')).toBeNull();
  });

  it('reports a bad fragment instead of throwing', async () => {
    for (const h of ['#code=', '#code=%%%', '#code=abcde', '#code=z.!!', '#code=z.AAAA', '#code=' + base64UrlEncode(new Uint8Array([0xff, 0xfe, 0x80]))]) {
      const r = await decodeShareFragment(h);
      expect(r?.ok, h).toBe(false);
    }
  });

  it('refuses a decoded source longer than the cap', async () => {
    const plain = '#code=' + base64UrlEncode(new TextEncoder().encode('a'.repeat(MAX_SHARE_CHARS + 10)));
    const r = await decodeShareFragment(plain);
    expect(r?.ok).toBe(false);
    if (typeof CompressionStream === 'undefined') return;
    // a small compressed payload that expands far past the cap (a "zip bomb") stops early
    const cs = new CompressionStream('deflate-raw');
    const w = cs.writable.getWriter();
    void w.write(new Uint8Array(5_000_000)); void w.close();
    const bomb = new Uint8Array(await new Response(cs.readable).arrayBuffer());
    expect(bomb.length).toBeLessThan(20_000);
    const z = await decodeShareFragment('#code=z.' + base64UrlEncode(bomb));
    expect(z?.ok).toBe(false);
    if (z && !z.ok) expect(z.error).toContain('longer than');
  });
});

describe('detectDiagramType', () => {
  it('skips blank lines, comments, directives and front matter', () => {
    expect(detectDiagramType('\n\n%% a comment\n%%{init: {"theme": "forest"}}%%\nsequenceDiagram\n  A->>B: hi')).toBe('Sequence diagram');
    expect(detectDiagramType('---\ntitle: Orders\n---\nerDiagram\n  A ||--o{ B : has')).toBe('Entity relationship diagram');
    expect(detectDiagramType('﻿graph TD\n  A-->B')).toBe('Flowchart');
  });

  it('knows both forms of the beta keywords', () => {
    expect(detectDiagramType('xychart\n')).toBe('XY chart');
    expect(detectDiagramType('xychart-beta\n')).toBe('XY chart');
    expect(detectDiagramType('sankey\n')).toBe('Sankey diagram');
    expect(detectDiagramType('treemap\n')).toBe('Treemap');
  });

  it('returns empty for unknown, empty or unclosed front matter', () => {
    expect(detectDiagramType('')).toBe('');
    expect(detectDiagramType('hello world')).toBe('');
    expect(detectDiagramType('---\ntitle: x\nflowchart LR')).toBe('');
    expect(detectDiagramType('pies\n')).toBe('');
  });
});

describe('toMarkdownBlock', () => {
  it('wraps in a mermaid fence', () => {
    expect(toMarkdownBlock('pie\n  "A" : 1\n\n')).toBe('```mermaid\npie\n  "A" : 1\n```\n');
  });

  it('uses a longer fence when the source has backticks', () => {
    expect(toMarkdownBlock('flowchart LR\n  A["```"]')).toMatch(/^````mermaid\n[\s\S]*\n````\n$/);
  });
});
