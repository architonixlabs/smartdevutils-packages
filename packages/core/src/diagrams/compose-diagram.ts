import { loadYaml } from '../yaml';
import { DIAGRAM_CAP, FlowChart, FlowEdge, FlowGroup, FlowNode, renderFlowchart } from './flowchart';

/**
 * Builds a Mermaid flowchart from a Docker Compose file: services, depends_on (with conditions),
 * networks as subgraphs, published ports from a "Host" node, named volumes as cylinders,
 * extends, profiles and network_mode. Used by Docker Compose Validator and docker run ↔ Compose.
 */

type Obj = Record<string, unknown>;

export interface ComposeDiagram {
  /** Mermaid source; empty when there is nothing to draw. */
  mermaid: string;
  services: number;
  truncated: boolean;
  /** Plain-English findings that the diagram highlights (cycles, unknown services). */
  problems: string[];
}

const EMPTY: ComposeDiagram = { mermaid: '', services: 0, truncated: false, problems: [] };

function isObj(v: unknown): v is Obj {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Short syntax as written; long syntax ({published, target} / {source, target}) as "a:b". */
export function asString(v: unknown): string {
  if (isObj(v)) {
    const src = v['published'] ?? v['source'];
    const dst = v['target'];
    return [src, dst].filter(x => x !== undefined && x !== null).map(x => String(x)).join(':');
  }
  return typeof v === 'string' ? v : String(v ?? '');
}

/** Named-volume reference (vs bind mount path, ~, ./, /abs, C:\\, ${VAR}/...) or null. */
export function namedVolumeOf(vol: unknown): string | null {
  if (isObj(vol)) {
    const type = vol['type'];
    const src = vol['source'];
    return (type === undefined || type === 'volume') && typeof src === 'string' && src ? src : null;
  }
  const first = asString(vol).split(':')[0];
  return /^[A-Za-z0-9][\w.-]*$/.test(first) && !/^[A-Za-z]$/.test(first) ? first : null;
}

/** Container path of a volume entry ("pgdata:/var/lib/x:ro" → "/var/lib/x"). */
function mountTarget(vol: unknown): string {
  if (isObj(vol)) return typeof vol['target'] === 'string' ? vol['target'] : '';
  const parts = asString(vol).split(':');
  return parts.length >= 2 ? parts[1] : '';
}

/** "8080:80" → "8080 → 80"; "127.0.0.1:8080:80/udp" → "127.0.0.1:8080 → 80/udp"; container-only → null host. */
export function portMapping(p: unknown): { host: string | null; container: string } {
  if (isObj(p)) {
    const proto = typeof p['protocol'] === 'string' && p['protocol'] !== 'tcp' ? `/${p['protocol']}` : '';
    const ip = p['host_ip'] ? `${p['host_ip']}:` : '';
    const pub = p['published'];
    return { host: pub === undefined || pub === null || pub === '' ? null : `${ip}${pub}`, container: `${p['target'] ?? '?'}${proto}` };
  }
  let s = asString(p).trim();
  const m = /\/(tcp|udp|sctp)$/i.exec(s);
  const proto = m && m[1].toLowerCase() !== 'tcp' ? `/${m[1].toLowerCase()}` : '';
  if (m) s = s.slice(0, m.index);
  let ip = '';
  const v6 = /^(\[[^\]]*\]):/.exec(s);
  if (v6) { ip = v6[1] + ':'; s = s.slice(v6[0].length); }
  const parts = s.split(':');
  if (parts.length === 1) return v6 ? { host: ip + parts[0], container: parts[0] + proto } : { host: null, container: parts[0] + proto };
  const container = parts[parts.length - 1] + proto;
  const host = parts.length >= 3 ? `${parts.slice(0, -2).join(':')}:${parts[parts.length - 2]}` : parts[0];
  return { host: host === '' ? null : ip + host, container };
}

interface Dep { target: string; condition?: string; optional: boolean }

function dependsOf(v: unknown): Dep[] {
  if (typeof v === 'string') return [{ target: v, optional: false }];
  if (Array.isArray(v)) return v.map(x => ({ target: asString(x), optional: false })).filter(d => d.target);
  if (isObj(v)) {
    return Object.entries(v).map(([target, cfg]) => ({
      target,
      condition: isObj(cfg) && typeof cfg['condition'] === 'string' ? cfg['condition'] : undefined,
      optional: isObj(cfg) && cfg['required'] === false,
    }));
  }
  return [];
}

function networksOf(svc: Obj): string[] {
  const n = svc['networks'];
  if (Array.isArray(n)) return n.map(asString).filter(Boolean);
  if (isObj(n)) return Object.keys(n);
  return [];
}

