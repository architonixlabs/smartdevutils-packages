import { js as jsBeautify, css as cssBeautify } from 'js-beautify';
import yaml from 'js-yaml';
import { XMLParser, XMLBuilder } from 'fast-xml-parser';
import { parse as tomlParse, stringify as tomlStringify } from 'smol-toml';
import { format as sqlFormatterFormat } from 'sql-formatter';
import JsonToTS from 'json-to-ts';
import generateSchema from 'generate-schema';

export function yamlFormat(input: string): string {
  const parsed = yaml.load(input);
  return yaml.dump(parsed, { indent: 2 });
}

export function xmlFormat(input: string): string {
  const parser = new XMLParser({ ignoreAttributes: false });
  const obj = parser.parse(input);
  const builder = new XMLBuilder({ ignoreAttributes: false, format: true, indentBy: '  ' });
  const result = builder.build(obj);
  if (!result || result.trim() === '') throw new Error('Invalid XML');
  return result;
}

export function tomlFormat(input: string): string {
  const parsed = tomlParse(input);
  return tomlStringify(parsed);
}

export function cssFormat(input: string): string {
  return cssBeautify(input, { indent_size: 2 });
}

export function cssMinify(input: string): string {
  return input
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s*([{}:;,>+~])\s*/g, '$1')
    .replace(/;\}/g, '}')
    .replace(/\s+/g, ' ')
    .trim();
}

export function jsFormat(input: string): string {
  return jsBeautify(input, { indent_size: 2 });
}

export function jsMinify(input: string): string {
  return input.replace(/\s+/g, ' ').replace(/\s*([{}();,=+\-*/<>!&|])\s*/g, '$1').trim();
}

export function sqlFormat(input: string): string {
  return sqlFormatterFormat(input, { language: 'sql' });
}

export function sqlMinify(input: string): string {
  return sqlFormatterFormat(input, { language: 'sql' })
    .replace(/\s+/g, ' ')
    .trim();
}

export function jsonToTypeScript(input: string): string {
  const parsed = JSON.parse(input);
  return JsonToTS(parsed).join('\n\n');
}

export function jsonSchemaGenerate(input: string): string {
  const parsed = JSON.parse(input);
  return JSON.stringify(generateSchema.json(parsed), null, 2);
}
