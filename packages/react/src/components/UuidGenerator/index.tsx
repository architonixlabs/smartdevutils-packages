import { useState } from 'react'
import { generateUuid } from '@smartdevutils/core/generation'
import { CopyButton, ToolPanel } from '../shared'

export function UuidGenerator({ onResult }: { onResult?: (uuid: string) => void }) {
  const [uuids, setUuids] = useState<string[]>([])
  const [count, setCount] = useState(1)

  const generate = () => {
    const results = Array.from({ length: count }, () => generateUuid())
    setUuids(results)
    results.forEach(u => onResult?.(u))
  }

  return (
    <ToolPanel title="UUID Generator" description="Generate RFC 4122 v4 UUIDs">
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Count</label>
          <input type="number" min={1} max={100} value={count} onChange={e => setCount(Number(e.target.value))}
            className="w-20 rounded-md border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" />
          <button onClick={generate} className="rounded-md bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-emerald-700">Generate</button>
        </div>
        {uuids.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{uuids.length} UUID{uuids.length > 1 ? 's' : ''}</span>
              <CopyButton text={uuids.join('\n')} />
            </div>
            <div className="max-h-80 overflow-auto rounded-md bg-gray-50 p-3 dark:bg-gray-800">
              {uuids.map((u, i) => <code key={i} className="block font-mono text-sm text-gray-900 dark:text-green-400">{u}</code>)}
            </div>
          </div>
        )}
      </div>
    </ToolPanel>
  )
}
