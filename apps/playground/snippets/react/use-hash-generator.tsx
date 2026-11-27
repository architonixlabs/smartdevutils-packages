/* ---
title: Your own UI with the useHashGenerator and useBase64 hooks
entry: hooks/useHashGenerator, hooks/useBase64
description: compute() and encode() update the hook's state, so call them from an event or an effect, never during render.
--- */
import { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { useHashGenerator, useBase64, type HashAlgorithm } from '@smartdevutils/react/hooks'

function App() {
  const [text, setText] = useState('hello world')
  const { hash, algorithm, setAlgorithm, compute } = useHashGenerator()
  const b64 = useBase64()

  // Recompute when the text or the algorithm changes.
  useEffect(() => {
    compute(text, algorithm)
    b64.encode(text)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, algorithm])

  return (
    <div style={{ fontFamily: 'system-ui', display: 'grid', gap: 8, maxWidth: 640 }}>
      <label>
        Text <input value={text} onChange={(e) => setText(e.target.value)} style={{ width: '100%' }} />
      </label>
      <label>
        Algorithm{' '}
        <select value={algorithm} onChange={(e) => setAlgorithm(e.target.value as HashAlgorithm)}>
          {(['md5', 'sha1', 'sha256', 'sha384', 'sha512'] as const).map((a) => (
            <option key={a}>{a}</option>
          ))}
        </select>
      </label>
      <code style={{ overflowWrap: 'anywhere' }}>
        {algorithm}: {hash}
      </code>
      <code>base64: {b64.encoded}</code>
    </div>
  )
}

createRoot(document.getElementById('root')!).render(<App />)
