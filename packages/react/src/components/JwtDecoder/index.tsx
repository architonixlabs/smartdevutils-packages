import { useState } from 'react'
import { jwtDecode } from '@smartdevutils/core/jwt'
import { CopyButton, ErrorDisplay, ToolPanel } from '../shared'

export function JwtDecoder({ onResult }: { onResult?: (r: string) => void }) {
  const [input, setInput] = useState('')
  const [output, setOutput] = useState('')
  const [error, setError] = useState('')

  const decode = () => {
    setError('')
    try {
      const r = jwtDecode(input)
      setOutput(r); onResult?.(r)
    } catch { setError('Invalid JWT token'); setOutput('') }
  }

  return (
    <ToolPanel title="JWT Decoder">
      <div className="space-y-4">
        <textarea value={input} onChange={e => setInput(e.target.value)} placeholder="Paste JWT token..." rows={4}
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 font-mono text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" />
        <button onClick={decode} className="rounded-md bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-emerald-700">Decode</button>
        {error && <ErrorDisplay message={error} />}
        {output && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Decoded</span>
              <CopyButton text={output} />
            </div>
            <pre className="max-h-80 overflow-auto rounded-md bg-gray-50 p-3 font-mono text-sm dark:bg-gray-800 dark:text-green-400">{output}</pre>
          </div>
        )}
      </div>
    </ToolPanel>
  )
}