/** Services that sit on a depends_on cycle, as strongly connected components (Tarjan). */
function cycles(graph: Map<string, string[]>): string[][] {
  let index = 0;
  const idx = new Map<string, number>(), low = new Map<string, number>(), on = new Set<string>();
  const stack: string[] = [], out: string[][] = [];
  const visit = (v: string): void => {
    idx.set(v, index); low.set(v, index); index++;
    stack.push(v); on.add(v);
    for (const w of graph.get(v) ?? []) {
      if (!idx.has(w)) { visit(w); low.set(v, Math.min(low.get(v)!, low.get(w)!)); }
      else if (on.has(w)) low.set(v, Math.min(low.get(v)!, idx.get(w)!));
    }
    if (low.get(v) === idx.get(v)) {
      const comp: string[] = [];
      let w: string;
      do { w = stack.pop()!; on.delete(w); comp.push(w); } while (w !== v);
      if (comp.length > 1 || (graph.get(v) ?? []).includes(v)) out.push(comp.reverse());
    }
  };
  for (const v of graph.keys()) if (!idx.has(v)) visit(v);
  return out;
}

const CLASS_DEFS: Record<string, string> = {
  problem: 'stroke:#dc2626,stroke-width:2px',
  missing: 'stroke:#dc2626,stroke-width:2px,stroke-dasharray:5 5',
  warn: 'stroke:#d97706,stroke-width:2px,stroke-dasharray:5 5',
  host: 'stroke:#6b7280,stroke-dasharray:3 3',
};

/** Parses Compose YAML and builds the diagram; returns an empty diagram for invalid or empty input. */
export function composeTextToMermaid(text: string, cap = DIAGRAM_CAP): ComposeDiagram {
  if (!text.trim()) return EMPTY;
  let doc: unknown;
  try { doc = loadYaml(text.replace(/^\uFEFF/, '')); } catch { return EMPTY; }
  return composeToMermaid(doc, cap);
}

