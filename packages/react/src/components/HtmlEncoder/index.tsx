import { useState } from 'react'
import { htmlDecode, htmlEncode } from '@smartdevutils/core/encoding'
import { CopyButton, ErrorDisplay, ToolPanel } from '../shared'

export function HtmlEncoder({ onResult }: { onResult?: (r: string, m: 'encode'|'decode') => void }) {
  const [input, setInput] = useState(''), [output, setOutput] = useState(''), [mode, setMode] = useState<'encode'|'decode'>('encode'), [error, setError] = useState('')
  const process = (v: string, m: 'encode'|'decode') => {
    setInput(v); setError('')
    try { const r = m === 'encode' ? htmlEncode(v) : htmlDecode(v); setOutput(r); onResult?.(r, m) }
    catch { setError('Failed to process HTML'); setOutput('') }
  }
  return (
    <ToolPanel title="HTML Entity Encoder / Decoder">
      <div className="space-y-4">
        <div className="flex gap-2">{(['encode','decode'] as const).map(m=>(
          <button key={m} onClick={()=>{setMode(m);process(input,m)}} className={`rounded-md px-3 py-1.5 text-sm font-medium capitalize ${mode===m?'bg-emerald-600 text-white':'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'}`}>{m}</button>
        ))}</div>
        <textarea value={input} onChange={e=>process(e.target.value,mode)} placeholder="Enter HTML..." rows={4} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 font-mono text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" />
        {error && <ErrorDisplay message={error} />}
        {output && <div className="flex items-center justify-between rounded-md bg-gray-50 p-3 dark:bg-gray-800"><code className="flex-1 break-all font-mono text-sm dark:text-green-400">{output}</code><CopyButton text={output} /></div>}
      </div>
    </ToolPanel>
  )
}
