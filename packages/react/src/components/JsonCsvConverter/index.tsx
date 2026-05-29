import { useState } from 'react'
import { csvToJson, jsonToCsv } from '@smartdevutils/core/data'
import { CopyButton, ErrorDisplay, ToolPanel } from '../shared'

export function JsonCsvConverter({ onResult }: { onResult?: (r: string, d: 'json-to-csv'|'csv-to-json') => void }) {
  const [input, setInput] = useState(''), [output, setOutput] = useState(''), [error, setError] = useState('')
  const process = (direction: 'json-to-csv'|'csv-to-json') => {
    setError('')
    try {
      const r = direction === 'json-to-csv' ? jsonToCsv(JSON.parse(input)) : JSON.stringify(csvToJson(input), null, 2)
      setOutput(r); onResult?.(r, direction)
    } catch (e) { setError(e instanceof Error ? e.message : 'Conversion failed'); setOutput('') }
  }
  return (
    <ToolPanel title="JSON / CSV Converter">
      <div className="space-y-4">
        <textarea value={input} onChange={e=>setInput(e.target.value)} placeholder='[{"name":"Alice","age":30}] or name,age\nAlice,30' rows={8} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 font-mono text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" />
        <div className="flex gap-2">
          <button onClick={()=>process('json-to-csv')} className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white">JSON to CSV</button>
          <button onClick={()=>process('csv-to-json')} className="rounded-md bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 dark:bg-gray-700 dark:text-gray-300">CSV to JSON</button>
        </div>
        {error && <ErrorDisplay message={error} />}
        {output && <div className="space-y-2"><div className="flex items-center justify-between"><span className="text-sm font-medium text-gray-700 dark:text-gray-300">Output</span><CopyButton text={output} /></div><pre className="max-h-80 overflow-auto rounded-md bg-gray-50 p-3 font-mono text-sm dark:bg-gray-800 dark:text-green-400">{output}</pre></div>}
      </div>
    </ToolPanel>
  )
}
