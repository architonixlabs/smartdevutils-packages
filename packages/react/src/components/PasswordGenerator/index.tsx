import { useState } from 'react'
import { generatePassword } from '@smartdevutils/core/generation'
import { CopyButton, ToolPanel } from '../shared'

export function PasswordGenerator({ length: defaultLength = 16, onResult }: { length?: number; onResult?: (pw: string) => void }) {
  const [length, setLength] = useState(defaultLength)
  const [password, setPassword] = useState('')
  const generate = () => { const pw = generatePassword(length); setPassword(pw); onResult?.(pw) }
  return (
    <ToolPanel title="Password Generator">
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Length: {length}</label>
          <input type="range" min={8} max={128} value={length} onChange={e=>setLength(Number(e.target.value))} className="flex-1" />
          <button onClick={generate} className="rounded-md bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-emerald-700">Generate</button>
        </div>
        {password && <div className="flex items-center justify-between rounded-md bg-gray-50 p-3 dark:bg-gray-800"><code className="flex-1 break-all font-mono text-sm dark:text-green-400">{password}</code><CopyButton text={password} /></div>}
      </div>
    </ToolPanel>
  )
}
