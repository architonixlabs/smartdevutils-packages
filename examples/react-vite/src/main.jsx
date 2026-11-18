import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { SduDiagram, SduRecipe, SduRecipeRun, SduTool, setMermaidLoader } from '@smartdevutils/react'
// The styles for the Sdu* components: tokens (light and dark) and the .sdu-* classes.
import '@smartdevutils/theme/styles.css'

setMermaidLoader(() => import('mermaid'))

const STATE = 'stateDiagram-v2\n  [*] --> Draft\n  Draft --> Review: submit\n  Review --> Draft: changes requested\n  Review --> Published: approve\n  Published --> [*]'

function App() {
  const [text, setText] = useState('a1b2c3')
  const [last, setLast] = useState('')
  const [run, setRun] = useState(null)
  const toggleTheme = () => {
    const root = document.documentElement
    root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark'
  }
  return (
    <main className="page">
      <h1>SmartDevUtils in React</h1>
      <p>
        <button type="button" onClick={toggleTheme}>
          Switch light and dark
        </button>
      </p>
      <section id="tool">
        <SduTool
          tool="hash-generator"
          defaultMode="sha256"
          value={text}
          onChange={setText}
          onResult={(r) => setLast(r.error ? `Error: ${r.error}` : `${r.output.length} characters`)}
        />
        <p data-testid="last-result">Last result: {last}</p>
      </section>
      <section id="diagram">
        <SduDiagram source={STATE} label="Document states" />
      </section>
      <section id="recipe">
        <SduRecipe recipe="decode-base64-json-param" onRun={setRun} />
      </section>
      <section id="recipe-run">
        <SduRecipeRun run={run} upload label="Last run" />
      </section>
    </main>
  )
}

const style = document.createElement('style')
style.textContent =
  'body{margin:0;font-family:system-ui,sans-serif;background:var(--sdu-bg);color:var(--sdu-fg)}.page{max-width:960px;margin:0 auto;padding:16px;display:flex;flex-direction:column;gap:16px}'
document.head.appendChild(style)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
