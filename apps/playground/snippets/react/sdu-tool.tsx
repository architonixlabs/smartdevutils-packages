/* ---
title: A controlled SduTool
entry: components/SduTool
description: Value and mode live in your state. In your app, also import '@smartdevutils/theme/styles.css' once (the playground loads the theme for you).
order: 1
--- */
import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { SduTool } from '@smartdevutils/react'

function App() {
  const [text, setText] = useState('eyJ1c2VyIjoiYWRhIiwicm9sZSI6ImFkbWluIn0=')
  const [mode, setMode] = useState('decode')
  return (
    <>
      <SduTool
        tool="base64-encoder-decoder"
        mode={mode}
        onModeChange={setMode}
        value={text}
        onChange={setText}
        onResult={(r) => console.log(r.mode, '->', r.output)}
      />
      <p>
        Mode: <strong>{mode}</strong>, {text.length} characters of input
      </p>
    </>
  )
}

createRoot(document.getElementById('root')!).render(<App />)
