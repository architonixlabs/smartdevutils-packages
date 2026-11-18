import type { ToolSpec } from '../types'

export const spec: ToolSpec = {
  id: 'performance-sla-checker',
  slug: 'performance-sla-checker',
  name: 'Performance SLA Checker',
  category: 'developer-tools',
  toolType: 'analyzer',
  modes: [],
  input: { kind: 'text', label: 'Response Times (ms, one per line or comma-separated)' },
  options: [
    { key: 'p50Target', label: 'P50 Target (ms)', type: 'number', default: 200, min: 0 },
    { key: 'p95Target', label: 'P95 Target (ms)', type: 'number', default: 500, min: 0 },
    { key: 'p99Target', label: 'P99 Target (ms)', type: 'number', default: 1000, min: 0 },
  ],
  output: 'report',
}
