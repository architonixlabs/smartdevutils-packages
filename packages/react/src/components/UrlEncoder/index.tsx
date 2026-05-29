import { useState } from 'react'
import { urlEncode, urlDecode } from '@smartdevutils/core/encoding'
import { CopyButton, ErrorDisplay, ToolPanel } from '../shared'

interface UrlEncoderProps {
  onResult?: (result: string, mode: 'encode' | 'decode') => void
}

export function UrlEncoder({ onResult }: UrlEncoderProps) {
  const [input, setInput] = useState('')
  const [output, setOutput] = useState('')
  const [mode, setMode] = useState<'encode' | 'decode'>('encode')
  const [error, setError] = useState('')

  const process = (value: string, m: 'encode' | 'decode') => {
    setInput(value)
    setError('')
    try {
      const result = m === 'encode' ? urlEncode(value) : urlDecode(value)
      setOutput(result)
      onResult?.(result, m)
    } catch {
      setError('Failed to process URL')
      setOutput('')
    }
  }

  return (
    <ToolPanel title="URL Encoder / Decoder">
      <div className="space-y-4">
        <div className="flex gap-2">
          {(['encode', 'decode'] as const).map(m => (
            <button key={m} onClick={() => { setMode(m); process(input, m) }}
              className={`rounded-md px-3 py-1.5 text-sm font-medium capitalize ${mode === m ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'}`}>
              {m}
            </button>
          ))}
        </div>
        <textarea value={input} onChange={e => process(e.target.value, mode)}
          placeholder={mode === 'encode' ? 'Enter URL to encode...' : 'Enter encoded URL to decode...'} rows={4}
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 font-mono text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" />
        {error && <ErrorDisplay message={error} />}
        {output && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Output</span>
              <CopyButton text={output} />
            </div>
            <code className="block w-full break-all rounded-md bg-gray-50 p-3 font-mono text-sm dark:bg-gray-800 dark:text-green-400">{output}</code>
          </div>
        )}
      </div>
    </ToolPanel>
  )
}
