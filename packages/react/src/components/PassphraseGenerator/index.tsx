import { useState } from 'react'
import { generatePassphrase } from '@smartdevutils/core/generation'
import { CopyButton, ToolPanel } from '../shared'

export function PassphraseGenerator({ wordCount: defaultCount = 4, onResult }: { wordCount?: number; onResult?: (pp: string) => void }) {
  const [wordCount, setWordCount] = useState(defaultCount)
  const [phrase, setPhrase] = useState('')
  const generate = () => { const pp = generatePassphrase(wordCount); setPhrase(pp); onResult?.(pp) }
  return (
    <ToolPanel title="Passphrase Generator" description="EFF diceware wordlist">
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Words</label>
          <input type="number" min={3} max={10} value={wordCount} onChange={e=>setWordCount(Number(e.target.value))} className="w-20 rounded-md border border-gray-300 px-2 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" />
          <button onClick={generate} className="rounded-md bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-emerald-700">Generate</button>
        </div>
        {phrase && <div className="flex items-center justify-between rounded-md bg-gray-50 p-3 dark:bg-gray-800"><code className="flex-1 font-mono text-sm dark:text-green-400">{phrase}</code><CopyButton text={phrase} /></div>}
      </div>
    </ToolPanel>
  )
}
