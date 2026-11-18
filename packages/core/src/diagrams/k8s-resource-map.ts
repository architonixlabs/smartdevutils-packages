import { loadAllYaml } from '../yaml';
import { DIAGRAM_CAP, FlowEdge, FlowGroup, FlowNode, FlowShape, renderFlowchart } from './flowchart';

/**
 * Resource map for Kubernetes manifests: Ingress → Service → workloads (matched by selector),
 * ConfigMap / Secret / PVC references, HPA targets, one subgraph per namespace.
 * Multi-document YAML and kind: List (or any *List with items) are read.
 */

type Obj = Record<string, unknown>;

export interface K8sResourceMap {
  /** Mermaid source; empty when no supported resource was found. */
  mermaid: string;
  resources: number;
  truncated: boolean;
  /** Things the diagram marks: selectors without a workload, Ingress to an absent Service. */
  problems: string[];
  /** Names referenced but not in the input (they may exist in the cluster). */
  notInInput: string[];
}

const EMPTY: K8sResourceMap = { mermaid: '', resources: 0, truncated: false, problems: [], notInInput: [] };

const WORKLOADS = ['Deployment', 'StatefulSet', 'DaemonSet', 'ReplicaSet', 'Job', 'CronJob', 'Pod', 'ReplicationController'];
const KINDS = new Set(['Ingress', 'Service', 'ConfigMap', 'Secret', 'PersistentVolumeClaim', 'HorizontalPodAutoscaler', ...WORKLOADS]);
const SHAPE: Record<string, FlowShape> = {
  Ingress: 'asym', Service: 'stadium', ConfigMap: 'parallelogram', Secret: 'parallelogram',
  PersistentVolumeClaim: 'cylinder', HorizontalPodAutoscaler: 'hexagon',
};
const ORDER = ['Ingress', 'Service', 'HorizontalPodAutoscaler', ...WORKLOADS, 'ConfigMap', 'Secret', 'PersistentVolumeClaim'];

const CLASS_DEFS: Record<string, string> = {
  problem: 'stroke:#dc2626,stroke-width:2px',
  absent: 'stroke:#6b7280,stroke-width:1px,stroke-dasharray:5 5',
  absentProblem: 'stroke:#dc2626,stroke-width:2px,stroke-dasharray:5 5',
};

