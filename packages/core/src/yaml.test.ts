import { describe, expect, it } from 'vitest';
import { YAML_CORE_MERGE_SCHEMA, YAML_CORE_SCHEMA, dumpYaml, loadAllYaml, loadYaml } from './yaml';

// js-yaml 4 behaviour the tools rely on, kept on js-yaml 5.
describe('yaml wrappers', () => {
  it('reads merge keys by default (Compose files share settings with <<: *anchor)', () => {
    const doc = loadYaml('x-base: &b {restart: always, image: nginx}\nservices:\n  web:\n    <<: *b\n    image: nginx:1.27');
    expect(doc).toEqual({ 'x-base': { restart: 'always', image: 'nginx' }, services: { web: { restart: 'always', image: 'nginx:1.27' } } });
  });

  it('reads timestamps as dates by default, but keeps them as text with the core schemas', () => {
    expect((loadYaml('d: 2024-01-02') as { d: Date }).d).toBeInstanceOf(Date);
    expect(loadYaml('d: 2024-01-02', { schema: YAML_CORE_SCHEMA })).toEqual({ d: '2024-01-02' });
    expect(loadYaml('d: 2024-01-02\nb: &a {x: 1}\nc: {<<: *a}', { schema: YAML_CORE_MERGE_SCHEMA }))
      .toEqual({ d: '2024-01-02', b: { x: 1 }, c: { x: 1 } });
  });

  it('YAML 1.2 booleans: yes/on stay strings', () => {
    expect(loadYaml('a: yes\nb: on\nc: true')).toEqual({ a: 'yes', b: 'on', c: true });
  });

  it('empty input gives undefined and a comment-only input null, instead of throwing', () => {
    expect(loadYaml('')).toBeUndefined();
    expect(loadYaml('  \n')).toBeUndefined();
    expect(loadYaml('# just a comment')).toBeNull();
  });

  it('several documents still throw for loadYaml, and loadAllYaml reads them all', () => {
    expect(() => loadYaml('a: 1\n---\nb: 2')).toThrow(/single document/);
    expect(loadAllYaml('a: 1\n---\n---\nb: 2')).toEqual([{ a: 1 }, null, { b: 2 }]);
  });

  it('!!set becomes an object of null values, as in js-yaml 4, even inside shared anchors', () => {
    expect(loadYaml('s: !!set {x, y}\nt: [!!set {z}]')).toEqual({ s: { x: null, y: null }, t: [{ z: null }] });
    const doc = loadYaml('a: &s !!set {k}\nb: *s') as Record<string, unknown>;
    expect(doc['a']).toEqual({ k: null });
  });

  it('syntax errors throw with a position', () => {
    expect(() => loadYaml('a: [1, 2')).toThrow(/\(\d+:\d+\)/);
    expect(() => loadYaml('a: 1\na: 2')).toThrow(/duplicated mapping key/);
  });

  it('dump quotes what YAML would misread and honours quoteStyle', () => {
    const out = dumpYaml({ env: { X: 'yes', Y: '010' }, cmd: ['a: b'] }, { quoteStyle: 'double' });
    expect(out).toBe('env:\n  X: "yes"\n  "Y": "010"\ncmd:\n  - "a: b"\n');
    expect(loadYaml(out)).toEqual({ env: { X: 'yes', Y: '010' }, cmd: ['a: b'] });
  });
});
