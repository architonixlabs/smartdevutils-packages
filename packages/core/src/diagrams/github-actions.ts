// GitHub Actions workflow visualizer: YAML -> job model -> findings -> Mermaid flowchart text.
// Pure functions only, so the whole pipeline is unit-tested without Angular or a browser.
import { loadYaml } from '../yaml';

export const MAX_INPUT_CHARS = 2_000_000;
/** Jobs drawn in the diagram. All jobs are still analysed. */
export const MAX_DRAWN_JOBS = 200;
export const MAX_STEPS_PER_JOB = 25;
export const MAX_STEP_NODES = 300;
/** GitHub's documented limit: a matrix generates at most 256 jobs per workflow run. */
export const MATRIX_JOB_LIMIT = 256;
/** A chain of this many jobs or more is reported as long. */
export const LONG_CHAIN = 6;

export type Severity = 'error' | 'warning' | 'info';
export interface Finding { severity: Severity; message: string; jobId?: string }

export interface Trigger { event: string; details: string[] }

export interface MatrixInfo {
  /** Size of each matrix key, in order, e.g. [3, 2]. */
  dims: number[];
  excluded: number;
  /** Combinations added by include entries that matched no existing combination. */
  included: number;
  /** Final number of jobs, or null when the matrix comes from an expression. */
  total: number | null;
  note?: string;
}

export interface Step { label: string }

export interface Job {
  id: string;
  name?: string;
  needs: string[];
  runsOn?: string;
  uses?: string;
  if?: string;
  environment?: string;
  matrix?: MatrixInfo;
  steps: Step[];
  /** Keys present on the job, for keyword checks. */
  keys: string[];
}

export interface Workflow { name?: string; triggers: Trigger[]; jobs: Job[] }

export interface Analysis {
  findings: Finding[];
  /** Job ids on the longest needs chain, first to last. Empty when there are no jobs. */
  criticalPath: string[];
  /** Jobs grouped by the earliest stage they can start in (only for jobs outside cycles / missing needs). */
  stages: string[][];
  /** Jobs that are part of a needs cycle. */
  cycleJobs: Set<string>;
  /** Jobs that need (directly or through other jobs) a missing job or a cycle. */
  blockedJobs: Set<string>;
  /** Needed job ids that do not exist. */
  missing: string[];
}

export type ParseResult = { ok: true; workflow: Workflow } | { ok: false; error: string };

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const scalar = (v: unknown): string | undefined =>
  typeof v === 'string' ? v : typeof v === 'number' || typeof v === 'boolean' ? String(v) : undefined;
const listOf = (v: unknown): string[] =>
  Array.isArray(v) ? v.map(scalar).filter((x): x is string => x !== undefined) : scalar(v) !== undefined ? [scalar(v)!] : [];
const short = (s: string, max = 60): string => {
  const one = s.replace(/\s+/g, ' ').trim();
  return one.length > max ? one.slice(0, max - 1) + '…' : one;
};
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;

// ---------- parse ----------

export function parseWorkflow(text: string): ParseResult {
  if (!text.trim()) return { ok: false, error: 'Paste a workflow file to start.' };
  if (text.length > MAX_INPUT_CHARS) return { ok: false, error: `The file is larger than ${MAX_INPUT_CHARS.toLocaleString('en-US')} characters.` };
  let doc: unknown;
  try {
    doc = loadYaml(text);
  } catch (e) {
    const msg = e instanceof Error ? e.message.split('\n')[0] : String(e);
    return { ok: false, error: `YAML syntax error: ${msg}` };
  }
  if (doc === null || doc === undefined) return { ok: false, error: 'The file has no content (only comments or blank lines).' };
  if (!isObj(doc)) return { ok: false, error: 'A workflow file must be a YAML mapping with "on:" and "jobs:" keys.' };

  // YAML 1.1 parsers read a bare `on` key as boolean true; js-yaml keeps it as "on", but accept both.
  const onValue = 'on' in doc ? doc['on'] : doc['true'];
  const triggers = parseTriggers(onValue);
  const jobsRaw = doc['jobs'];
  const jobs: Job[] = [];
  if (isObj(jobsRaw)) {
    for (const [id, raw] of Object.entries(jobsRaw)) jobs.push(parseJob(id, raw));
  }
  return { ok: true, workflow: { name: scalar(doc['name']), triggers, jobs } };
}

