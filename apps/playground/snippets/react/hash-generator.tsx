/* ---
title: The HashGenerator panel
entry: components/HashGenerator
description: The classic panels are styled with Tailwind classes. Add the package to your Tailwind content list; in the playground they render unstyled.
--- */
import { createRoot } from 'react-dom/client'
import { HashGenerator } from '@smartdevutils/react'

createRoot(document.getElementById('root')!).render(
  <HashGenerator defaultAlgorithm="sha256" defaultInput="hello world" onResult={(hash, algorithm) => console.log(algorithm, hash)} />,
)
