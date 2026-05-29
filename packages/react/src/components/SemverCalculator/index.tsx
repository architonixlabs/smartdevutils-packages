import { useState } from 'react'
import { compareSemver, parseSemver } from '@smartdevutils/core/developer'
import { ErrorDisplay, ToolPanel } from '../shared'

export function SemverCalculator({ onResult }: { onResult?: (r: ReturnType<typeof parseSemver>) => void }) {
  const [input, setInput] = useState(''), [compare, setCompare] = useState(''), [error, setError] = useState('')
  const parsed = (() => { try { if (!input) return null; return parseSemver(input) } catch { return null } })()
  if (parsed) onResult?.(parsed)
  const comparison = (() => { try { if (input && compare) return compareSemver(input, compare); return null } catch { return null } })()
  return (
    <ToolPanel title="SemVer Calculator">
      <div className="space-y-4">
        <input value={input} onChange={e=>{setInput(e.target.value);setError('')}} placeholder="e.g. 1.2.3 or 2.0.0-alpha.1" className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 font-mono text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" />
        {error && <ErrorDisplay message={error} />}
        {parsed && (
          <div className="grid grid-cols-3 gap-3">
            {[{label:'Major',value:parsed.major},{label:'Minor',value:parsed.minor},{label:'Patch',value:parsed.patch}].map(p => (
              <div key={p.label} className="rounded-lg bg-emerald-50 p-3 text-center dark:bg-emerald-900/20">
                <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">{p.value}</div>
                <div className="text-xs text-gray-500">{p.label}</div>
              </div>
            ))}
          </div>
        )}
        {parsed?.prerelease && <p className="text-sm text-gray-500">Pre-release: <code className="font-mono">{parsed.prerelease}</code></p>}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Compare with</label>
          <input value={compare} onChange={e=>setCompare(e.target.value)} placeholder="e.g. 2.0.0" className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 font-mono text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" />
          {comparison !== null && <p className="text-sm">{input} is <strong>{comparison === -1 ? 'less than' : comparison === 1 ? 'greater than' : 'equal to'}</strong> {compare}</p>}
        </div>
      </div>
    </ToolPanel>
  )
}