function parseTriggers(on: unknown): Trigger[] {
  if (on === undefined || on === null) return [];
  if (typeof on === 'string') return [{ event: on, details: [] }];
  if (Array.isArray(on)) return listOf(on).map(event => ({ event, details: [] }));
  if (!isObj(on)) return [];
  const out: Trigger[] = [];
  for (const [event, cfg] of Object.entries(on)) {
    const details: string[] = [];
    if (event === 'schedule' && Array.isArray(cfg)) {
      for (const s of cfg) if (isObj(s) && scalar(s['cron'])) details.push(`cron: ${scalar(s['cron'])}`);
    } else if (isObj(cfg)) {
      for (const key of ['branches', 'branches-ignore', 'tags', 'tags-ignore', 'paths', 'paths-ignore', 'types', 'workflows']) {
        const v = listOf(cfg[key]);
        if (v.length) details.push(`${key}: ${v.join(', ')}`);
      }
      if ((event === 'workflow_dispatch' || event === 'workflow_call') && isObj(cfg['inputs'])) {
        const names = Object.keys(cfg['inputs']);
        if (names.length) details.push(`inputs: ${names.join(', ')}`);
      }
    }
    out.push({ event, details });
  }
  return out;
}

function parseRunsOn(v: unknown): string | undefined {
  if (v === undefined || v === null) return undefined;
  if (isObj(v)) {
    const parts: string[] = [];
    if (scalar(v['group'])) parts.push(`group ${scalar(v['group'])}`);
    const labels = listOf(v['labels']);
    if (labels.length) parts.push(labels.join(', '));
    return parts.join(' · ') || 'runner group';
  }
  const l = listOf(v);
  return l.length ? l.join(', ') : undefined;
}

function parseJob(id: string, raw: unknown): Job {
  const j = isObj(raw) ? raw : {};
  const env = j['environment'];
  const environment = isObj(env) ? scalar(env['name']) : scalar(env);
  const strategy = isObj(j['strategy']) ? j['strategy'] : undefined;
  const steps: Step[] = Array.isArray(j['steps'])
    ? j['steps'].map((s, i) => ({ label: stepLabel(s, i) }))
    : [];
  return {
    id,
    name: scalar(j['name']),
    needs: listOf(j['needs']),
    runsOn: parseRunsOn(j['runs-on']),
    uses: scalar(j['uses']),
    if: scalar(j['if']),
    environment,
    matrix: strategy && 'matrix' in strategy ? matrixInfo(strategy['matrix']) : undefined,
    steps,
    keys: Object.keys(j),
  };
}

function stepLabel(s: unknown, i: number): string {
  if (!isObj(s)) return `step ${i + 1}`;
  const name = scalar(s['name']);
  if (name) return name;
  const uses = scalar(s['uses']);
  if (uses) return `uses: ${uses}`;
  const run = scalar(s['run']);
  if (run) return `run: ${run.split('\n').find(l => l.trim()) ?? ''}`;
  return `step ${i + 1}`;
}

// ---------- matrix ----------

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Counts matrix jobs the way GitHub documents it: the cartesian product of the keys, minus combinations
 * matched by every key of an exclude entry, then include entries. An include entry is merged into each
 * original combination whose original values it does not overwrite; if it fits none, it adds a new combination.
 */
