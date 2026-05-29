import { useState } from 'react'
import { sqlFormat, sqlMinify } from '@smartdevutils/core/formats'
import { CopyButton, ErrorDisplay, ToolPanel } from '../shared'

export function SqlFormatter({ onResult }: { onResult?: (r: string) => void }) {
  const [input, setInput] = useState('')
  const [output, setOutput] = useState('')
  const [error, setError] = useState('')

  const process = (value: string, action: 'format' | 'minify') => {
    setInput(value); setError('')
    try {
      const r = action === 'format' ? sqlFormat(value) : sqlMinify(value)
      setOutput(r); onResult?.(r)
    } catch { setError('Failed to process SQL'); setOutput('') }
  }

  return (
    <ToolPanel title="SQL Formatter">
      <div className="space-y-4">
        <div className="flex gap-2">
          <button onClick={() => process(input, 'format')} className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white">Format</button>
          <button onClick={() => process(input, 'minify')} className="rounded-md bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 dark:bg-gray-700 dark:text-gray-300">Minify</button>
        </div>
        <textarea value={input} onChange={e => setInput(e.target.value)} placeholder="SELECT * FROM users WHERE id = 1" rows={8}
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 font-mono text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" />
        {error && <ErrorDisplay message={error} />}
        {output && (<div className="space-y-2"><div className="flex items-center justify-between"><span className="text-sm font-medium text-gray-700 dark:text-gray-300">Output</span><CopyButton text={output} /></div><pre className="max-h-80 overflow-auto rounded-md bg-gray-50 p-3 font-mono text-sm dark:bg-gray-800 dark:text-green-400">{output}</pre></div>)}
      </div>
    </ToolPanel>
  )
}
