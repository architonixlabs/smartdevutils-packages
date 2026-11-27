/* ---
title: Every case variant of one phrase
entry: text/toCase, text/slugifyText
node: true
--- */
import { toCase, slugifyText, type CaseVariant } from '@smartdevutils/core/text'

const phrase = 'user account settings page'
const variants: CaseVariant[] = ['camel', 'pascal', 'snake', 'kebab', 'title', 'upper', 'lower']

for (const v of variants) console.log(v.padEnd(7), toCase(phrase, v))

console.log('slug   ', slugifyText('10 Tips for Faster CI/CD: Ünïcödé Edition!'))
