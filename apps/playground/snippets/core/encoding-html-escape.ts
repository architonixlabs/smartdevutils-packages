/* ---
title: Escape user input before putting it in HTML
entry: encoding/htmlEncode, encoding/htmlDecode
description: htmlEncode turns markup characters into entities, so a comment cannot inject a script tag.
node: true
--- */
import { htmlEncode, htmlDecode } from '@smartdevutils/core/encoding'

const comment = '<img src=x onerror="alert(1)"> Fish & Chips'

const safe = htmlEncode(comment)
console.log(`<p class="comment">${safe}</p>`)

// And back, for example to edit the stored text again.
console.log(htmlDecode(safe) === comment)