function isObj(v: unknown): v is Obj {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
function obj(v: unknown): Obj { return isObj(v) ? v : {}; }
function arr(v: unknown): unknown[] { return Array.isArray(v) ? v : []; }
function str(v: unknown): string { return typeof v === 'string' || typeof v === 'number' ? String(v) : ''; }

interface Res {
  kind: string;
  name: string;
  ns: string;
  doc: Obj;
  id: string;
}

/** Flattens documents and List kinds into resources with a kind and a name. */
export function k8sResources(text: string): Obj[] | null {
  let docs: unknown[];
  try { docs = loadAllYaml(text.replace(/^﻿/, '')); } catch { return null; }
  const out: Obj[] = [];
  const add = (d: unknown, depth: number): void => {
    if (!isObj(d)) return;
    const kind = str(d['kind']);
    if (Array.isArray(d['items']) && (kind === 'List' || kind.endsWith('List')) && depth < 3) {
      for (const it of d['items']) add(it, depth + 1);
      return;
    }
    out.push(d);
  };
  for (const d of docs) add(d, 0);
  return out;
}

/** Pod template of a workload: labels and pod spec. */
function podTemplate(r: Res): { labels: Obj; spec: Obj } {
  const spec = obj(r.doc['spec']);
  if (r.kind === 'Pod') return { labels: obj(obj(r.doc['metadata'])['labels']), spec };
  const tpl = r.kind === 'CronJob' ? obj(obj(obj(spec['jobTemplate'])['spec'])['template']) : obj(spec['template']);
  return { labels: obj(obj(tpl['metadata'])['labels']), spec: obj(tpl['spec']) };
}

interface Ref { kind: 'ConfigMap' | 'Secret' | 'PersistentVolumeClaim'; name: string; via: string }

/** ConfigMap / Secret / PVC names a pod spec uses, with how they are used. */
function podRefs(spec: Obj): Ref[] {
  const refs: Ref[] = [];
  const push = (kind: Ref['kind'], name: unknown, via: string) => { const n = str(name); if (n) refs.push({ kind, name: n, via }); };
  for (const c of [...arr(spec['containers']), ...arr(spec['initContainers']), ...arr(spec['ephemeralContainers'])]) {
    const co = obj(c);
    for (const ef of arr(co['envFrom'])) {
      push('ConfigMap', obj(obj(ef)['configMapRef'])['name'], 'envFrom');
      push('Secret', obj(obj(ef)['secretRef'])['name'], 'envFrom');
    }
    for (const e of arr(co['env'])) {
      const vf = obj(obj(e)['valueFrom']);
      push('ConfigMap', obj(vf['configMapKeyRef'])['name'], 'env');
      push('Secret', obj(vf['secretKeyRef'])['name'], 'env');
    }
  }
  for (const v of arr(spec['volumes'])) {
    const vo = obj(v);
    push('ConfigMap', obj(vo['configMap'])['name'], 'volume');
    push('Secret', obj(vo['secret'])['secretName'], 'volume');
    push('PersistentVolumeClaim', obj(vo['persistentVolumeClaim'])['claimName'], 'volume');
    for (const s of arr(obj(vo['projected'])['sources'])) {
      push('ConfigMap', obj(obj(s)['configMap'])['name'], 'volume');
      push('Secret', obj(obj(s)['secret'])['name'], 'volume');
    }
  }
  for (const s of arr(spec['imagePullSecrets'])) push('Secret', obj(s)['name'], 'imagePullSecrets');
  return refs;
}

interface Backend { service: string; port: string; route: string }

function ingressBackends(spec: Obj): Backend[] {
  const out: Backend[] = [];
  const read = (b: unknown, route: string) => {
    const bo = obj(b);
    const svc = obj(bo['service']);
    const name = str(svc['name']) || str(bo['serviceName']);
    const port = obj(svc['port']);
    const p = str(port['number']) || str(port['name']) || str(bo['servicePort']);
    if (name) out.push({ service: name, port: p, route });
  };
  read(spec['defaultBackend'] ?? spec['backend'], 'default');
  for (const rule of arr(spec['rules'])) {
    const ro = obj(rule);
    const host = str(ro['host']);
    for (const p of arr(obj(ro['http'])['paths'])) {
      const po = obj(p);
      read(po['backend'], `${host}${str(po['path']) || (host ? '' : '/')}`);
    }
  }
  return out;
}

function matches(selector: Obj, labels: Obj): boolean {
  const keys = Object.keys(selector);
  return keys.length > 0 && keys.every(k => str(labels[k]) === str(selector[k]) && k in labels);
}

function servicePorts(spec: Obj): string {
  return arr(spec['ports']).map(p => {
    const po = obj(p);
    const port = str(po['port']), target = str(po['targetPort']);
    return target && target !== port ? `${port} → ${target}` : port;
  }).filter(Boolean).join(', ');
}

export function k8sToMermaid(text: string, cap = DIAGRAM_CAP): K8sResourceMap {
  if (!text.trim()) return EMPTY;
  const all = k8sResources(text);
  if (!all) return EMPTY;

  const res: Res[] = [];
  const seen = new Set<string>();
  for (const d of all) {
    const kind = str(d['kind']);
    const meta = obj(d['metadata']);
    const name = str(meta['name']);
    if (!KINDS.has(kind) || !name) continue;
    const ns = str(meta['namespace']) || 'default';
    const key = `${ns}/${kind}/${name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    res.push({ kind, name, ns, doc: d, id: '' });
  }
  if (res.length === 0) return EMPTY;
  res.sort((a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind));
  res.forEach((r, i) => { r.id = `r${i}`; });

  const byKey = new Map(res.map(r => [`${r.ns}/${r.kind}/${r.name}`, r]));
  const namespaces = [...new Set(res.map(r => r.ns))];
  const nsId = new Map(namespaces.map((n, i) => [n, `ns${i}`]));
  const groups: FlowGroup[] = namespaces.map(n => ({ id: nsId.get(n)!, label: `namespace: ${n}` }));
  const nodes: FlowNode[] = [];
  const edges: FlowEdge[] = [];
  const problems: string[] = [];
  const absent = new Map<string, FlowNode>();
  const notInInput: string[] = [];
  const problemIds = new Set<string>();
  const templates: FlowNode[] = [];

  /** Node for a resource that is referenced but not in the input. */
  const absentNode = (ns: string, kind: string, name: string, problem: boolean): string => {
    const key = `${ns}/${kind}/${name}`;
    let n = absent.get(key);
    if (!n) {
      n = { id: `a${absent.size}`, lines: [kind, name, 'not in input'], shape: SHAPE[kind] ?? 'rect', group: nsId.get(ns), classes: [problem ? 'absentProblem' : 'absent'] };
      absent.set(key, n);
      notInInput.push(`${kind} ${ns}/${name}`);
    }
    return n.id;
  };
  const find = (ns: string, kind: string, name: string) => byKey.get(`${ns}/${kind}/${name}`);
  const workloads = res.filter(r => WORKLOADS.includes(r.kind));

  for (const r of res) {
    const spec = obj(r.doc['spec']);
    if (r.kind === 'Ingress') {
      const merged = new Map<string, string[]>();
      for (const b of ingressBackends(spec)) {
        const label = `${b.route}${b.port ? ` → :${b.port}` : ''}`;
        merged.set(b.service, [...(merged.get(b.service) ?? []), label]);
      }
      for (const [svc, labels] of merged) {
        const target = find(r.ns, 'Service', svc);
        if (target) edges.push({ from: r.id, to: target.id, label: labels.join(', ') });
        else {
          problems.push(`Ingress ${r.name} routes to Service ${svc}, which is not in the input.`);
          edges.push({ from: r.id, to: absentNode(r.ns, 'Service', svc, true), label: labels.join(', '), dotted: true, problem: true });
        }
      }
    } else if (r.kind === 'Service') {
      const selector = obj(spec['selector']);
      if (Object.keys(selector).length === 0 || str(spec['type']) === 'ExternalName') continue;
      const hits = workloads.filter(w => w.ns === r.ns && matches(selector, podTemplate(w).labels));
      const ports = servicePorts(spec);
      for (const w of hits) edges.push({ from: r.id, to: w.id, label: ports || undefined });
      if (hits.length === 0) {
        problemIds.add(r.id);
        const sel = Object.entries(selector).map(([k, v]) => `${k}=${str(v)}`).join(', ');
        problems.push(`Service ${r.name}: no workload in the input has pod labels matching its selector (${sel}).`);
      }
    } else if (r.kind === 'HorizontalPodAutoscaler') {
      const ref = obj(spec['scaleTargetRef']);
      const kind = str(ref['kind']) || 'Deployment';
      const name = str(ref['name']);
      if (!name) continue;
      const target = find(r.ns, kind, name);
      const range = `${str(spec['minReplicas']) || '1'}–${str(spec['maxReplicas']) || '?'} replicas`;
      edges.push(target
        ? { from: r.id, to: target.id, label: `scales ${range}` }
        : { from: r.id, to: absentNode(r.ns, kind, name, false), label: `scales ${range}`, dotted: true });
    } else if (WORKLOADS.includes(r.kind)) {
      const { spec: pod } = podTemplate(r);
      const vias = new Map<string, { kind: Ref['kind']; name: string; via: Set<string> }>();
      for (const ref of podRefs(pod)) {
        const k = `${ref.kind}/${ref.name}`;
        if (!vias.has(k)) vias.set(k, { kind: ref.kind, name: ref.name, via: new Set() });
        vias.get(k)!.via.add(ref.via);
      }
      for (const t of arr(spec['volumeClaimTemplates'])) {
        const name = str(obj(obj(t)['metadata'])['name']);
        if (!name) continue;
        const id = `t${templates.length}`;
        templates.push({ id, lines: ['PVC per pod', `${name}-${r.name}-N`], shape: 'cylinder', group: nsId.get(r.ns) });
        edges.push({ from: r.id, to: id, label: 'volumeClaimTemplate' });
      }
      for (const { kind, name, via } of vias.values()) {
        const target = find(r.ns, kind, name);
        const label = [...via].join(', ');
        edges.push(target ? { from: r.id, to: target.id, label } : { from: r.id, to: absentNode(r.ns, kind, name, false), label, dotted: true });
      }
    }
  }

  for (const r of res) {
    const spec = obj(r.doc['spec']);
    const lines = [r.kind, r.name];
    if (r.kind === 'Service') {
      const type = str(spec['type']);
      if (type && type !== 'ClusterIP') lines.push(type);
      if (problemIds.has(r.id)) lines.push('selector matches no workload');
    } else if (r.kind === 'Ingress') {
      const cls = str(spec['ingressClassName']);
      if (cls) lines.push(`class: ${cls}`);
    } else if (['Deployment', 'StatefulSet', 'ReplicaSet', 'ReplicationController'].includes(r.kind) && spec['replicas'] !== undefined) {
      lines.push(`${str(spec['replicas'])} replica${str(spec['replicas']) === '1' ? '' : 's'}`);
    } else if (r.kind === 'CronJob' && str(spec['schedule'])) {
      lines.push(`schedule: ${str(spec['schedule'])}`);
    } else if (r.kind === 'Secret' && str(r.doc['type'])) {
      lines.push(str(r.doc['type']));
    }
    nodes.push({ id: r.id, lines, shape: SHAPE[r.kind] ?? 'rect', group: nsId.get(r.ns), classes: problemIds.has(r.id) ? ['problem'] : undefined });
  }
  nodes.push(...templates, ...absent.values());

  const out = renderFlowchart({ direction: 'LR', nodes, groups, edges, classDefs: CLASS_DEFS }, cap);
  return { mermaid: out.text, resources: res.length, truncated: out.truncated, problems, notInInput };
}
