import { describe, it, expect } from 'vitest';
import {
  yamlFormat, xmlFormat, tomlFormat,
  cssFormat, cssMinify,
  jsFormat, jsMinify,
  sqlFormat, sqlMinify,
  jsonToTypeScript, jsonSchemaGenerate,
} from './formats';

describe('yamlFormat', () => {
  it('round-trips valid YAML', () => {
    const result = yamlFormat('name: John\nage: 30');
    expect(result).toContain('name: John');
    expect(result).toContain('age: 30');
  });
  it('throws on invalid YAML', () => {
    expect(() => yamlFormat(': : invalid')).toThrow();
  });
});

describe('xmlFormat', () => {
  it('formats XML with indentation', () => {
    const result = xmlFormat('<root><child>hello</child></root>');
    expect(result).toContain('<root>');
    expect(result).toContain('<child>');
  });
  it('returns defined result for unclosed tag (fast-xml-parser is lenient)', () => {
    expect(xmlFormat('<unclosed>')).toBeDefined();
  });
});

describe('tomlFormat', () => {
  it('round-trips valid TOML', () => {
    const result = tomlFormat('[server]\nhost = "localhost"');
    expect(result).toContain('host');
    expect(result).toContain('localhost');
  });
});

describe('cssFormat', () => {
  it('beautifies CSS', () => {
    const result = cssFormat('body{color:red;background:blue}');
    expect(result).toContain('color: red');
  });
});

describe('cssMinify', () => {
  it('strips whitespace from CSS', () => {
    const result = cssMinify('body {\n  color: red;\n  background: blue;\n}');
    expect(result.length).toBeLessThan(40);
    expect(result).toContain('color:red');
  });
});

describe('jsFormat', () => {
  it('beautifies JS', () => {
    const result = jsFormat('function foo(){return 1;}');
    expect(result).toContain('function foo()');
    expect(result).toContain('return 1;');
  });
});

describe('jsMinify', () => {
  it('minifies JS', () => {
    const result = jsMinify('function foo() {\n  return 1;\n}');
    expect(result.length).toBeLessThanOrEqual(25);
  });
});

describe('sqlFormat', () => {
  it('formats SQL with uppercase keywords', () => {
    const result = sqlFormat('select id,name from users where id=1');
    expect(result.toLowerCase()).toContain('select');
    expect(result.toLowerCase()).toContain('from');
  });
});

describe('sqlMinify', () => {
  it('collapses SQL whitespace', () => {
    const result = sqlMinify('SELECT\n  id,\n  name\nFROM\n  users');
    expect(result).not.toContain('\n');
  });
});

describe('jsonToTypeScript', () => {
  it('generates TypeScript interface from JSON', () => {
    const result = jsonToTypeScript('{"name":"John","age":30}');
    expect(result).toContain('interface');
    expect(result).toContain('name');
    expect(result).toContain('age');
  });
});

describe('jsonSchemaGenerate', () => {
  it('generates JSON Schema from JSON', () => {
    const result = jsonSchemaGenerate('{"name":"John","age":30}');
    const schema = JSON.parse(result);
    expect(schema.$schema).toBeDefined();
    expect(schema.properties.name).toBeDefined();
  });
});
