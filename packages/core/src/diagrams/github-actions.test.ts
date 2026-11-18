import { describe, expect, it } from 'vitest';
import {
  EXAMPLE_BROKEN, EXAMPLE_CI, EXAMPLE_REUSABLE, MAX_DRAWN_JOBS, analyzeWorkflow, buildMermaid, escapeLabel,
  matrixInfo, matrixText, parseWorkflow, visualize,
} from './github-actions';

const wf = (jobs: string, on = 'push') => `on: ${on}\njobs:\n${jobs}`;
const run = (text: string, showSteps = false) => {
  const r = visualize(text, { showSteps });
  if (!r.ok) throw new Error(r.error);
  return r;
};
const msgs = (text: string) => run(text).analysis!.findings.map(f => f.message);

describe('parseWorkflow', () => {
  it('rejects empty and comment-only files', () => {
    expect(parseWorkflow('').ok).toBe(false);
    const r = parseWorkflow('# just a comment\n');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/no content/);
  });

  it('reports invalid YAML', () => {
    const r = parseWorkflow('on: push\njobs:\n  a: [\n');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/^YAML syntax error/);
  });

  it('reports duplicate job ids as a YAML error', () => {
    const r = parseWorkflow('on: push\njobs:\n  a:\n    runs-on: x\n  a:\n    runs-on: y\n');
    expect(r.ok).toBe(false);
  });

  it('rejects a non-mapping document', () => {
    expect(parseWorkflow('- a\n- b').ok).toBe(false);
  });

  it('reads needs as a string or a list', () => {
    const r = parseWorkflow(wf('  a:\n    runs-on: x\n  b:\n    needs: a\n    runs-on: x\n  c:\n    needs: [a, b]\n    runs-on: x\n'));
    if (!r.ok) throw new Error();
    expect(r.workflow.jobs.map(j => j.needs)).toEqual([[], ['a'], ['a', 'b']]);
  });

  it('reads triggers with branches, cron and inputs', () => {
    const r = parseWorkflow(EXAMPLE_CI);
    if (!r.ok) throw new Error();
    expect(r.workflow.triggers.map(t => t.event)).toEqual(['push', 'pull_request', 'schedule', 'workflow_dispatch']);
    expect(r.workflow.triggers[0].details).toEqual(['branches: main']);
    expect(r.workflow.triggers[2].details).toEqual(['cron: 0 3 * * 1']);
    const rel = parseWorkflow(EXAMPLE_REUSABLE);
    if (!rel.ok) throw new Error();
    expect(rel.workflow.triggers[1].details).toEqual(['inputs: dry-run']);
  });

  it('accepts on as a list and runs-on as a list or group', () => {
    const r = parseWorkflow('on: [push, pull_request]\njobs:\n  a:\n    runs-on: [self-hosted, linux]\n  b:\n    runs-on:\n      group: big\n      labels: gpu\n');
    if (!r.ok) throw new Error();
    expect(r.workflow.triggers.map(t => t.event)).toEqual(['push', 'pull_request']);
    expect(r.workflow.jobs.map(j => j.runsOn)).toEqual(['self-hosted, linux', 'group big · gpu']);
  });

  it('reads environment as a string or an object', () => {
    const r = parseWorkflow(wf('  a:\n    runs-on: x\n    environment: staging\n  b:\n    runs-on: x\n    environment:\n      name: prod\n'));
    if (!r.ok) throw new Error();
    expect(r.workflow.jobs.map(j => j.environment)).toEqual(['staging', 'prod']);
  });
});

