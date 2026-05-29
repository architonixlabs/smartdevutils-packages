import { useState } from 'react'
import { jsonFormat, jsonMinify } from '@smartdevutils/core/formatting'
import { CopyButton, ErrorDisplay, ToolPanel } from '../shared'

interface JsonFormatterProps {
  onResult?: (result: string) => void
}

export function JsonFormatter({ onResult }: JsonFormatterProps) {
  const [input, setInput] = useState('')
  const [output, setOutput] = useState('')
  const [error, setError] = useState('')

  const process = (value: string, action: 'format' | 'minify') => {
    setInput(value)
    setError('')
    try {
      const result = action === 'format' ? jsonFormat(value) : jsonMinify(value)
      setOutput(result)
      onResult?.(result)
    } catch (e) {
      setError('Invalid JSON: ' + (e instanceof Error ? e.message : 'parse error'))
      setOutput('')
    }
  }

  return (
    <ToolPanel title="JSON Formatter" description="Format or minify JSON">
      <div className="space-y-4">
        <div className="flex gap-2">
          <button onClick={() => process(input, 'format')}
            className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700">Format</button>
          <button onClick={() => process(input, 'minify')}
            className="rounded-md bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300">Minify</button>
        </div>
        <textarea value={input} onChange={e => setInput(e.target.value)}
          placeholder='{"key": "value"}' rows={8}
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 font-mono text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" />
        {error && <ErrorDisplay message={error} />}
        {output && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Output</span>
              <CopyButton text={output} />
            </div>
            <pre className="max-h-80 overflow-auto rounded-md bg-gray-50 p-3 font-mono text-sm dark:bg-gray-800 dark:text-green-400">{output}</pre>
          </div>
        )}
      </div>
    </ToolPanel>
  )
}
