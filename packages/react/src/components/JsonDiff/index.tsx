import { useState } from 'react'
import { ErrorDisplay, ToolPanel } from '../shared'

export function JsonDiff() {
  const [left, setLeft] = useState('')
  const [right, setRight] = useState('')
  const [diff, setDiff] = useState<string[]>([])
  const [error, setError] = useState('')

  const compare = () => {
    setError('')
    try {
      const l = JSON.parse(left)
      const r = JSON.parse(right)
      const lStr = JSON.stringify(l, null, 2).split('\n')
      const rStr = JSON.stringify(r, null, 2).split('\n')
      const result: string[] = []
      const maxLen = Math.max(lStr.length, rStr.length)
      for (let i = 0; i < maxLen; i++) {
        if (lStr[i] !== rStr[i]) {
          if (lStr[i] !== undefined) result.push('- ' + lStr[i])
          if (rStr[i] !== undefined) result.push('+ ' + rStr[i])
        } else {
          result.push('  ' + (lStr[i] ?? ''))
        }
      }
      setDiff(result)
    } catch { setError('Invalid JSON in one or both inputs'); setDiff([]) }
  }

  return (
    <ToolPanel title="JSON Diff">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <textarea value={left} onChange={e => setLeft(e.target.value)} placeholder='{"a": 1}' rows={8}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 font-mono text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" />
          <textarea value={right} onChange={e => setRight(e.target.value)} placeholder='{"a": 2}' rows={8}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 font-mono text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" />
        </div>
        <button onClick={compare} className="rounded-md bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-emerald-700">Compare</button>
        {error && <ErrorDisplay message={error} />}
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