describe('matrix counting', () => {
  it('multiplies key sizes', () => {
    expect(matrixInfo({ os: ['a', 'b', 'c'], node: [1, 2] })).toMatchObject({ dims: [3, 2], total: 6 });
  });

  it('applies partial exclude matches', () => {
    expect(matrixInfo({ os: ['a', 'b'], node: [1, 2, 3], exclude: [{ os: 'a' }] })).toMatchObject({ excluded: 3, total: 3 });
  });

  it('follows the documented include rules', () => {
    // GitHub docs example: 4 base combinations + 2 new ones from include.
    const m = {
      fruit: ['apple', 'pear'], animal: ['cat', 'dog'],
      include: [
        { color: 'green' }, { color: 'pink', animal: 'cat' }, { fruit: 'apple', shape: 'circle' },
        { fruit: 'banana' }, { fruit: 'banana', animal: 'cat' },
      ],
    };
    expect(matrixInfo(m)).toMatchObject({ total: 6, included: 2 });
  });

  it('counts include-only matrices', () => {
    expect(matrixInfo({ include: [{ os: 'a' }, { os: 'b' }] })).toMatchObject({ total: 2, included: 2 });
  });

  it('does not guess expression matrices', () => {
    expect(matrixInfo('${{ fromJSON(needs.a.outputs.m) }}').total).toBeNull();
    expect(matrixInfo({ os: '${{ fromJSON(x) }}' }).total).toBeNull();
  });

  it('formats the count', () => {
    expect(matrixText(matrixInfo({ os: [1, 2, 3], node: [1, 2] }))).toBe('matrix 3×2 = 6 → 6 jobs');
    const r = parseWorkflow(EXAMPLE_CI);
    if (!r.ok) throw new Error();
    expect(matrixText(r.workflow.jobs[1].matrix!)).toBe('matrix 3×2 = 6, −1 excluded, +1 included → 6 jobs');
  });

  it('flags matrices above 256 jobs', () => {
    const list = Array.from({ length: 17 }, (_, i) => i).join(', ');
    expect(msgs(wf(`  a:\n    runs-on: x\n    strategy:\n      matrix:\n        p: [${list}]\n        q: [${list}]\n`)).join('\n')).toMatch(/289 jobs.*at most 256/);
  });
});

describe('analyzeWorkflow', () => {
  it('finds missing needs and blocked jobs', () => {
    const r = run(EXAMPLE_BROKEN);
    const m = r.analysis!.findings.map(f => f.message).join('\n');
    expect(m).toMatch(/"test" needs "biuld", but no job has that id/);
    expect(m).toMatch(/"package" has no runs-on/);
    expect(m).toMatch(/share the name "Build"/);
    expect(r.analysis!.missing).toEqual(['biuld']);
    expect([...r.analysis!.blockedJobs]).toEqual(['test', 'package']);
  });

  it('finds cycles and self needs', () => {
    const a = run(wf('  a:\n    needs: c\n    runs-on: x\n  b:\n    needs: a\n    runs-on: x\n  c:\n    needs: b\n    runs-on: x\n  d:\n    needs: d\n    runs-on: x\n  e:\n    needs: a\n    runs-on: x\n')).analysis!;
    const m = a.findings.map(f => f.message).join('\n');
    expect(m).toMatch(/Needs cycle: a → c → b → a/);
    expect(m).toMatch(/"d" needs itself/);
    expect([...a.cycleJobs].sort()).toEqual(['a', 'b', 'c', 'd']);
    expect([...a.blockedJobs]).toEqual(['e']);
  });

  it('computes stages and the critical path', () => {
    const a = run(EXAMPLE_CI).analysis!;
    expect(a.criticalPath).toEqual(['lint', 'test', 'build', 'deploy']);
    expect(a.stages).toEqual([['lint'], ['test', 'docs'], ['build'], ['deploy']]);
    const m = a.findings.map(f => f.message).join('\n');
    expect(m).toMatch(/Stage 2: test, docs can run at the same time/);
    expect(m).toMatch(/"build" needs "lint", but "test" already waits for "lint"/);
    expect(a.findings.filter(f => f.severity === 'error')).toEqual([]);
  });

  it('explains that skipping a conditional job skips its dependents', () => {
    const m = msgs(wf("  a:\n    runs-on: x\n    if: github.ref == 'refs/heads/main'\n  b:\n    needs: a\n    runs-on: x\n")).join('\n');
    expect(m).toMatch(/"a" has an if: condition. When it is skipped, b is skipped too/);
  });

  it('does not ask for runs-on on reusable workflow calls, and flags unsupported keys', () => {
    const a = run(EXAMPLE_REUSABLE).analysis!;
    expect(a.findings.filter(f => f.severity === 'error')).toEqual([]);
    const m = msgs(wf('  a:\n    uses: ./.github/workflows/x.yml\n    runs-on: ubuntu-latest\n')).join('\n');
    expect(m).toMatch(/does not support runs-on/);
  });

  it('reports long chains and isolated jobs', () => {
    const chain = Array.from({ length: 7 }, (_, i) => `  j${i}:\n    runs-on: x\n${i ? `    needs: j${i - 1}\n` : ''}`).join('');
    const m = msgs(wf(chain + '  lonely:\n    runs-on: x\n')).join('\n');
    expect(m).toMatch(/Long chain: 7 jobs/);
    expect(m).toMatch(/"lonely" has no needs and no job needs it/);
  });

  it('flags invalid job ids and missing on/jobs', () => {
    expect(msgs(wf('  "1bad id":\n    runs-on: x\n')).join('\n')).toMatch(/is not valid/);
    const a = analyzeWorkflow({ triggers: [], jobs: [] });
    expect(a.findings.map(f => f.message).join('\n')).toMatch(/No "on:" key[\s\S]*No jobs found/);
  });
});

