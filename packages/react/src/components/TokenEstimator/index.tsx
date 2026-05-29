import { useState } from 'react'
import { estimateTokensForModel } from '@smartdevutils/core/aiml-tools'
import { ToolPanel } from '../shared'

const MODELS = ['gpt-4o', 'gpt-4-turbo', 'gpt-3.5-turbo', 'claude-3-5-sonnet', 'claude-3-opus', 'gemini-1.5-pro']

export function TokenEstimator({ model: defaultModel = 'gpt-4o', onResult }: { model?: string; onResult?: (tokens: number, cost: number) => void }) {
  const [text, setText] = useState(''), [model, setModel] = useState(defaultModel)
  const estimate = text.trim() ? (() => { try { return estimateTokensForModel(text, model) } catch { return null } })() : null
  if (estimate) onResult?.(estimate.tokens, estimate.costUsd ?? 0)
  return (
    <ToolPanel title="Token Estimator" description="Estimate token count and cost by model">
      <div className="space-y-4">
        <select value={model} onChange={e=>setModel(e.target.value)} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white">
          {MODELS.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <textarea value={text} onChange={e=>setText(e.target.value)} placeholder="Enter text to estimate..." rows={8} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white" />
        {estimate && (
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-emerald-50 p-4 text-center dark:bg-emerald-900/20">
              <div className="text-3xl font-bold text-emerald-700 dark:text-emerald-400">{estimate.tokens.toLocaleString()}</div>
              <div className="text-xs text-gray-500">Tokens</div>
            </div>
            {estimate.costUsd != null && (
              <div className="rounded-lg bg-blue-50 p-4 text-center dark:bg-blue-900/20">
                <div className="text-3xl font-bold text-blue-700 dark:text-blue-400">${estimate.costUsd.toFixed(4)}</div>
                <div className="text-xs text-gray-500">Est. Cost</div>
              </div>
            )}
          </div>
        )}
      </div>
    </ToolPanel>
  )
}
