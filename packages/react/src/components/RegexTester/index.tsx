import { useState } from 'react'
import { ErrorDisplay, ToolPanel } from '../shared'

export function RegexTester() {
  const [pattern, setPattern] = useState('')
  const [flags, setFlags] = useState('g')
  const [input, setInput] = useState('')
  const [matches, setMatches] = useState<string[]>([])
  const [error, setError] = useState('')

  const test = () => {
    setError('')
    try {
      const re = new RegExp(pattern, flags)
      const m = input.match(re)
      setMatches(m ?? [])
    } catch (e) { setError('Invalid regex: ' + (e instanceof Error ? e.message : '')); setMatches([]) }
  }

  return (
    <ToolPanel title="Regex Tester">
      <div className="space-y-4">
        <div className="flex gap-2">
          <input value={pattern} onChange={e => setPattern(e.target.value)} placeholder="Pattern (e.g. \d+)"
            className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 font-mono text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" />
          <input value={flags} onChange={e => setFlags(e.target.value)} placeholder="gim" maxLength={4}
            className="w-20 rounded-lg border border-gray-300 bg-white px-3 py-2 font-mono text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" />
          <button onClick={test} className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white">Test</button>
        </div>
        <textarea value={input} onChange={e => setInput(e.target.value)} placeholder="Test string..." rows={5}
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 font-mono text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" />
        {error && <ErrorDisplay message={error} />}
        {matches.length > 0 && (
          <div className="space-y-1">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{matches.length} match{matches.length > 1 ? 'es' : ''}</span>
            {matches.map((m, i) => <code key={i} className="block rounded bg-emerald-50 px-2 py-1 font-mono text-sm text-emerald-900 dark:bg-emerald-900 dark:text-emerald-100">{m}</code>)}
          </div>
        )}
        {!error && matches.length === 0 && pattern && <p className="text-sm text-gray-500">No matches found</p>}
      </div>
    </ToolPanel>
  )
}
