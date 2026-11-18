import { describe, it, expect } from 'vitest';
import { mermaidText, renderFlowchart } from './flowchart';

describe('mermaidText', () => {
  it('turns parser characters into entity codes', () => {
    const out = mermaidText('a"b#c;d%%e|f<script>g`h{i}[j]&k\\l');
    expect(out).not.toMatch(/["%<>`{}[\]|\\&]/);
    expect(out).toContain('#34;');
    expect(out).toContain('#35;');
    expect(out).toContain('#37;#37;');
    expect(out).toContain('#60;script#62;');
  });

  it('flattens newlines and control characters and caps length', () => {
    expect(mermaidText('a\nb\r\n\tc')).toBe('a b c');
    expect(mermaidText('x'.repeat(200)).length).toBeLessThanOrEqual(80);
  });

  it('keeps colons and spaces as written', () => {
    expect(mermaidText('nginx:1.27 alpine')).toBe('nginx:1.27 alpine');
  });
});

describe('renderFlowchart', () => {
  it('writes groups, nodes, edges, red links and class definitions', () => {
    const r = renderFlowchart({
      direction: 'LR',
      groups: [{ id: 'g0', label: 'net "a"' }, { id: 'g1', label: 'unused' }],
      nodes: [{ id: 'a', lines: ['A', 'line 2'], group: 'g0' }, { id: 'b', lines: ['B'], shape: 'cylinder', classes: ['x'] }],
      edges: [{ from: 'a', to: 'b', label: 'uses' }, { from: 'b', to: 'a', problem: true, dotted: true }, { from: 'a', to: 'zz' }],
      classDefs: { x: 'stroke:#000' },
    });
    expect(r.text).toBe([
      'flowchart LR',
      '  subgraph g0["net #34;a#34;"]',
      '    a["A<br/>line 2"]',
      '  end',
      '  b[("B")]:::x',
      '  a -->|"uses"| b',
      '  b -.-> a',
      '  linkStyle 1 stroke:#dc2626,stroke-width:2px',
      '  classDef x stroke:#000',
    ].join('\n'));
    expect(r.truncated).toBe(false);
  });

  it('caps nodes and edges and drops edges to removed nodes', () => {
    const nodes = Array.from({ length: 10 }, (_, i) => ({ id: `n${i}`, lines: [`N${i}`] }));
    const edges = nodes.slice(1).map((n, i) => ({ from: `n${i}`, to: n.id }));
    const r = renderFlowchart({ direction: 'TB', nodes, edges }, 4);
    expect(r.nodes).toBe(4);
    expect(r.edges).toBe(3);
    expect(r.truncated).toBe(true);
    expect(r.text).not.toContain('n4');
  });
});
