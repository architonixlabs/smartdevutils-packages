import { useState } from 'react'
import { CopyButton, ErrorDisplay, ToolPanel } from '../shared'

export function TimestampConverter({ onResult }: { onResult?: (r: string) => void }) {
  const [input, setInput] = useState('')
  const [output, setOutput] = useState('')
  const [error, setError] = useState('')

  const toHuman = () => {
    setError('')
    try {
      const ts = parseInt(input, 10)
      if (isNaN(ts)) throw new Error('Not a number')
      const d = new Date(ts < 1e12 ? ts * 1000 : ts)
      const r = d.toISOString() + ' / ' + d.toLocaleString()
      setOutput(r); onResult?.(r)
    } catch { setError('Invalid timestamp'); setOutput('') }
  }

  const toUnix = () => {
    setError('')
    try {
      const d = new Date(input)
      if (isNaN(d.getTime())) throw new Error('Invalid date')
      const r = String(Math.floor(d.getTime() / 1000))
      setOutput(r); onResult?.(r)
    } catch { setError('Invalid date string'); setOutput('') }
  }

  return (
    <ToolPanel title="Timestamp Converter">
      <div className="space-y-4">
        <input value={input} onChange={e => setInput(e.target.value)}
          placeholder="Enter Unix timestamp or date string (e.g. 2024-01-01)"
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" />
        <div className="flex gap-2">
          <button onClick={toHuman} className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white">→ Human Date</button>
          <button onClick={toUnix} className="rounded-md bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 dark:bg-gray-700 dark:text-gray-300">→ Unix Timestamp</button>
        </div>
        {error && <ErrorDisplay message={error} />}
        {output && (<div className="flex items-center gap-3 rounded-md bg-gray-50 p-3 dark:bg-gray-800"><code className="flex-1 font-mono text-sm dark:text-green-400">{output}</code><CopyButton text={output} /></div>)}
      </div>
    </ToolPanel>
  )
}
