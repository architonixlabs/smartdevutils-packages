import { useState } from 'react'
import { slugifyText } from '@smartdevutils/core/text'
import { CopyButton, ToolPanel } from '../shared'

export function SlugGenerator({ onResult }: { onResult?: (slug: string) => void }) {
  const [input, setInput] = useState('')
  const slug = input ? slugifyText(input) : ''

  return (
    <ToolPanel title="Slug Generator">
      <div className="space-y-4">
        <input value={input} onChange={e => { setInput(e.target.value); if (e.target.value) onResult?.(slugifyText(e.target.value)) }}
          placeholder="Enter text to slugify..."
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" />
        {slug && (
          <div className="flex items-center gap-3 rounded-md bg-gray-50 p-3 dark:bg-gray-800">
            <code className="flex-1 font-mono text-sm text-gray-900 dark:text-green-400">{slug}</code>
            <CopyButton text={slug} />
          </div>
        )}
      </div>
    </ToolPanel>
  )
}
