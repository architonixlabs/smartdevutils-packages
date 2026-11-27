/* ---
title: Live Mermaid preview from a text area
entry: components/SduDiagram
--- */
import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { SduDiagram } from '@smartdevutils/react'

function App() {
  const [source, setSource] = useState('flowchart LR\n  Commit --> Test --> Deploy\n  Test -- fails --> Fix --> Commit')
  return (
    <div style={{ display: 'grid', gap: '0.75rem' }}>
      <label>
        Mermaid source
        <textarea value={source} onChange={(e) => setSource(e.target.value)} rows={5} style={{ width: '100%', fontFamily: 'monospace' }} />
      </label>
      <SduDiagram source={source} label="Release flow" onRendered={(d) => console.log(d.ok ? 'rendered' : d.error)} />
    </div>
  )
}

createRoot(document.getElementById('root')!).render(<App />)
