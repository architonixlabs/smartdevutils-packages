import { useState } from 'react'
import { ToolPanel } from '../shared'

export function TextDiff() {
  const [left, setLeft] = useState('')
  const [right, setRight] = useState('')
  const [diff, setDiff] = useState<string[]>([])

  const compare = () => {
    const l = left.split('\n')
    const r = right.split('\n')
    const result: string[] = []
    const maxLen = Math.max(l.length, r.length)
    for (let i = 0; i < maxLen; i++) {
      if (l[i] !== r[i]) {
        if (l[i] !== undefined) result.push('- ' + l[i])
        if (r[i] !== undefined) result.push('+ ' + r[i])
      } else {
        result.push('  ' + (l[i] ?? ''))
      }
    }
    setDiff(result)
  }

  return (
    <ToolPanel title="Text Diff">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <textarea value={left} onChange={e => setLeft(e.target.value)} placeholder="Original text..." rows={8}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 font-mono text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" />
          <textarea value={right} onChange={e => setRight(e.target.value)} placeholder="Modified text..." rows={8}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 font-mono text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" />
        </div>
        <button onClick={compare} className="rounded-md bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-emerald-700">Compare</button>
        {diff.length > 0 && (
          <pre className="max-h-80 overflow-auto rounded-md bg-gray-50 p-3 font-mono text-sm dark:bg-gray-800">
            {diff.map((line, i) => (
              <div key={i} className={line.startsWith('+') ? 'text-green-700 dark:text-green-400' : line.startsWith('-') ? 'text-red-700 dark:text-red-400' : 'text-gray-700 dark:text-gray-300'}>{line}</div>
            ))}
          </pre>
        )}
      </div>
    </ToolPanel>
  )
}
