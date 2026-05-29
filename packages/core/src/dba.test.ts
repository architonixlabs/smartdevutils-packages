import { describe, it, expect } from 'vitest';
import { jsonToSqlInserts, parseConnectionString, sanitizeSql } from './dba';

describe('jsonToSqlInserts', () => {
  it('generates INSERT for single object', () => {
    const r = jsonToSqlInserts('[{"id":1,"name":"Alice"}]', 'users');
    expect(r).toContain('INSERT INTO users');
    expect(r).toContain('(id, name)');
    expect(r).toContain("(1, 'Alice')");
  });
  it('generates multiple INSERTs for array', () => {
    const r = jsonToSqlInserts('[{"id":1},{"id":2}]', 'items');
    expect(r.split('\n').filter(l => l.startsWith('INSERT')).length).toBe(2);
  });
  it('throws on non-array JSON', () => {
    expect(() => jsonToSqlInserts('{"id":1}', 'users')).toThrow();
  });
});

describe('parseConnectionString', () => {
  it('parses PostgreSQL URI', () => {
    const r = parseConnectionString('postgresql://user:pass@localhost:5432/mydb');
    expect(r.protocol).toBe('postgresql');
    expect(r.host).toBe('localhost');
    expect(r.port).toBe('5432');
    expect(r.database).toBe('mydb');
    expect(r.username).toBe('user');
  });
  it('parses URI without port', () => {
    const r = parseConnectionString('mysql://root@db.example.com/shop');
    expect(r.protocol).toBe('mysql');
    expect(r.port).toBe('');
  });
  it('returns empty fields for unrecognised format', () => {
    expect(parseConnectionString('not-a-uri').protocol).toBe('');
  });
});

describe('sanitizeSql', () => {
  it('escapes single quotes', () => {
    expect(sanitizeSql("O'Brien")).toBe("O''Brien");
  });
  it('removes SQL comment sequences', () => {
    expect(sanitizeSql("admin'--")).not.toContain('--');
  });
  it('leaves safe input unchanged', () => {
    expect(sanitizeSql('hello world')).toBe('hello world');
  });
});
