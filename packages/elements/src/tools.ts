import { defineElement } from './base'
import { SduToolElement } from './tool'

/** A `<sdu-tool>` fixed to one tool: same attributes, properties, methods and events, without `tool`. */
function fixedTool(id: string): typeof SduToolElement {
  return class extends SduToolElement {
    constructor() {
      super()
      this.tool = id
    }
  }
}

/** `<sdu-json-formatter>`: format, minify or validate JSON. */
export const SduJsonFormatterElement = fixedTool('json-formatter')
/** `<sdu-base64>`: Base64 encode and decode (standard or URL-safe). */
export const SduBase64Element = fixedTool('base64-encoder-decoder')
/** `<sdu-url-encoder>`: URL encode and decode. */
export const SduUrlEncoderElement = fixedTool('url-encoder-decoder')
/** `<sdu-hash-generator>`: MD5, SHA and HMAC hashes. */
export const SduHashGeneratorElement = fixedTool('hash-generator')
/** `<sdu-uuid-generator>`: UUID v1, v4, v5 and v7. */
export const SduUuidGeneratorElement = fixedTool('uuid-generator')

/** The named tool elements and the tool each one runs. */
export const NAMED_TOOL_ELEMENTS: Readonly<Record<string, string>> = {
  'sdu-json-formatter': 'json-formatter',
  'sdu-base64': 'base64-encoder-decoder',
  'sdu-url-encoder': 'url-encoder-decoder',
  'sdu-hash-generator': 'hash-generator',
  'sdu-uuid-generator': 'uuid-generator',
}

defineElement('sdu-json-formatter', SduJsonFormatterElement)
defineElement('sdu-base64', SduBase64Element)
defineElement('sdu-url-encoder', SduUrlEncoderElement)
defineElement('sdu-hash-generator', SduHashGeneratorElement)
defineElement('sdu-uuid-generator', SduUuidGeneratorElement)

declare global {
  interface HTMLElementTagNameMap {
    'sdu-json-formatter': SduToolElement
    'sdu-base64': SduToolElement
    'sdu-url-encoder': SduToolElement
    'sdu-hash-generator': SduToolElement
    'sdu-uuid-generator': SduToolElement
  }
}
