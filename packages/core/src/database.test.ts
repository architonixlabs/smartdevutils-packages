import { describe, it, expect } from 'vitest';
import { generateCreateTable, diffDdlStatements, detectSlowQueryPatterns, analyzeQueryForIndexes, generateMigrationSql } from './database';

describe('generateCreateTable', () => {
  it('generates basic CREATE TABLE for postgres', () => {
    const schema = {
      tableName: 'users',
      columns: [
        { name: 'id', type: 'integer', primaryKey: true, nullable: false },
        { name: 'email', type: 'varchar(255)', nullable: false },
      ],
    };
    const sql = generateCreateTable(schema, 'postgres');
    expect(sql).toContain('CREATE TABLE users');
    expect(sql).toContain('id');
    expect(sql).toContain('email');
    expect(sql).toContain('PRIMARY KEY');
  });

  it('generates auto increment for mysql', () => {
    const schema = {
      tableName: 'items',
      columns: [{ name: 'id', type: 'integer', primaryKey: true, nullable: false }],
    };
    const sql = generateCreateTable(schema, 'mysql');
    expect(sql).toContain('AUTO_INCREMENT');
  });
});

describe('diffDdlStatements', () => {
  it('detects added column', () => {
    const before = 'CREATE TABLE t (id INT, name VARCHAR(100));';
    const after = 'CREATE TABLE t (id INT, name VARCHAR(100), email VARCHAR(255));';
    const diff = diffDdlStatements(before, after);
    expect(diff.added.some(c => c.name === 'email')).toBe(true);
    expect(diff.removed).toHaveLength(0);
  });

  it('detects removed column', () => {
    const before = 'CREATE TABLE t (id INT, name VARCHAR(100));';
    const after = 'CREATE TABLE t (id INT);';
    const diff = diffDdlStatements(before, after);
    expect(diff.removed.some(c => c.name === 'name')).toBe(true);
  });
});

describe('detectSlowQueryPatterns', () => {
  it('detects SELECT *', () => {
    const results = detectSlowQueryPatterns('SELECT * FROM users');
    expect(results.some(r => r.pattern === 'SELECT *')).toBe(true);
  });

  it('detects leading wildcard LIKE', () => {
    const results = detectSlowQueryPatterns("SELECT id FROM t WHERE name LIKE '%foo'");
    expect(results.some(r => r.pattern.includes('LIKE'))).toBe(true);
  });

  it('returns empty for clean query', () => {
    expect(detectSlowQueryPatterns('SELECT id, name FROM users WHERE id = 1 LIMIT 10')).toHaveLength(0);
  });
});

describe('analyzeQueryForIndexes', () => {
  it('suggests index for WHERE column', () => {
    const result = analyzeQueryForIndexes('SELECT * FROM orders WHERE customer_id = 1');
    expect(result.some(r => r.column === 'customer_id')).toBe(true);
  });
});

describe('generateMigrationSql', () => {
  it('generates ADD COLUMN for postgres', () => {
    const before = 'CREATE TABLE t (id INT);';
    const after = 'CREATE TABLE t (id INT, email VARCHAR(255));';
    const m = generateMigrationSql(before, after, 'postgres');
    expect(m.up).toContain('ADD COLUMN email');
    expect(m.down).toContain('DROP COLUMN email');
  });
});
