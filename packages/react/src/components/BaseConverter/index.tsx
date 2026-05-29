import { useState } from 'react'
import { convertBase } from '@smartdevutils/core/developer'
import { CopyButton, ErrorDisplay, ToolPanel } from '../shared'

export function BaseConverter({ defaultValue = '255', defaultBase = 10, onResult }: { defaultValue?: string; defaultBase?: number; onResult?: (c: Record<string, string>) => void }) {
  const [value, setValue] = useState(defaultValue), [fromBase, setFromBase] = useState(defaultBase), [error, setError] = useState('')
  const conversions = (() => {
    try {
      const result = { binary: convertBase(value, fromBase, 2), octal: convertBase(value, fromBase, 8), decimal: convertBase(value, fromBase, 10), hex: convertBase(value, fromBase, 16) }
      onResult?.(result); return result
    } catch { setError('Invalid value for base ' + fromBase); return null }
  })()
  return (
    <ToolPanel title="Number Base Converter">
      <div className="space-y-4">
        <div className="flex gap-3">
          <input value={value} onChange={e=>{setValue(e.target.value);setError('')}} placeholder="255" className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 font-mono text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" />
          <select value={fromBase} onChange={e=>setFromBase(Number(e.target.value))} className="rounded-md border border-gray-300 px-2 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white">
            <option value={2}>Binary (2)</option><option value={8}>Octal (8)</option>
            <option value={10}>Decimal (10)</option><option value={16}>Hex (16)</option>
          </select>
        </div>
        {error && <ErrorDisplay message={error} />}
        {conversions && Object.entries(conversions).map(([label, val]) => (
          <div key={label} className="flex items-center gap-3 rounded-md bg-gray-50 px-3 py-2 dark:bg-gray-800">
            <span className="w-20 text-xs font-medium capitalize text-gray-500">{label}</span>
            <code className="flex-1 font-mono text-sm dark:text-green-400">{val}</code>
            <CopyButton text={val} />
          </div>
        ))}
      </div>
    </ToolPanel>
  )
}