export function composeToMermaid(doc: unknown, cap = DIAGRAM_CAP): ComposeDiagram {
  if (!isObj(doc) || !isObj(doc['services'])) return EMPTY;
  const allNames = Object.keys(doc['services']);
  if (allNames.length === 0) return EMPTY;
  const services = doc['services'] as Obj;
  const names = allNames.slice(0, cap);
  const topVolumes = isObj(doc['volumes']) ? Object.keys(doc['volumes']) : [];
  const topNetworks = isObj(doc['networks']) ? Object.keys(doc['networks']) : [];

  const svcId = new Map(names.map((n, i) => [n, `s${i}`]));
  const nodes: FlowNode[] = [];
  const edges: FlowEdge[] = [];
  const groups: FlowGroup[] = [];
  const problems: string[] = [];

  // depends_on graph and cycles
  const deps = new Map<string, Dep[]>();
  for (const n of names) deps.set(n, isObj(services[n]) ? dependsOf((services[n] as Obj)['depends_on']) : []);
  const graph = new Map(names.map(n => [n, deps.get(n)!.map(d => d.target).filter(t => svcId.has(t))]));
  const cyc = cycles(graph);
  const cycleOf = new Map<string, number>();
  cyc.forEach((c, i) => c.forEach(s => cycleOf.set(s, i)));
  for (const c of cyc) {
    problems.push(c.length === 1
      ? `Dependency cycle: ${c[0]} depends on itself.`
      : `Dependency cycle: ${[...c, c[0]].join(' → ')}. Compose cannot start these services.`);
  }

  // networks: a service on exactly one network sits inside that network's box
  const netsOf = new Map(names.map(n => [n, isObj(services[n]) ? networksOf(services[n] as Obj) : []]));
  const anyNetworks = topNetworks.length > 0 || [...netsOf.values()].some(l => l.length > 0);
  const allNets = [...new Set([...topNetworks, ...[...netsOf.values()].flat()])];
  const netMembers = new Map<string, string[]>(allNets.map(n => [n, []]));
  if (anyNetworks) {
    for (const n of names) {
      const svc = services[n];
      const mode = isObj(svc) ? svc['network_mode'] : undefined;
      if (mode !== undefined) continue;
      const list = netsOf.get(n)!;
      if (list.length === 0) {
        if (!netMembers.has('default')) netMembers.set('default', []);
        netMembers.get('default')!.push(n);
      } else if (list.length === 1) netMembers.get(list[0])!.push(n);
    }
  }
  const netId = new Map<string, string>();
  [...netMembers.keys()].forEach((net, i) => netId.set(net, `n${i}`));
  for (const [net, members] of netMembers) {
    const id = netId.get(net)!;
    const undefinedNet = net !== 'default' && !topNetworks.includes(net);
    const label = `network: ${net}${undefinedNet ? ' (not in top-level networks)' : ''}`;
    if (members.length) groups.push({ id, label });
    else nodes.push({ id, lines: [label], shape: 'hexagon', classes: undefinedNet ? ['warn'] : undefined });
  }
  const groupOf = new Map<string, string>();
  for (const [net, members] of netMembers) for (const m of members) groupOf.set(m, netId.get(net)!);

  // service nodes
  let hostEdges = 0;
  const hostPortEdges: FlowEdge[] = [];
  const volumeIds = new Map<string, string>();
  const volumeEdges: FlowEdge[] = [];
  const missing = new Map<string, string>();
  for (const name of names) {
    const id = svcId.get(name)!;
    const svc = isObj(services[name]) ? services[name] as Obj : {};
    const lines = [name];
    if (typeof svc['image'] === 'string') lines.push(svc['image']);
    else if (svc['build'] !== undefined) lines.push(`build: ${isObj(svc['build']) ? asString(svc['build']['context'] ?? '.') : asString(svc['build'])}`);
    const profiles = Array.isArray(svc['profiles']) ? svc['profiles'].map(asString) : [];
    if (profiles.length) lines.push(`profiles: ${profiles.join(', ')}`);
    const ext = svc['extends'];
    const extName = typeof ext === 'string' ? ext : isObj(ext) && typeof ext['service'] === 'string' ? ext['service'] : '';
    const extFile = isObj(ext) && typeof ext['file'] === 'string' ? ext['file'] : '';
    if (extName) {
      if (extFile || !svcId.has(extName)) lines.push(`extends: ${extName}${extFile ? ` (${extFile})` : ''}`);
      else edges.push({ from: id, to: svcId.get(extName)!, label: 'extends', dotted: true });
    }
    const mode = svc['network_mode'];
    if (typeof mode === 'string') {
      const shared = /^(service|container):(.+)$/.exec(mode);
      if (shared && shared[1] === 'service' && svcId.has(shared[2])) {
        edges.push({ from: id, to: svcId.get(shared[2])!, label: 'shares network', dotted: true });
      } else lines.push(`network_mode: ${mode}`);
    }
    const nets = netsOf.get(name)!;
    if (nets.length > 1) for (const net of nets) edges.push({ from: id, to: netId.get(net)!, dotted: true, plain: true });

    const ports = Array.isArray(svc['ports']) ? svc['ports'].map(portMapping) : [];
    const published = ports.filter(p => p.host !== null);
    const internal = ports.filter(p => p.host === null);
    if (internal.length) lines.push(`port ${internal.map(p => p.container).join(', ')} (no host port)`);
    if (published.length) {
      hostEdges++;
      hostPortEdges.push({ from: 'host', to: id, label: published.map(p => `${p.host} → ${p.container}`).join(', ') });
    }

    let binds = 0;
    for (const v of Array.isArray(svc['volumes']) ? svc['volumes'] : []) {
      const vol = namedVolumeOf(v);
      if (!vol) { binds++; continue; }
      if (!volumeIds.has(vol)) volumeIds.set(vol, `v${volumeIds.size}`);
      volumeEdges.push({ from: id, to: volumeIds.get(vol)!, label: mountTarget(v), plain: true });
    }
    if (binds) lines.push(`${binds} bind mount${binds === 1 ? '' : 's'}`);

    const inCycle = cycleOf.has(name);
    nodes.push({ id, lines, shape: 'round', group: groupOf.get(name), classes: inCycle ? ['problem'] : undefined });

    for (const d of deps.get(name)!) {
      const label = [d.condition, d.optional ? 'optional' : ''].filter(Boolean).join(', ');
      const target = svcId.get(d.target);
      if (target) {
        const sameCycle = inCycle && cycleOf.get(d.target) === cycleOf.get(name);
        edges.push({ from: id, to: target, label: label || undefined, dotted: d.optional, problem: sameCycle });
      } else if (!allNames.includes(d.target)) {
        if (!missing.has(d.target)) {
          missing.set(d.target, `m${missing.size}`);
          problems.push(`depends_on names "${d.target}", which is not a service in this file.`);
        }
        edges.push({ from: id, to: missing.get(d.target)!, label: label || 'not defined', dotted: true, problem: true });
      }
    }
  }
  for (const [dep, id] of missing) nodes.push({ id, lines: [dep, 'not a service in this file'], classes: ['missing'] });
  for (const [vol, id] of volumeIds) {
    const known = topVolumes.includes(vol);
    nodes.push({ id, lines: known ? [vol] : [vol, 'not in top-level volumes'], shape: 'cylinder', classes: known ? undefined : ['warn'] });
  }
  for (const vol of topVolumes) {
    if (volumeIds.has(vol)) continue;
    volumeIds.set(vol, `v${volumeIds.size}`);
    nodes.push({ id: volumeIds.get(vol)!, lines: [vol, 'not used'], shape: 'cylinder' });
  }
  if (hostEdges) nodes.unshift({ id: 'host', lines: ['Host'], shape: 'stadium', classes: ['host'] });

  // service and host nodes first so the cap drops volumes and networks before services
  const order = (n: FlowNode) => (n.id === 'host' ? 0 : n.id.startsWith('s') ? 1 : n.id.startsWith('m') ? 2 : 3);
  nodes.sort((a, b) => order(a) - order(b));
  const r = renderFlowchart({
    direction: 'LR', nodes, groups, edges: [...edges, ...hostPortEdges, ...volumeEdges], classDefs: CLASS_DEFS,
  }, cap);
  return { mermaid: r.text, services: names.length, truncated: r.truncated || allNames.length > names.length, problems };
}
