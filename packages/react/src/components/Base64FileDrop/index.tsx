import { useState } from 'react'
import { fileToBase64 } from '@smartdevutils/browser/file'
import { CopyButton, ErrorDisplay, ToolPanel } from '../shared'

export function Base64FileDrop({ onResult }: { onResult?: (base64: string, filename: string) => void }) {
  const [output, setOutput] = useState(''), [filename, setFilename] = useState(''), [error, setError] = useState('')
  const handle = async (file: File) => {
    setError(''); setFilename(file.name)
    try { const b = await fileToBase64(file); setOutput(b); onResult?.(b, file.name) }
    catch { setError('Failed to read file') }
  }
  return (
    <ToolPanel title="File to Base64">
      <div className="space-y-4">
        <label className="block cursor-pointer rounded-lg border-2 border-dashed border-gray-300 p-8 text-center hover:border-emerald-400 dark:border-gray-600"
          onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();const f=e.dataTransfer.files[0];if(f)handle(f)}}>
          <input type="file" className="hidden" onChange={e=>{const f=e.target.files?.[0];if(f)handle(f)}} />
          <p className="text-sm text-gray-500">{filename || 'Drop a file or click to upload'}</p>
        </label>
        {error && <ErrorDisplay message={error} />}
        {output && <div className="space-y-2"><div className="flex items-center justify-between"><span className="text-sm font-medium text-gray-700 dark:text-gray-300">Base64</span><CopyButton text={output} /></div><code className="block max-h-40 overflow-auto break-all rounded-md bg-gray-50 p-3 font-mono text-xs dark:bg-gray-800 dark:text-green-400">{output}</code></div>}
      </div>
    </ToolPanel>
  )
}
