import { useState } from 'react'
import { wordCount } from '@smartdevutils/core/text'
import { ToolPanel } from '../shared'

export function TextCounter() {
  const [input, setInput] = useState('')
  const chars = input.length
  const charsNoSpace = input.replace(/\s/g, '').length
  const words = input.trim() ? wordCount(input) : '0 words'
  const lines = input ? input.split('\n').length : 0

  return (
    <ToolPanel title="Text Counter">
      <div className="space-y-4">
        <textarea value={input} onChange={e => setInput(e.target.value)} placeholder="Enter text to analyze..." rows={8}
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: 'Characters', value: chars },
            { label: 'No Spaces', value: charsNoSpace },
            { label: 'Words', value: words },
            { label: 'Lines', value: lines },
          ].map(s => (
            <div key={s.label} className="rounded-lg bg-emerald-50 p-3 text-center dark:bg-emerald-900/20">
              <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">{s.value}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </ToolPanel>
  )
}
