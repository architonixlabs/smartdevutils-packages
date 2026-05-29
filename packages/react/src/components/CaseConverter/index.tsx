import { useState } from 'react'
import { toCase, type CaseVariant } from '@smartdevutils/core/text'
import { CopyButton, ToolPanel } from '../shared'

const CASES: { value: CaseVariant; label: string }[] = [
  { value: 'camel', label: 'camelCase' },
  { value: 'pascal', label: 'PascalCase' },
  { value: 'snake', label: 'snake_case' },
  { value: 'kebab', label: 'kebab-case' },
  { value: 'upper', label: 'UPPER CASE' },
  { value: 'lower', label: 'lower case' },
  { value: 'title', label: 'Title Case' },
]

export function CaseConverter({ onResult }: { onResult?: (r: string, variant: CaseVariant) => void }) {
  const [input, setInput] = useState('')

  return (
    <ToolPanel title="Case Converter">
      <div className="space-y-4">
        <textarea value={input} onChange={e => setInput(e.target.value)} placeholder="Enter text to convert..." rows={3}
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 font-mono text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" />
        <div className="space-y-2">
          {CASES.map(c => {
            const result = input ? toCase(input, c.value) : ''
            return (
              <div key={c.value} className="flex items-center gap-3 rounded-md bg-gray-50 px-3 py-2 dark:bg-gray-800">
                <span className="w-28 text-xs font-medium text-gray-500">{c.label}</span>
                <code className="flex-1 font-mono text-sm text-gray-900 dark:text-green-400">{result}</code>
                {result && <CopyButton text={result} />}
              </div>
            )
          })}
        </div>
      </div>
    </ToolPanel>
  )
}
