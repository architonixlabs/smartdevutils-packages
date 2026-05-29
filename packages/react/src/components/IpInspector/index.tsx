import { useState } from 'react'
import { isPrivateIp, ipToInt, parseIpAddress } from '@smartdevutils/core/network'
import { ErrorDisplay, ToolPanel } from '../shared'

export function IpInspector({ defaultIp = '', onResult }: { defaultIp?: string; onResult?: (info: object) => void }) {
  const [ip, setIp] = useState(defaultIp), [error, setError] = useState('')
  const info = (() => {
    if (!ip) return null
    try {
      const parsed = parseIpAddress(ip)
      if (!parsed.valid) { return null }
      const result = { version: `IPv${parsed.version}`, octets: parsed.octets.join('.'), integer: ipToInt(ip), isPrivate: isPrivateIp(ip) }
      onResult?.(result); return result
    } catch { return null }
  })()
  return (
    <ToolPanel title="IP Inspector">
      <div className="space-y-4">
        <input value={ip} onChange={e=>{setIp(e.target.value);setError('')}} placeholder="e.g. 192.168.1.1 or 8.8.8.8" className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 font-mono text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" />
        {error && <ErrorDisplay message={error} />}
        {info && (
          <div className="space-y-2">
            {[{label:'Version',value:info.version},{label:'Integer',value:String(info.integer)},{label:'Private',value:info.isPrivate?'Yes (RFC 1918)':'No (Public)'}].map(r => (
              <div key={r.label} className="flex gap-3 rounded-md bg-gray-50 px-3 py-2 dark:bg-gray-800">
                <span className="w-20 text-xs font-medium text-gray-500">{r.label}</span>
                <code className="font-mono text-sm dark:text-green-400">{r.value}</code>
              </div>
            ))}
          </div>
        )}
      </div>
    </ToolPanel>
  )
}
