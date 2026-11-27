/* ---
title: Build and read a query string
entry: encoding/urlEncode, encoding/urlDecode
node: true
--- */
import { urlEncode, urlDecode } from '@smartdevutils/core/encoding'

const params = { q: 'café & croissants', page: '2', redirect: 'https://example.com/a?b=c' }

const query = Object.entries(params)
  .map(([key, value]) => `${urlEncode(key)}=${urlEncode(value)}`)
  .join('&')
console.log(`https://example.com/search?${query}`)

// Read the values back:
for (const pair of query.split('&')) {
  const [key, value] = pair.split('=')
  console.log(urlDecode(key), '=', urlDecode(value))
}
