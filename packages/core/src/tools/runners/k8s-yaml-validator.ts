// Mirrors the website's K8sYamlValidatorComponent.check(). The website shows error and warning lists
// (no output panel), so `output` is a plain-text version of them; `meta` adds the resource-map diagram.
import { loadAllYaml } from '../../yaml'
import { validateK8sManifest } from '../../devops-tools'
import { k8sToMermaid } from '../../diagrams/k8s-resource-map'
import { defineRunner } from '../define'
import { spec } from '../specs/k8s-yaml-validator'

const WORKLOADS = new Set([
  'pod',
  'deployment',
  'statefulset',
  'daemonset',
  'replicaset',
  'job',
  'cronjob',
  'replicationcontroller',
])
const WORKLOAD_ONLY = /resource limits|readinessProbe|securityContext|:latest/

/**
 * Parses first (multi-document aware), then applies the core rules per document, keeping workload
 * warnings only for kinds that run pods. Same rules and messages as the website.
 */
export function checkK8sManifest(text: string): { errors: string[]; warnings: string[] } {
  if (!text.trim()) return { errors: ['Manifest is empty.'], warnings: [] }
  let docs: unknown[]
  try {
    // The yaml wrapper keeps js-yaml 4's default schema, as the website's YAML_DEFAULT_SCHEMA does.
    docs = loadAllYaml(text).filter((d) => d !== null && d !== undefined)
  } catch (e) {
    return {
      errors: [`YAML syntax error: ${e instanceof Error ? e.message.split('\n')[0] : String(e)}`],
      warnings: [],
    }
  }
  if (docs.length === 0) return { errors: ['Manifest is empty.'], warnings: [] }
  const errors: string[] = []
  const warnings: string[] = []
  const docTexts = text.split(/^---.*$/m).filter((t) => t.replace(/^[ \t]*#.*$/gm, '').trim() !== '')
  docs.forEach((doc, i) => {
    const prefix = docs.length > 1 ? `Document ${i + 1}: ` : ''
    if (typeof doc !== 'object' || Array.isArray(doc)) {
      errors.push(`${prefix}expected a mapping with apiVersion/kind, got ${Array.isArray(doc) ? 'a list' : typeof doc}`)
      return
    }
    const obj = doc as Record<string, unknown>
    const kind = typeof obj['kind'] === 'string' ? obj['kind'].toLowerCase() : ''
    const meta = obj['metadata'] as Record<string, unknown> | undefined
    const core = validateK8sManifest(docTexts[i] ?? text)
    errors.push(...core.errors.filter((e) => !/replicas must be/.test(e)).map((e) => prefix + e))
    for (const w of core.warnings) {
      if (/metadata\.name/.test(w)) {
        if (!meta || !meta['name']) warnings.push(prefix + w)
        continue
      }
      if (WORKLOAD_ONLY.test(w) && !WORKLOADS.has(kind)) continue
      warnings.push(prefix + w)
    }
    const s = obj['spec'] as Record<string, unknown> | undefined
    if (s && typeof s['replicas'] === 'number' && s['replicas'] < 0) errors.push(`${prefix}spec.replicas must be >= 0`)
  })
  return { errors, warnings }
}

export function k8sReport(r: { errors: string[]; warnings: string[] }): string {
  if (!r.errors.length && !r.warnings.length) return 'Manifest looks valid — no errors or warnings found.'
  const parts: string[] = []
  if (r.errors.length) parts.push([`Errors (${r.errors.length})`, ...r.errors.map((e) => `- ${e}`)].join('\n'))
  if (r.warnings.length) parts.push([`Warnings (${r.warnings.length})`, ...r.warnings.map((w) => `- ${w}`)].join('\n'))
  return parts.join('\n\n')
}

export const runner = defineRunner(spec, (input) => {
  if (!input.trim()) return { output: '' }
  const result = checkK8sManifest(input)
  const map = k8sToMermaid(input)
  return {
    output: k8sReport(result),
    meta: {
      valid: result.errors.length === 0,
      errors: result.errors,
      warnings: result.warnings,
      ...(map.mermaid ? { mermaid: map.mermaid, resourceProblems: map.problems } : {}),
    },
  }
})

export default runner
