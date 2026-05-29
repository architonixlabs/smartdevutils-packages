import { useState } from 'react'
import { generateLoremIpsum } from '@smartdevutils/core/generation'
import { CopyButton, ToolPanel } from '../shared'

export function LoremIpsumGenerator({ words: defaultWords = 50, onResult }: { words?: number; onResult?: (text: string) => void }) {
  const [words, setWords] = useState(defaultWords)
  const [text, setText] = useState('')
  const generate = () => { const t = generateLoremIpsum(words); setText(t); onResult?.(t) }
  return (
    <ToolPanel title="Lorem Ipsum Generator">
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Words</label>
          <input type="number" min={10} max={500} value={words} onChange={e=>setWords(Number(e.target.value))} className="w-24 rounded-md border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" />
          <button onClick={generate} className="rounded-md bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-emerald-700">Generate</button>
        </div>
        {text && <div className="space-y-2"><div className="flex justify-end"><CopyButton text={text} /></div><p className="rounded-md bg-gray-50 p-3 text-sm text-gray-700 dark:bg-gray-800 dark:text-gray-300">{text}</p></div>}
      </div>
    </ToolPanel>
  )
}