describe('buildMermaid', () => {
  it('draws jobs, triggers, needs and the critical path', () => {
    const t = run(EXAMPLE_CI).mermaid!.text;
    expect(t.startsWith('flowchart LR\n')).toBe(true);
    expect(t).toContain('subgraph triggers["Triggers"]');
    expect(t).toContain('t2("schedule<br/>cron: 0 3 * * 1")');
    expect(t).toContain('triggers --> j0');
    expect(t).toContain('j0 --> j1');
    expect(t).toContain('matrix 3×2 = 6, −1 excluded, +1 included → 6 jobs');
    expect(t).toContain('environment: production');
    expect(t).toContain('class j0,j1,j2,j4 crit');
    expect(t).toContain('class j4 cond');
    // edges: triggers->lint (0), lint->test (1), lint->build (2), test->build (3), lint->docs (4), build->deploy (5)
    expect(t).toContain('linkStyle 1,3,5 stroke:#d97706');
  });

  it('draws reusable calls as subroutines', () => {
    const t = run(EXAMPLE_REUSABLE).mermaid!.text;
    expect(t).toMatch(/j0\[\["test<br\/>uses: .\/.github\/workflows\/test.yml"\]\]/);
  });

  it('draws missing needs as a dashed node', () => {
    const t = run(EXAMPLE_BROKEN).mermaid!.text;
    expect(t).toContain('m0["missing: biuld"]');
    expect(t).toContain('m0 -.-> j1');
    expect(t).toContain('class j1,j2,m0 bad');
  });

  it('expands steps as subgraphs', () => {
    const t = run(EXAMPLE_CI, true).mermaid!.text;
    expect(t).toContain('subgraph j0["lint<br/>runs-on: ubuntu-latest"]');
    expect(t).toContain('j0s0["1. uses: actions/checkout@v4"]');
    expect(t).toContain('j0s0 --> j0s1');
    expect(t).toContain('j0 --> j1');
  });

  it('escapes hostile names', () => {
    expect(escapeLabel('a"b')).toBe('a#quot;b');
    expect(escapeLabel('<script>alert(1)</script>')).not.toMatch(/[<>]/);
    const esc = escapeLabel('x;y %% z {a} [b] `c` #d |e');
    expect(esc).toBe('x#59;y #37;#37; z #123;a#125; #91;b#93; #96;c#96; #35;d #124;e');
    expect(escapeLabel('line1\nline2')).toBe('line1 line2');

    const hostile = 'on: push\njobs:\n  end:\n    name: "Evil\\"]; click j0 call alert(1) %% <script>x</script>\\n{}"\n    runs-on: "a;b"\n  "x-y_z":\n    needs: end\n    runs-on: x\n';
    const t = run(hostile).mermaid!.text;
    const nodeLines = t.split('\n').filter(l => /^\s+j\d+\[/.test(l));
    for (const l of nodeLines) {
      const inner = l.replace(/^\s+j\d+\[\[?"/, '').replace(/"\]\]?$/, '');
      const bare = inner.replace(/<br\/>/g, '').replace(/#\w+;/g, '');
      expect(bare).not.toMatch(/["{}%<>[\];`|]/);
    }
    expect(t).not.toMatch(/^\s*click /m);
    expect(t).toContain('j0 --> j1');
  });

  it('caps the drawing at 200 jobs but analyses all of them', () => {
    const jobs = Array.from({ length: 250 }, (_, i) => `  job${i}:\n    runs-on: x\n${i ? `    needs: job${i - 1}\n` : ''}`).join('');
    const r = run(wf(jobs));
    expect(r.mermaid!.capped).toBe(true);
    expect(r.mermaid!.drawnJobs).toBe(MAX_DRAWN_JOBS);
    expect(r.mermaid!.text).toContain('+50 more jobs not drawn');
    expect(r.mermaid!.text).not.toContain('j200[');
    expect(r.analysis!.criticalPath.length).toBe(250);
  });

  it('returns no diagram when there are no jobs', () => {
    const r = run('on: push\n');
    expect(r.mermaid).toBeUndefined();
    expect(r.analysis!.findings[0].message).toMatch(/No jobs found/);
  });
});
