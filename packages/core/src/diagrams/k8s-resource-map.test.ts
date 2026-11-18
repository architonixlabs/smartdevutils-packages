import { describe, it, expect } from 'vitest';
import { k8sToMermaid } from './k8s-resource-map';

const STACK = `apiVersion: networking.k8s.io/v1
kind: Ingress
metadata: { name: web, namespace: shop }
spec:
  ingressClassName: nginx
  rules:
    - host: shop.example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend: { service: { name: web-svc, port: { number: 80 } } }
          - path: /api
            pathType: Prefix
            backend: { service: { name: api-svc, port: { name: http } } }
---
apiVersion: v1
kind: Service
metadata: { name: web-svc, namespace: shop }
spec:
  selector: { app: web }
  ports: [{ port: 80, targetPort: 8080 }]
---
apiVersion: apps/v1
kind: Deployment
metadata: { name: web, namespace: shop }
spec:
  replicas: 2
  selector: { matchLabels: { app: web } }
  template:
    metadata: { labels: { app: web, tier: front } }
    spec:
      imagePullSecrets: [{ name: regcred }]
      containers:
        - name: web
          image: example.com/web:1.0
          envFrom: [{ configMapRef: { name: web-config } }]
          env:
            - name: DB_PASSWORD
              valueFrom: { secretKeyRef: { name: db-secret, key: password } }
      volumes:
        - name: data
          persistentVolumeClaim: { claimName: web-data }
---
apiVersion: v1
kind: ConfigMap
metadata: { name: web-config, namespace: shop }
data: { A: "1" }
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata: { name: web-data, namespace: shop }
spec: { accessModes: [ReadWriteOnce], resources: { requests: { storage: 1Gi } } }
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata: { name: web, namespace: shop }
spec:
  scaleTargetRef: { apiVersion: apps/v1, kind: Deployment, name: web }
  minReplicas: 2
  maxReplicas: 10
`;

const idOf = (m: string, kind: string, name: string): string => {
  const re = new RegExp(`^\\s+(\\w+)\\S*"${kind}<br/>${name}(<br/>|")`, 'm');
  const hit = re.exec(m);
  if (!hit) throw new Error(`no node ${kind} ${name} in\n${m}`);
  return hit[1];
};

describe('k8sToMermaid', () => {
  it('returns nothing for empty, invalid or unsupported input', () => {
    expect(k8sToMermaid('').mermaid).toBe('');
    expect(k8sToMermaid('kind: [').mermaid).toBe('');
    expect(k8sToMermaid('apiVersion: v1\nkind: Namespace\nmetadata: { name: x }').mermaid).toBe('');
  });

  it('links Ingress → Service → Deployment and the config it uses', () => {
    const r = k8sToMermaid(STACK);
    const m = r.mermaid;
    expect(m).toContain('subgraph ns0["namespace: shop"]');
    const ing = idOf(m, 'Ingress', 'web'), svc = idOf(m, 'Service', 'web-svc'), dep = idOf(m, 'Deployment', 'web');
    expect(m).toContain(`${ing} -->|"shop.example.com/ → :80"| ${svc}`);
    expect(m).toContain(`${svc} -->|"80 → 8080"| ${dep}`);
    expect(m).toContain(`${dep} -->|"envFrom"| ${idOf(m, 'ConfigMap', 'web-config')}`);
    expect(m).toContain(`${dep} -->|"volume"| ${idOf(m, 'PersistentVolumeClaim', 'web-data')}`);
    expect(m).toContain(`${idOf(m, 'HorizontalPodAutoscaler', 'web')} -->|"scales 2–10 replicas"| ${dep}`);
    expect(m).toContain('2 replicas');
    expect(m).toContain('class: nginx');
  });

  it('marks references that are not in the input without calling them errors', () => {
    const r = k8sToMermaid(STACK);
    expect(r.notInInput).toEqual(['Service shop/api-svc', 'Secret shop/db-secret', 'Secret shop/regcred']);
    expect(r.mermaid).toContain('"Secret<br/>db-secret<br/>not in input"/]:::absent');
    expect(r.mermaid).toMatch(/-\.->\|"imagePullSecrets"\| a\d/);
    // an Ingress to a Service that is not in the input is a marked problem
    expect(r.problems).toEqual(['Ingress web routes to Service api-svc, which is not in the input.']);
    expect(r.mermaid).toContain('"Service<br/>api-svc<br/>not in input"]):::absentProblem');
  });

  it('flags a Service whose selector matches no workload', () => {
    const r = k8sToMermaid(`apiVersion: v1
kind: Service
metadata: { name: orphan }
spec: { selector: { app: nothing }, ports: [{ port: 80 }] }
---
apiVersion: apps/v1
kind: Deployment
metadata: { name: other }
spec:
  template:
    metadata: { labels: { app: other } }
    spec: { containers: [{ name: c, image: x }] }
`);
    expect(r.problems[0]).toContain('Service orphan: no workload in the input has pod labels matching its selector (app=nothing)');
    expect(r.mermaid).toContain('selector matches no workload"]):::problem');
    expect(r.mermaid).toContain('namespace: default');
  });

  it('only matches workloads in the same namespace', () => {
    const r = k8sToMermaid(`kind: Service
metadata: { name: s, namespace: a }
spec: { selector: { app: x } }
---
kind: Pod
metadata: { name: p, namespace: b, labels: { app: x } }
spec: { containers: [] }
`);
    expect(r.problems).toHaveLength(1);
    expect(r.mermaid).toContain('namespace: a');
    expect(r.mermaid).toContain('namespace: b');
  });

  it('reads kind: List and CronJob / StatefulSet templates', () => {
    const r = k8sToMermaid(`apiVersion: v1
kind: List
items:
  - apiVersion: batch/v1
    kind: CronJob
    metadata: { name: backup }
    spec:
      schedule: "0 2 * * *"
      jobTemplate:
        spec:
          template:
            spec:
              containers: [{ name: b, image: x, envFrom: [{ secretRef: { name: s3 } }] }]
              volumes: [{ name: c, projected: { sources: [{ configMap: { name: proj } }] } }]
  - apiVersion: apps/v1
    kind: StatefulSet
    metadata: { name: db }
    spec:
      template: { metadata: { labels: { app: db } }, spec: { containers: [] } }
      volumeClaimTemplates: [{ metadata: { name: data } }]
`);
    expect(r.resources).toBe(2);
    expect(r.mermaid).toContain('schedule: 0 2 * * *');
    expect(r.notInInput).toEqual(['Secret default/s3', 'ConfigMap default/proj']);
    expect(r.mermaid).toContain('PVC per pod<br/>data-db-N');
  });

  it('escapes hostile names', () => {
    const r = k8sToMermaid(`kind: ConfigMap
metadata: { name: "x\\"]; click r0 call alert() %% <script>{}" }
`);
    expect(r.mermaid).not.toContain('<script>');
    expect(r.mermaid).not.toContain('%%');
    expect(r.mermaid).toContain('#34;#93;#59; click r0 call alert() #37;#37; #60;script#62;#123;#125;');
  });

  it('caps very large inputs', () => {
    const docs = Array.from({ length: 350 }, (_, i) => `kind: ConfigMap\nmetadata: { name: c${i} }`).join('\n---\n');
    const r = k8sToMermaid(docs, 300);
    expect(r.truncated).toBe(true);
    expect((r.mermaid.match(/"ConfigMap<br\/>/g) ?? []).length).toBe(300);
  });
});