export function matrixInfo(m: unknown): MatrixInfo {
  if (typeof m === 'string') return { dims: [], excluded: 0, included: 0, total: null, note: 'matrix from an expression' };
  if (!isObj(m)) return { dims: [], excluded: 0, included: 0, total: null, note: 'matrix is not a mapping' };
  const keys = Object.keys(m).filter(k => k !== 'include' && k !== 'exclude');
  const dims: number[] = [];
  for (const k of keys) {
    if (!Array.isArray(m[k])) return { dims: [], excluded: 0, included: 0, total: null, note: `matrix key "${k}" is an expression` };
    dims.push((m[k] as unknown[]).length);
  }
  const product = dims.reduce((a, b) => a * b, keys.length ? 1 : 0);
  if (product > 100_000) return { dims, excluded: 0, included: 0, total: null, note: 'matrix too large to count' };
  let combos: Record<string, unknown>[] = keys.length ? [{}] : [];
  for (const k of keys) combos = combos.flatMap(c => (m[k] as unknown[]).map(v => ({ ...c, [k]: v })));

  const exclude = m['exclude'];
  const include = m['include'];
  if (exclude !== undefined && !Array.isArray(exclude)) return { dims, excluded: 0, included: 0, total: null, note: 'exclude is an expression' };
  if (include !== undefined && !Array.isArray(include)) return { dims, excluded: 0, included: 0, total: null, note: 'include is an expression' };

  const before = combos.length;
  for (const ex of (exclude as unknown[] | undefined) ?? []) {
    if (!isObj(ex)) continue;
    const entries = Object.entries(ex);
    if (!entries.length) continue;
    combos = combos.filter(c => !entries.every(([k, v]) => same(c[k], v)));
  }
  const excluded = before - combos.length;

  const original = combos;
  const added: Record<string, unknown>[] = [];
  for (const inc of (include as unknown[] | undefined) ?? []) {
    if (!isObj(inc)) continue;
    let merged = false;
    for (const c of original) {
      const conflict = Object.entries(inc).some(([k, v]) => keys.includes(k) && k in c && !same(c[k], v));
      if (!conflict) { Object.assign(c, inc); merged = true; }
    }
    if (!merged) added.push({ ...inc });
  }
  return { dims, excluded, included: added.length, total: original.length + added.length };
}

export function matrixText(mi: MatrixInfo): string {
  if (mi.total === null) return mi.note ?? 'matrix';
  const parts: string[] = [];
  const base = mi.dims.length ? mi.dims.join('×') : '';
  if (mi.dims.length > 1) parts.push(`${base} = ${mi.dims.reduce((a, b) => a * b, 1)}`);
  else if (base) parts.push(base);
  if (mi.excluded) parts.push(`−${mi.excluded} excluded`);
  if (mi.included) parts.push(`+${mi.included} included`);
  const head = parts.length ? parts.join(', ') : 'include only';
  return `matrix ${head} → ${plural(mi.total, 'job')}`;
}

// ---------- analysis ----------

const JOB_ID_RE = /^[A-Za-z_][A-Za-z0-9_-]*$/;
const NOT_ON_REUSABLE = ['runs-on', 'steps', 'environment', 'env', 'container', 'services'];

