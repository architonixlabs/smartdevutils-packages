/* ---
title: A recipe and its last run
entry: components/SduRecipe, components/SduRecipeRun
--- */
import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { SduRecipe, SduRecipeRun } from '@smartdevutils/react'
import type { RecipeRun } from '@smartdevutils/recipes'

function App() {
  const [run, setRun] = useState<RecipeRun | null>(null)
  return (
    <>
      <SduRecipe recipe="decode-base64-json-param" onStep={(d) => console.log(`step ${d.index + 1} done`)} onRun={setRun} />
      {run && <SduRecipeRun run={run} label="Last run" />}
    </>
  )
}

createRoot(document.getElementById('root')!).render(<App />)
