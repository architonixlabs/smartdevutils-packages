import type { ToolSpec } from '../types'

export const spec: ToolSpec = {
  id: 'k8s-yaml-validator',
  slug: 'k8s-yaml-validator',
  name: 'Kubernetes YAML Validator',
  category: 'devops-tools',
  toolType: 'analyzer',
  modes: [],
  input: { kind: 'yaml', label: 'Kubernetes manifest (one or more documents)' },
  options: [],
  output: 'report',
}