export function analyzeWorkflow(wf: Workflow): Analysis {
  const findings: Finding[] = [];
  const byId = new Map(wf.jobs.map(j => [j.id, j]));
  const missingSet = new Set<string>();

  if (!wf.triggers.length) findings.push({ severity: 'error', message: 'No "on:" key. A workflow needs at least one trigger event.' });
  if (!wf.jobs.length) findings.push({ severity: 'error', message: 'No jobs found. A workflow needs a "jobs:" mapping with at least one job.' });

  for (const j of wf.jobs) {
    if (!JOB_ID_RE.test(j.id)) {
      findings.push({ severity: 'error', jobId: j.id, message: `Job id "${short(j.id, 40)}" is not valid. Job ids must start with a letter or _ and contain only letters, digits, - and _.` });
    }
    if (!j.uses && !j.runsOn) {
      findings.push({ severity: 'error', jobId: j.id, message: `Job "${j.id}" has no runs-on. Every job needs runs-on unless it calls a reusable workflow with uses:.` });
    }
    if (j.uses) {
      const bad = NOT_ON_REUSABLE.filter(k => j.keys.includes(k));
      if (bad.length) findings.push({ severity: 'warning', jobId: j.id, message: `Job "${j.id}" calls a reusable workflow, which does not support ${bad.join(', ')} on the calling job.` });
    }
    for (const n of j.needs) {
      if (!byId.has(n)) {
        missingSet.add(n);
        findings.push({ severity: 'error', jobId: j.id, message: `Job "${j.id}" needs "${short(n, 40)}", but no job has that id. GitHub rejects the workflow until this is fixed.` });
      }
    }
    if (j.matrix?.total != null && j.matrix.total > MATRIX_JOB_LIMIT) {
      findings.push({ severity: 'error', jobId: j.id, message: `Job "${j.id}" has a matrix of ${j.matrix.total} jobs. GitHub allows at most ${MATRIX_JOB_LIMIT} per workflow run.` });
    }
    if (j.matrix?.total === 0) {
      findings.push({ severity: 'warning', jobId: j.id, message: `Job "${j.id}" has a matrix with no combinations left.` });
    }
  }

  // Duplicate display names (ids are unique by YAML; js-yaml rejects duplicate keys).
  const names = new Map<string, string[]>();
  for (const j of wf.jobs) {
    if (!j.name || j.name.includes('${{')) continue;
    names.set(j.name, [...(names.get(j.name) ?? []), j.id]);
  }
  for (const [name, ids] of names) {
    if (ids.length > 1) findings.push({ severity: 'warning', message: `Jobs ${ids.map(i => `"${i}"`).join(', ')} share the name "${short(name, 40)}", so they look the same in the Actions run view.` });
  }

  // Cycles: Tarjan's strongly connected components over existing needs edges.
  const cycleJobs = new Set<string>();
  const cycles = findCycles(wf.jobs, byId);
  for (const c of cycles) {
    c.forEach(id => cycleJobs.add(id));
    const text = c.length === 1 ? `Job "${c[0]}" needs itself.` : `Needs cycle: ${[...c, c[0]].join(' → ')}.`;
    findings.push({ severity: 'error', jobId: c[0], message: `${text} Jobs in a cycle can never start; GitHub rejects the workflow.` });
  }

  // Blocked: depends (transitively) on a missing job or on a cycle.
  const blocked = new Set<string>();
  const memo = new Map<string, boolean>();
  const isBlocked = (id: string, seen: Set<string>): boolean => {
    if (memo.has(id)) return memo.get(id)!;
    if (seen.has(id)) return true;
    seen.add(id);
    const j = byId.get(id)!;
    const r = j.needs.some(n => !byId.has(n) || cycleJobs.has(n) || isBlocked(n, seen));
    seen.delete(id);
    memo.set(id, r);
    return r;
  };
  for (const j of wf.jobs) if (!cycleJobs.has(j.id) && isBlocked(j.id, new Set())) blocked.add(j.id);
  if (blocked.size) {
    findings.push({ severity: 'warning', message: `${plural(blocked.size, 'job')} depend on a missing job or a cycle, so they have no valid start order: ${[...blocked].slice(0, 12).join(', ')}${blocked.size > 12 ? ', …' : ''}.` });
  }

  // Stages and critical path over the valid part of the graph.
  const valid = wf.jobs.filter(j => !cycleJobs.has(j.id) && !blocked.has(j.id));
  const level = new Map<string, number>();
  const prev = new Map<string, string | undefined>();
  const depth = (id: string): number => {
    if (level.has(id)) return level.get(id)!;
    const j = byId.get(id)!;
    let best = 0, from: string | undefined;
    for (const n of j.needs) {
      const d = depth(n) + 1;
      if (d > best) { best = d; from = n; }
    }
    level.set(id, best);
    prev.set(id, from);
    return best;
  };
  valid.forEach(j => depth(j.id));
  const stages: string[][] = [];
  for (const j of valid) (stages[level.get(j.id)!] ??= []).push(j.id);

  let criticalPath: string[] = [];
  if (valid.length) {
    let end = valid[0].id;
    for (const j of valid) if (level.get(j.id)! > level.get(end)!) end = j.id;
    for (let cur: string | undefined = end; cur; cur = prev.get(cur)) criticalPath.unshift(cur);
  }
  if (criticalPath.length >= LONG_CHAIN) {
    findings.push({ severity: 'info', message: `Long chain: ${criticalPath.length} jobs run one after another (${criticalPath.join(' → ')}). Each one waits for the previous job to finish.` });
  }

  stages.forEach((s, i) => {
    if (s && s.length > 1) {
      const start = i === 0 ? 'start together when the workflow runs' : `can run at the same time once stage ${i} is done`;
      findings.push({ severity: 'info', message: `Stage ${i + 1}: ${s.slice(0, 10).join(', ')}${s.length > 10 ? `, and ${s.length - 10} more` : ''} ${start} (no needs between them).` });
    }
  });

  // Redundant needs: A is listed, but another listed need already depends on A.
  const ancestors = new Map<string, Set<string>>();
  const anc = (id: string): Set<string> => {
    if (ancestors.has(id)) return ancestors.get(id)!;
    const s = new Set<string>();
    ancestors.set(id, s);
    for (const n of byId.get(id)!.needs) {
      if (!byId.has(n) || cycleJobs.has(n)) continue;
      s.add(n);
      anc(n).forEach(x => s.add(x));
    }
    return s;
  };
  for (const j of valid) {
    for (const a of j.needs) {
      const via = j.needs.find(b => b !== a && anc(b).has(a));
      if (via) findings.push({ severity: 'info', jobId: j.id, message: `"${j.id}" needs "${a}", but "${via}" already waits for "${a}". The extra need does not change the order; keep it if "${j.id}" reads needs.${a}.outputs or needs.${a}.result.` });
    }
  }

  // Isolated jobs, only meaningful when other jobs are linked.
  const hasDependents = new Set(wf.jobs.flatMap(j => j.needs));
  const linked = wf.jobs.some(j => j.needs.length);
  if (linked && wf.jobs.length >= 3) {
    for (const j of wf.jobs) {
      if (!j.needs.length && !hasDependents.has(j.id)) {
        findings.push({ severity: 'info', jobId: j.id, message: `"${j.id}" has no needs and no job needs it. It runs on its own as soon as the workflow starts.` });
      }
    }
  }

  // Conditional jobs that others need: a skipped job also skips its dependents by default.
  for (const j of wf.jobs) {
    if (!j.if) continue;
    const deps = wf.jobs.filter(d => d.needs.includes(j.id)).map(d => d.id);
    if (deps.length) findings.push({ severity: 'info', jobId: j.id, message: `"${j.id}" has an if: condition. When it is skipped, ${deps.slice(0, 6).join(', ')} ${deps.length === 1 ? 'is' : 'are'} skipped too, unless their own if: uses a status check such as always() or !cancelled().` });
  }

  return { findings, criticalPath, stages, cycleJobs, blockedJobs: blocked, missing: [...missingSet] };
}

