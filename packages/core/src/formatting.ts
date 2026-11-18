// js-beautify is CommonJS: Node's ESM loader cannot see its named exports, so use the default.
import beautify from 'js-beautify';
const { html: htmlBeautify } = beautify;

export function jsonFormat(input: string, indent = 2): string {
  return JSON.stringify(JSON.parse(input), null, indent);
}

export function jsonMinify(input: string): string {
  return JSON.stringify(JSON.parse(input));
}

export function htmlPrettify(input: string): string {
  return htmlBeautify(input, { indent_size: 2, wrap_line_length: 120 });
}
