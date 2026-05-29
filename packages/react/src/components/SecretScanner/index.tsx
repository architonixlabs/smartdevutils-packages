import { useState } from 'react'
import { scanForSecrets } from '@smartdevutils/core/security'
import { ErrorDisplay, ToolPanel } from '../shared'

export function SecretScanner({ onResult }: { onResult?: (findings: string[]) => void }) {
  const [input, setInput] = useState(''), [findings, setFindings] = useState<string[]>([]), [scanned, setScanned] = useState(false)
  const scan = () => {
    const results = scanForSecrets(input).map(f => `${f.type}: ${f.match}`)
    setFindings(results); setScanned(true); onResult?.(results)
  }
  return (
    <ToolPanel title="Secret Scanner" description="Detect API keys, tokens, and credentials in text">
      <div className="space-y-4">
        <textarea value={input} onChange={e=>setInput(e.target.value)} placeholder="Paste code, config, or text to scan..." rows={8} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 font-mono text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" />
        <button onClick={scan} className="rounded-md bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white">Scan</button>
        {scanned && findings.length === 0 && <p className="text-sm text-emerald-600 dark:text-emerald-400">No secrets detected.</p>}
        {findings.length > 0 && <div className="space-y-2">{findings.map((f,i) => <div key={i} className="rounded-md border border-red-200 bg-red-50 p-2 font-mono text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400">{f}</div>)}</div>}
      </div>
    </ToolPanel>
  )
}
