import type { ToolSpec } from '../types'

export const spec: ToolSpec = {
  id: 'docker-tag-checker',
  slug: 'docker-tag-checker',
  name: 'Docker Image Tag Checker',
  category: 'devops-tools',
  toolType: 'analyzer',
  modes: [],
  input: { kind: 'text', label: 'Dockerfile or docker-compose.yml' },
  options: [],
  output: 'report',
}
