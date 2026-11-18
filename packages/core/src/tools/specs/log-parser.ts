import type { ToolSpec } from '../types'

export const spec: ToolSpec = {
  id: 'log-parser',
  slug: 'log-parser',
  name: 'Log Format Parser',
  category: 'devops-tools',
  toolType: 'analyzer',
  modes: [],
  input: { kind: 'log', label: 'Log Lines (JSON or syslog format)' },
  options: [
    {
      key: 'levelFilter',
      label: 'Level',
      type: 'select',
      default: 'ALL',
      choices: [
        { value: 'ALL', label: 'ALL' },
        { value: 'INFO', label: 'INFO' },
        { value: 'WARN', label: 'WARN' },
        { value: 'ERROR', label: 'ERROR' },
        { value: 'DEBUG', label: 'DEBUG' },
      ],
    },
  ],
  output: 'report',
}