function findCycles(jobs: Job[], byId: Map<string, Job>): string[][] {
  let index = 0;
  const idx = new Map<string, number>(), low = new Map<string, number>(), on = new Set<string>();
  const stack: string[] = [];
  const out: string[][] = [];
  // Iterative Tarjan, so very long chains cannot overflow the call stack.
  for (const root of jobs) {
    if (idx.has(root.id)) continue;
    const work: { id: string; i: number }[] = [{ id: root.id, i: 0 }];
    idx.set(root.id, index); low.set(root.id, index); index++; stack.push(root.id); on.add(root.id);
    while (work.length) {
      const top = work[work.length - 1];
      const needs = byId.get(top.id)!.needs.filter(n => byId.has(n));
      if (top.i < needs.length) {
        const n = needs[top.i++];
        if (!idx.has(n)) {
          idx.set(n, index); low.set(n, index); index++; stack.push(n); on.add(n);
          work.push({ id: n, i: 0 });
        } else if (on.has(n)) {
          low.set(top.id, Math.min(low.get(top.id)!, idx.get(n)!));
        }
        continue;
      }
      work.pop();
      if (work.length) {
        const parent = work[work.length - 1].id;
        low.set(parent, Math.min(low.get(parent)!, low.get(top.id)!));
      }
      if (low.get(top.id) === idx.get(top.id)) {
        const comp: string[] = [];
        let x: string;
        do { x = stack.pop()!; on.delete(x); comp.push(x); } while (x !== top.id);
        const self = byId.get(top.id)!.needs.includes(top.id);
        if (comp.length > 1 || self) out.push(orderCycle(comp, byId));
      }
    }
  }
  return out;
}

/** Orders a strongly connected component as a readable loop where possible (a needs b needs c …). */
function orderCycle(comp: string[], byId: Map<string, Job>): string[] {
  if (comp.length === 1) return comp;
  const set = new Set(comp);
  const start = comp.slice().sort()[0];
  const path = [start];
  const seen = new Set(path);
  let cur = start;
  for (;;) {
    const next = byId.get(cur)!.needs.find(n => set.has(n) && !seen.has(n));
    if (!next) break;
    path.push(next); seen.add(next); cur = next;
  }
  for (const c of comp) if (!seen.has(c)) path.push(c);
  return path;
}

// ---------- Mermaid ----------

const ENTITY: Record<string, string> = {
  '"': '#quot;', '#': '#35;', '<': '#lt;', '>': '#gt;', '&': '#amp;', '`': '#96;', ';': '#59;', '%': '#37;',
  '|': '#124;', '{': '#123;', '}': '#125;', '[': '#91;', ']': '#93;', '\\': '#92;',
};

