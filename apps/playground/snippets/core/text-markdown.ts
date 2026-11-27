/* ---
title: Markdown to HTML and back, with a readability score
entry: text-extra/markdownToHtml, text-extra/htmlToMarkdown, text-extra/readabilityScore
description: markdownToHtml does not sanitize. Sanitize the HTML before you put untrusted Markdown in a page.
node: true
--- */
import { markdownToHtml, htmlToMarkdown, readabilityScore } from '@smartdevutils/core/text-extra'

const md = [
  '# Release 1.3.0',
  '',
  '- **Faster** builds',
  '- A new `runTool()` helper',
  '',
  'Read the [changelog](https://example.com/changelog).',
].join('\n')

const html = markdownToHtml(md)
console.log(html)
console.log(htmlToMarkdown(html))
console.log(readabilityScore('Short sentences help. Plain words help too. Readers finish the page.'))
