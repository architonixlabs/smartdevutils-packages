import { useState } from 'react'
import { chmodToString } from '@smartdevutils/core/developer'
import { CopyButton, ErrorDisplay, ToolPanel } from '../shared'

export function ChmodCalculator({ defaultOctal = '755', onResult }: { defaultOctal?: string; onResult?: (symbolic: string) => void }) {
  const [octal, setOctal] = useState(defaultOctal), [error, setError] = useState('')
  const symbolic = (() => { try { return chmodToString(octal) } catch { return null } })()
  if (symbolic) onResult?.(symbolic)
  return (
    <ToolPanel title="chmod Calculator">
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Octal</label>
          <input value={octal} onChange={e=>{setOctal(e.target.value);setError('')}} maxLength={4} placeholder="755" className="w-24 rounded-md border border-gray-300 px-3 py-2 font-mono text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" />
        </div>
        {error && <ErrorDisplay message={error} />}
        {symbolic && <div className="flex items-center gap-3 rounded-md bg-gray-50 p-3 dark:bg-gray-800"><code className="flex-1 font-mono text-lg tracking-widest dark:text-green-400">{symbolic}</code><CopyButton text={symbolic} /></div>}
      </div>
    </ToolPanel>
  )
}