/** Escapes one label line for a quoted Mermaid flowchart label. */
export function escapeLabel(s: string, max = 60): string {
  // eslint-disable-next-line no-control-regex
  const clean = short(s.replace(/[\u0000-\u001f\u007f\u2028\u2029]/g, ' '), max);
  return Array.from(clean, c => ENTITY[c] ?? c).join('');
}

const label = (lines: string[]) => `"${lines.filter(l => l !== '').map(l => escapeLabel(l)).join('<br/>')}"`;

export interface MermaidOptions { showSteps?: boolean }
export interface MermaidResult { text: string; drawnJobs: number; capped: boolean; stepsCapped: boolean }

export function jobLines(j: Job): string[] {
  const lines = [j.name && j.name !== j.id ? `${j.name} (${j.id})` : j.id];
  if (j.uses) lines.push(`uses: ${j.uses}`);
  else lines.push(`runs-on: ${j.runsOn ?? 'missing'}`);
  if (j.matrix) lines.push(matrixText(j.matrix));
  if (j.environment) lines.push(`environment: ${j.environment}`);
  if (j.if) lines.push(`if: ${j.if}`);
  return lines;
}

export function buildMermaid(wf: Workflow, an: Analysis, opts: MermaidOptions = {}): MermaidResult {
  const out: string[] = ['flowchart LR'];
  const drawn = wf.jobs.slice(0, MAX_DRAWN_JOBS);
  const nid = new Map(drawn.map((j, i) => [j.id, `j${i}`]));
  const crit = new Set(an.criticalPath);
  const critEdges: number[] = [];
  let edgeCount = 0;
  let stepNodes = 0;
  let stepsCapped = false;

  if (wf.triggers.length) {
    out.push('  subgraph triggers["Triggers"]');
    out.push('    direction TB');
    wf.triggers.slice(0, 20).forEach((t, i) => out.push(`    t${i}(${label([t.event, ...t.details.slice(0, 3)])})`));
    if (wf.triggers.length > 20) out.push(`    t_more(${label([`+${wf.triggers.length - 20} more events`])})`);
    out.push('  end');
  }

  for (const j of drawn) {
    const id = nid.get(j.id)!;
    if (opts.showSteps && j.steps.length) {
      out.push(`  subgraph ${id}[${label(jobLines(j))}]`);
      out.push('    direction TB');
      const room = Math.max(0, Math.min(MAX_STEPS_PER_JOB, MAX_STEP_NODES - stepNodes));
      const shown = j.steps.slice(0, room);
      shown.forEach((s, k) => out.push(`    ${id}s${k}[${label([`${k + 1}. ${s.label}`])}]`));
      stepNodes += shown.length;
      if (shown.length < j.steps.length) {
        stepsCapped = true;
        out.push(`    ${id}more[${label([`+${j.steps.length - shown.length} more steps`])}]`);
      }
      const chain = [...shown.map((_, k) => `${id}s${k}`), ...(shown.length < j.steps.length ? [`${id}more`] : [])];
      for (let k = 1; k < chain.length; k++) { out.push(`    ${chain[k - 1]} --> ${chain[k]}`); edgeCount++; }
      out.push('  end');
    } else {
      out.push(j.uses ? `  ${id}[[${label(jobLines(j))}]]` : `  ${id}[${label(jobLines(j))}]`);
    }
  }
  if (wf.jobs.length > drawn.length) out.push(`  j_more[${label([`+${wf.jobs.length - drawn.length} more jobs not drawn`])}]`);

  const missingIds = new Map<string, string>();
  an.missing.forEach((m, i) => {
    missingIds.set(m, `m${i}`);
    out.push(`  m${i}[${label([`missing: ${m}`])}]`);
  });

  if (wf.triggers.length) {
    for (const j of drawn) {
      if (j.needs.length) continue;
      out.push(`  triggers --> ${nid.get(j.id)}`);
      edgeCount++;
    }
  }
  for (const j of drawn) {
    for (const n of j.needs) {
      const to = nid.get(j.id)!;
      if (missingIds.has(n)) { out.push(`  ${missingIds.get(n)} -.-> ${to}`); edgeCount++; continue; }
      const from = nid.get(n);
      if (!from) continue;
      out.push(`  ${from} --> ${to}`);
      const i = an.criticalPath.indexOf(j.id);
      if (i > 0 && an.criticalPath[i - 1] === n) critEdges.push(edgeCount);
      edgeCount++;
    }
  }

  out.push('  classDef crit stroke:#d97706,stroke-width:3px');
  out.push('  classDef cond stroke-dasharray:6 4');
  out.push('  classDef bad stroke:#dc2626,stroke-width:2px,stroke-dasharray:4 3');
  const critNodes = drawn.filter(j => crit.has(j.id) && an.criticalPath.length > 1).map(j => nid.get(j.id)!);
  const badNodes = drawn.filter(j => an.cycleJobs.has(j.id) || an.blockedJobs.has(j.id)).map(j => nid.get(j.id)!);
  const condNodes = drawn.filter(j => j.if && !an.cycleJobs.has(j.id) && !an.blockedJobs.has(j.id)).map(j => nid.get(j.id)!);
  if (condNodes.length) out.push(`  class ${condNodes.join(',')} cond`);
  if (critNodes.length) out.push(`  class ${critNodes.join(',')} crit`);
  const bad = [...badNodes, ...missingIds.values()];
  if (bad.length) out.push(`  class ${bad.join(',')} bad`);
  if (critEdges.length && an.criticalPath.length > 1) out.push(`  linkStyle ${critEdges.join(',')} stroke:#d97706,stroke-width:3px`);

  return { text: out.join('\n') + '\n', drawnJobs: drawn.length, capped: wf.jobs.length > drawn.length, stepsCapped };
}

