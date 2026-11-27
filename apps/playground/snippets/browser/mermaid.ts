/* ---
title: Render Mermaid to SVG
entry: mermaid/renderMermaid
description: Mermaid loads on first use and always runs with securityLevel strict. renderMermaid never throws.
output: preview
--- */
import { renderMermaid, prefersDark } from '@smartdevutils/browser/mermaid'
import { ddlToErd } from '@smartdevutils/core/diagrams'

const erd = ddlToErd(`
  CREATE TABLE users (id INT PRIMARY KEY, email VARCHAR(200));
  CREATE TABLE orders (id INT PRIMARY KEY, user_id INT REFERENCES users(id));
`)

const result = await renderMermaid(erd.output ?? '', { dark: prefersDark(document.body) })
if (result.ok) {
  const box = document.createElement('div')
  box.innerHTML = result.svg // Mermaid's own sanitized SVG
  document.body.append(box)
} else {
  console.error(result.error)
}
