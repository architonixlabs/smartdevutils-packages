import { useState } from 'react'
import { formatBytes } from '@smartdevutils/core/developer'
import { CopyButton, ToolPanel } from '../shared'

export function ByteSizeConverter({ defaultBytes, onResult }: { defaultBytes?: number; onResult?: (f: string) => void }) {
  const [value, setValue] = useState(String(defaultBytes ?? ''))
  const bytes = parseInt(value, 10)
  const formatted = !isNaN(bytes) && bytes >= 0 ? formatBytes(bytes, 2) : null
  if (formatted) onResult?.(formatted)
  return (
    <ToolPanel title="Byte Size Converter">
      <div className="space-y-4">
        <input type="number" value={value} onChange={e=>setValue(e.target.value)} placeholder="Enter bytes (e.g. 1048576)" className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" />
        {formatted && <div className="flex items-center gap-3 rounded-md bg-gray-50 p-3 dark:bg-gray-800"><code className="flex-1 font-mono text-2xl font-bold dark:text-green-400">{formatted}</code><CopyButton text={formatted} /></div>}
      </div>
    </ToolPanel>
  )
}