// ---------- one call for the component ----------

export interface VisualizeResult {
  ok: boolean;
  error?: string;
  workflow?: Workflow;
  analysis?: Analysis;
  mermaid?: MermaidResult;
}

export function visualize(text: string, opts: MermaidOptions = {}): VisualizeResult {
  const p = parseWorkflow(text);
  if (!p.ok) return { ok: false, error: p.error };
  const analysis = analyzeWorkflow(p.workflow);
  if (!p.workflow.jobs.length) return { ok: true, workflow: p.workflow, analysis };
  return { ok: true, workflow: p.workflow, analysis, mermaid: buildMermaid(p.workflow, analysis, opts) };
}

// ---------- examples ----------

export const EXAMPLE_CI = `name: CI
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  schedule:
    - cron: '0 3 * * 1'
  workflow_dispatch:

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: npm ci
      - run: npm run lint

  test:
    needs: lint
    runs-on: \${{ matrix.os }}
    strategy:
      matrix:
        os: [ubuntu-latest, windows-latest, macos-latest]
        node: [20, 22]
        exclude:
          - os: macos-latest
            node: 20
        include:
          - os: ubuntu-latest
            node: 24
            experimental: true
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm test

  build:
    needs: [lint, test]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci && npm run build
      - uses: actions/upload-artifact@v4
        with:
          name: dist
          path: dist/

  docs:
    needs: lint
    runs-on: ubuntu-latest
    steps:
      - run: echo "Build docs for https://docs.example.com"

  deploy:
    name: Deploy to production
    needs: build
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    runs-on: ubuntu-latest
    environment:
      name: production
      url: https://app.example.com
    steps:
      - uses: actions/download-artifact@v4
        with:
          name: dist
      - run: ./scripts/deploy.sh 10.0.0.12
`;

export const EXAMPLE_REUSABLE = `name: Release
on:
  push:
    tags: ['v*']
  workflow_dispatch:
    inputs:
      dry-run:
        type: boolean
        default: true

jobs:
  test:
    uses: ./.github/workflows/test.yml
    with:
      node-version: 22

  security-scan:
    uses: acme/shared-workflows/.github/workflows/scan.yml@v2
    secrets: inherit

  publish:
    needs: [test, security-scan]
    runs-on: ubuntu-latest
    environment: release
    steps:
      - uses: actions/checkout@v4
      - run: npm publish --dry-run=\${{ inputs.dry-run }}

  notify:
    needs: publish
    if: always()
    uses: acme/shared-workflows/.github/workflows/notify.yml@v2
    with:
      channel: releases
`;

export const EXAMPLE_BROKEN = `name: Broken pipeline
on: push

jobs:
  build:
    name: Build
    runs-on: ubuntu-latest
    steps:
      - run: make build

  test:
    needs: biuld
    runs-on: ubuntu-latest
    steps:
      - run: make test

  package:
    needs: test
    steps:
      - run: make package

  lint:
    name: Build
    runs-on: ubuntu-latest
    steps:
      - run: make lint
`;
