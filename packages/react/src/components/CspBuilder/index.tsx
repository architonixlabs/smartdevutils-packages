import { useState } from 'react'
import { buildCspHeader, validateCsp, type CspDirectives } from '@smartdevutils/core/security-extra2'
import { CopyButton, ErrorDisplay, ToolPanel } from '../shared'

export function CspBuilder({ onResult }: { onResult?: (header: string) => void }) {
  const [directives, setDirectives] = useState<CspDirectives>({ defaultSrc: ["'self'"], scriptSrc: ["'self'"] })
  const header = buildCspHeader(directives)
  const validation = validateCsp(header)
  if (header) onResult?.(header)

  const updateDir = (key: keyof CspDirectives, value: string) => {
    setDirectives({ ...directives, [key]: value.split(' ').filter(Boolean) })
  }

  return (
    <ToolPanel title="CSP Header Builder" description="Content Security Policy generator">
      <div className="space-y-4">
        {(['defaultSrc','scriptSrc','styleSrc','imgSrc','connectSrc'] as const).map(k => (
          <div key={k} className="space-y-1">
            <label className="text-xs font-medium text-gray-500">{k.replace(/([A-Z])/g,'-$1').toLowerCase()}</label>
            <input value={(directives[k] as string[]|undefined)?.join(' ') ?? ''} onChange={e=>updateDir(k,e.target.value)} placeholder="'self' cdn.example.com" className="w-full rounded-md border border-gray-300 px-3 py-1.5 font-mono text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" />
          </div>
        ))}
        {header && <div className="space-y-2"><div className="flex items-center justify-between"><span className="text-sm font-medium text-gray-700 dark:text-gray-300">Header</span><CopyButton text={`Content-Security-Policy: ${header}`} /></div><code className="block w-full break-all rounded-md bg-gray-50 p-3 font-mono text-xs dark:bg-gray-800 dark:text-green-400">{header}</code></div>}
        {validation.errors.map((e,i) => <ErrorDisplay key={i} message={e} />)}
        {validation.warnings.map((w,i) => <div key={i} className="rounded-md border border-yellow-200 bg-yellow-50 p-2 text-sm text-yellow-700 dark:border-yellow-800 dark:bg-yellow-950 dark:text-yellow-400">{w}</div>)}
      </div>
    </ToolPanel>
  )
}
