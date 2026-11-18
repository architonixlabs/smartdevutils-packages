import { describe, expect, it } from 'vitest'
import { checkK8sManifest, runner } from './k8s-yaml-validator'

const run = (input: string) =>
  runner.run(input) as { output: string; error?: string; meta?: Record<string, unknown> }

const DEPLOYMENT = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-app
  namespace: default
  labels:
    app: my-app
spec:
  replicas: 3
  selector:
    matchLabels:
      app: my-app
  template:
    metadata:
      labels:
        app: my-app
    spec:
      containers:
        - name: my-app
          image: my-app:1.0.0
          ports:
            - containerPort: 8080
          resources:
            requests:
              cpu: 100m
              memory: 128Mi
            limits:
              cpu: 500m
              memory: 256Mi`

const CONFIGMAP = `apiVersion: v1
kind: ConfigMap
metadata:
  name: my-app-config
  namespace: default
data:
  APP_ENV: production
  LOG_LEVEL: info`

describe('k8s-yaml-validator runner', () => {
  it('reports the same errors and warnings as the website check', () => {
    const expected = checkK8sManifest(DEPLOYMENT)
    const r = run(DEPLOYMENT)
    expect(r.meta!.errors).toEqual(expected.errors)
    expect(r.meta!.warnings).toEqual(expected.warnings)
    expect(r.meta!.valid).toBe(expected.errors.length === 0)
    expect(typeof r.meta!.mermaid).toBe('string')
  })

  it('does not apply workload-only warnings to a ConfigMap', () => {
    const r = checkK8sManifest(CONFIGMAP)
    expect(r.errors).toEqual([])
    expect(r.warnings.some((w) => /resource limits|readinessProbe|securityContext/.test(w))).toBe(false)
  })

  it('prints the website success message when there is nothing to report', () => {
    expect(checkK8sManifest(CONFIGMAP)).toEqual({ errors: [], warnings: [] })
    expect(run(CONFIGMAP).output).toBe('Manifest looks valid — no errors or warnings found.')
  })

  it('reports a YAML syntax error', () => {
    const r = run('apiVersion: v1\nkind: [unclosed')
    expect(r.output).toMatch(/^Errors \(1\)\n- YAML syntax error: /)
    expect(r.meta!.valid).toBe(false)
  })

  it('prefixes findings per document and rejects negative replicas', () => {
    const text = `${CONFIGMAP}\n---\napiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: x\nspec:\n  replicas: -1\n`
    const r = checkK8sManifest(text)
    expect(r.errors).toContain('Document 2: spec.replicas must be >= 0')
  })

  it('reports a non-mapping document', () => {
    expect(checkK8sManifest('- a\n- b').errors).toEqual(['expected a mapping with apiVersion/kind, got a list'])
  })

  it('gives empty output for blank input', () => {
    expect(run('  ')).toEqual({ output: '' })
  })
})
