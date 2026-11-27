/* ---
title: Re-indent YAML, format and minify CSS
entry: formats/yamlFormat, formats/cssFormat, formats/cssMinify
node: true
--- */
import { yamlFormat, cssFormat, cssMinify } from '@smartdevutils/core/formats'

const yaml = `server:
      port: 8080
      hosts: [web-1, web-2]
database: {host: localhost, port: 5432}`
console.log(yamlFormat(yaml))

const css = '.btn{color:#fff;background:#1d4ed8;padding:8px 12px}'
const pretty = cssFormat(css)
console.log(pretty)
console.log(cssMinify(pretty))
