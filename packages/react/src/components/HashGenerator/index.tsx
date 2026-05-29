import { useState, useEffect } from 'react'
import { CopyButton, ErrorDisplay, ToolPanel } from '../shared'
import { type HashAlgorithm, useHashGenerator } from '../../hooks/useHashGenerator'

const ALGORITHMS: { value: HashAlgorithm; label: string }[] = [
  { value: 'md5',    label: 'MD5' },
  { value: 'sha1',   label: 'SHA-1' },
  { value: 'sha256', label: 'SHA-256' },
  { value: 'sha384', label: 'SHA-384' },
  { value: 'sha512', label: 'SHA-512' },
]

interface HashGeneratorProps {
  defaultAlgorithm?: HashAlgorithm
  defaultInput?: string
  onResult?: (hash: string, algorithm: HashAlgorithm) => void
}

export function HashGenerator({
  defaultAlgorithm = 'sha256',
  defaultInput = '',
  onResult,
}: HashGeneratorProps) {
  const { hash, algorithm, setAlgorithm, compute } = useHashGenerator()
  const [input, setInput] = useState(defaultInput)
  const [error, setError] = useState('')

  // One-time initialization — defaultAlgorithm/defaultInput are treated as initial values
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    setAlgorithm(defaultAlgorithm)
    if (defaultInput) compute(defaultInput, defaultAlgorithm)
  }, [])

  const handleInput = (value: string) => {
    setInput(value)
    setError('')
    try {
      const computed = compute(value, algorithm)
      if (onResult && value) onResult(computed, algorithm)
    } catch {
      setError('Failed to compute hash')
    }
  }

  const handleAlgorithm = (algo: HashAlgorithm) => {
    setAlgorithm(algo)
    if (input) {
      const computed = compute(input, algo)
      if (onResult) onResult(computed, algo)
    }
  }

  return (
    <ToolPanel title="Hash Generator" description="Compute cryptographic hashes of any text">
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {ALGORITHMS.map(a => (
            <button
              key={a.value}
              onClick={() => handleAlgorithm(a.value)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                algorithm === a.value
                  ? 'bg-emerald-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300'
              }`}
            >
              {a.label}
            </button>
          ))}
        </div>

        <textarea
          value={input}
          onChange={e => handleInput(e.target.value)}
          placeholder="Enter text to hash..."
          rows={4}
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 font-mono text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
        />

        {error && <ErrorDisplay message={error} />}

        {hash && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {algorithm.toUpperCase()} Hash
              </span>
              <CopyButton text={hash} />
            </div>
            <code className="block w-full break-all rounded-md bg-gray-50 p-3 font-mono text-sm text-gray-900 dark:bg-gray-800 dark:text-green-400">
              {hash}
            </code>
          </div>
        )}
      </div>
    </ToolPanel>
  )
}
