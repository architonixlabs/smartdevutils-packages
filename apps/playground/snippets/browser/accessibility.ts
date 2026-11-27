/* ---
title: Check an HTML fragment for accessibility problems
entry: accessibility/checkHtmlAccessibility, accessibility/getWcagViolations
description: Runs axe-core in the page. The first run loads axe-core, which is large.
--- */
import { checkHtmlAccessibility } from '@smartdevutils/browser/accessibility'

const html = `
  <img src="logo.png">
  <button></button>
  <a href="/pricing">Click here</a>
  <input type="email">`

const report = await checkHtmlAccessibility(html)
console.log(`score: ${report.score}`)
for (const v of report.violations) console.log(`[${v.level}] ${v.rule}: ${v.description} (${v.element})`)
for (const w of report.warnings) console.log('warning:', w)
