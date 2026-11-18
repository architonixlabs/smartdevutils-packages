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

describe('diffDdlStatements (1.2.0 fixes)', () => {
  it('ignores table-level constraint lines', () => {
    const before = 'CREATE TABLE t (id INT, email VARCHAR(100));';
    const after = `CREATE TABLE t (
      id INT,
      email VARCHAR(100),
      CONSTRAINT pk_t PRIMARY KEY (id),
      PRIMARY KEY (id),
      UNIQUE (email),
      UNIQUE KEY uq_email (email),
      CHECK (id > 0),
      FOREIGN KEY (id) REFERENCES other(id),
      INDEX idx_email (email),
      KEY idx_id (id)
    );`;
    const diff = diffDdlStatements(before, after);
    expect(diff.added).toEqual([]);
    expect(diff.removed).toEqual([]);
    expect(diff.changed).toEqual([]);
  });

  it('a -- comment does not swallow the next column', () => {
    const before = 'CREATE TABLE t (id INT);';
    const after = 'CREATE TABLE t (\n  id INT, -- the key\n  name TEXT /* block, comment */,\n  age INT\n);';
    const diff = diffDdlStatements(before, after);
    expect(diff.added.map(c => c.name)).toEqual(['name', 'age']);
    expect(diff.added[0].type).toBe('TEXT');
  });

  it('compares unquoted identifiers case-insensitively', () => {
    const diff = diffDdlStatements('CREATE TABLE t (Name TEXT);', 'CREATE TABLE T (name TEXT);');
    expect(diff.added).toEqual([]);
    expect(diff.removed).toEqual([]);
  });

  it('treats double-quoted identifiers as case-sensitive', () => {
    const diff = diffDdlStatements('CREATE TABLE t ("Name" TEXT);', 'CREATE TABLE t (name TEXT);');
    expect(diff.removed.map(c => c.name)).toEqual(['Name']);
    expect(diff.added.map(c => c.name)).toEqual(['name']);
  });

  it('supports quoted identifiers in all styles', () => {
    const diff = diffDdlStatements(
      'CREATE TABLE `t` (`id` INT, [first name] TEXT, "order" INT);',
      'CREATE TABLE `t` (`id` INT, [first name] VARCHAR(10), "order" INT, "a,b" TEXT);',
    );
    expect(diff.added.map(c => c.name)).toEqual(['a,b']);
    expect(diff.changed).toHaveLength(1);
    expect(diff.changed[0].name).toBe('first name');
  });

  it('handles multiple CREATE TABLE statements', () => {
    const before = 'CREATE TABLE a (id INT);\nCREATE TABLE b (id INT, x TEXT);';
    const after = 'CREATE TABLE a (id INT, y INT);\nCREATE TABLE b (id INT);\nCREATE TABLE c (id INT);';
    const diff = diffDdlStatements(before, after);
    expect(diff.added.map(c => `${c.table}.${c.name}`)).toEqual(['a.y']);
    expect(diff.removed.map(c => `${c.table}.${c.name}`)).toEqual(['b.x']);
    expect(diff.addedTables).toEqual(['c']);
    expect(diff.removedTables).toEqual([]);
  });

  it('separates type from inline constraints and detects nullability changes', () => {
    const diff = diffDdlStatements('CREATE TABLE t (title VARCHAR(100));', 'CREATE TABLE t (title VARCHAR(100) NOT NULL);');
    expect(diff.added[0]).toBeUndefined();
    expect(diff.changed).toHaveLength(1);
    expect(diff.changed[0].before).toBe('VARCHAR(100)');
    expect(diff.changed[0].after).toBe('VARCHAR(100) NOT NULL');
  });
});

describe('generateMigrationSql (1.2.0 fixes)', () => {
  it('postgres: emits TYPE and SET NOT NULL as separate statements', () => {
    const m = generateMigrationSql('CREATE TABLE posts (title VARCHAR(100));', 'CREATE TABLE posts (title VARCHAR(500) NOT NULL);', 'postgres');
    expect(m.up).toContain('ALTER TABLE posts ALTER COLUMN title TYPE VARCHAR(500);');
    expect(m.up).toContain('ALTER TABLE posts ALTER COLUMN title SET NOT NULL;');
    expect(m.up).not.toMatch(/TYPE VARCHAR\(500\) NOT NULL/);
    expect(m.down).toContain('ALTER TABLE posts ALTER COLUMN title TYPE VARCHAR(100);');
    expect(m.down).toContain('ALTER TABLE posts ALTER COLUMN title DROP NOT NULL;');
  });

  it('postgres: default changes use SET/DROP DEFAULT', () => {
    const m = generateMigrationSql("CREATE TABLE t (s TEXT DEFAULT 'a');", 'CREATE TABLE t (s TEXT);', 'postgres');
    expect(m.up).toBe('ALTER TABLE t ALTER COLUMN s DROP DEFAULT;');
    expect(m.down).toBe("ALTER TABLE t ALTER COLUMN s SET DEFAULT 'a';");
  });

  it('mysql: MODIFY COLUMN carries the full definition without PRIMARY KEY', () => {
    const m = generateMigrationSql('CREATE TABLE t (id INT PRIMARY KEY, title VARCHAR(100));', 'CREATE TABLE t (id BIGINT PRIMARY KEY, title VARCHAR(500) NOT NULL);', 'mysql');
    expect(m.up).toContain('ALTER TABLE t MODIFY COLUMN title VARCHAR(500) NOT NULL;');
    expect(m.up).toContain('ALTER TABLE t MODIFY COLUMN id BIGINT;');
    expect(m.down).toContain('ALTER TABLE t MODIFY COLUMN title VARCHAR(100);');
  });

  it('warns when a constraint change cannot be expressed as an ALTER COLUMN', () => {
    const pg = generateMigrationSql('CREATE TABLE t (a TEXT);', 'CREATE TABLE t (a TEXT UNIQUE);', 'postgres');
    expect(pg.up).toMatch(/^-- WARNING: constraint change on t\.a/);
    const my = generateMigrationSql('CREATE TABLE t (a TEXT);', 'CREATE TABLE t (a TEXT UNIQUE);', 'mysql');
    expect(my.warnings?.[0]).toMatch(/UNIQUE change on t\.a/);
  });

  it('warns about a possible rename when a dropped and added column share a type', () => {
    const m = generateMigrationSql('CREATE TABLE u (id INT, fullname TEXT);', 'CREATE TABLE u (id INT, display_name TEXT);', 'postgres');
    expect(m.up).toContain('-- WARNING: possible rename');
    expect(m.up).toContain('fullname');
    expect(m.up).toContain('display_name');
    expect(m.up).toContain('DROP+ADD loses data');
    expect(m.warnings?.length).toBe(1);
  });

  it('empty "before" produces CREATE TABLE and DROP TABLE', () => {
    const m = generateMigrationSql('', 'CREATE TABLE t (id INT PRIMARY KEY, name TEXT)', 'postgres');
    expect(m.up).toMatch(/^CREATE TABLE t \(/);
    expect(m.up.trim().endsWith(';')).toBe(true);
    expect(m.up).not.toContain('ALTER TABLE table');
    expect(m.down).toBe('DROP TABLE t;');
  });

  it('dropped table produces DROP TABLE and re-creates it in down', () => {
    const m = generateMigrationSql('CREATE TABLE t (id INT);', '', 'mysql');
    expect(m.up).toBe('DROP TABLE t;');
    expect(m.down).toContain('CREATE TABLE t (id INT);');
  });

  it('no changes returns an explicit "-- No schema changes" result', () => {
    const m = generateMigrationSql('CREATE TABLE t (id INT);', 'create table T (ID int);', 'postgres');
    expect(m.up).toBe('-- No schema changes');
    expect(m.down).toBe('-- No schema changes');
    expect(m.hasChanges).toBe(false);
  });

  it('throws when neither side contains a CREATE TABLE', () => {
    expect(() => generateMigrationSql('', '', 'postgres')).toThrow(/CREATE TABLE/);
  });
});

describe('analyzeQueryForIndexes (1.2.0 fixes)', () => {
  const cols = (sql: string) => analyzeQueryForIndexes(sql).map(s => `${s.table}:${s.column}`);

  it('does not suggest an index on a SELECT alias used in ORDER BY', () => {
    expect(cols('SELECT name AS n, COUNT(*) total FROM users ORDER BY n, total')).toEqual([]);
  });

  it('resolves table aliases in qualified columns', () => {
    const r = analyzeQueryForIndexes('SELECT u.id FROM users u ORDER BY u.name');
    expect(r).toHaveLength(1);
    expect(r[0].column).toBe('name');
    expect(r[0].sql).toBe('CREATE INDEX idx_users_name ON users (name);');
  });

  it('ignores string literals containing operators', () => {
    expect(cols("SELECT id FROM t WHERE name='a=b' AND x<>'c>d'")).toEqual(['t:name', 't:x']);
  });

  it('recognises IN / BETWEEN / IS NULL / range predicates', () => {
    const r = cols('SELECT id FROM t WHERE a IN (1,2) AND b BETWEEN 1 AND 5 AND c IS NULL AND d >= 3');
    expect(r.join(' ')).not.toMatch(/\b(IN|BETWEEN|NULL|AND)\b/);
    const all = analyzeQueryForIndexes('SELECT id FROM t WHERE a IN (1,2) AND b BETWEEN 1 AND 5 AND c IS NULL AND d >= 3');
    expect(all[0].columns).toEqual(['a', 'c', 'b']);
    expect(all.map(s => s.column)).toContain('d');
  });

  it('attributes JOIN ON columns to the joined table', () => {
    const r = analyzeQueryForIndexes('SELECT o.id FROM users u JOIN orders o ON o.user_id = u.id WHERE u.email = ?');
    const join = r.find(s => s.column === 'user_id');
    expect(join?.table).toBe('orders');
    expect(join?.sql).toBe('CREATE INDEX idx_orders_user_id ON orders (user_id);');
    expect(r.find(s => s.column === 'email')?.table).toBe('users');
  });

  it('suggests a composite index for multi-column equality + ORDER BY', () => {
    const r = analyzeQueryForIndexes("SELECT * FROM orders WHERE customer_id = 1 AND status = 'open' ORDER BY created_at DESC");
    expect(r[0].columns).toEqual(['customer_id', 'status', 'created_at']);
    expect(r[0].sql).toBe('CREATE INDEX idx_orders_customer_id_status_created_at ON orders (customer_id, status, created_at);');
  });

  it('does not build a composite index across OR predicates', () => {
    const r = analyzeQueryForIndexes('SELECT * FROM t WHERE a = 1 OR b = 2');
    expect(r.map(s => s.column)).toEqual(['a', 'b']);
  });

  it('skips leading-wildcard LIKE but uses prefix LIKE', () => {
    expect(cols("SELECT id FROM t WHERE a LIKE '%x' AND b LIKE 'x%'")).toEqual(['t:b']);
  });
});

describe('detectSlowQueryPatterns (1.2.0 fixes)', () => {
  const names = (sql: string) => detectSlowQueryPatterns(sql).map(p => p.pattern);

  it('does not treat column names containing DELETE/UPDATE as statements', () => {
    expect(names('SELECT deleted_at, updated_by FROM t LIMIT 5')).toEqual([]);
  });

  it('ignores keywords inside string literals and comments', () => {
    expect(names("SELECT id FROM t WHERE note = 'DELETE FROM x' LIMIT 1 -- UPDATE t")).toEqual([]);
  });

  it('still flags UPDATE / DELETE without WHERE', () => {
    expect(names('UPDATE t SET a = 1')).toContain('UPDATE/DELETE without WHERE');
    expect(names('delete from t')).toContain('UPDATE/DELETE without WHERE');
    expect(names('DELETE FROM t WHERE id = 1')).not.toContain('UPDATE/DELETE without WHERE');
  });

  it('checks each statement separately', () => {
    expect(names('SELECT id FROM t WHERE id = 1 LIMIT 1; DELETE FROM t')).toContain('UPDATE/DELETE without WHERE');
  });

  it('detects NOT IN ( SELECT with whitespace', () => {
    expect(names('SELECT id FROM t WHERE id NOT IN (\n  SELECT x FROM y) LIMIT 1')).toContain('NOT IN with subquery');
  });

  it('recognises TOP n and FETCH FIRST n ROWS as limits', () => {
    expect(names('SELECT TOP 10 id FROM t')).not.toContain('No LIMIT clause');
    expect(names('SELECT TOP (10) id FROM t')).not.toContain('No LIMIT clause');
    expect(names('SELECT id FROM t ORDER BY id FETCH FIRST 10 ROWS ONLY')).not.toContain('No LIMIT clause');
    expect(names('SELECT id FROM t OFFSET 0 ROWS FETCH NEXT 5 ROWS ONLY')).not.toContain('No LIMIT clause');
    expect(names('SELECT id FROM t')).toContain('No LIMIT clause');
  });
});

describe('generateCreateTable (1.2.0 fixes)', () => {
  const pk = (type: string) => ({ tableName: 't', columns: [{ name: 'id', type, primaryKey: true }] });

  it('postgres: only integer PKs become SERIAL', () => {
    expect(generateCreateTable(pk('integer'), 'postgres')).toContain('id SERIAL PRIMARY KEY');
    expect(generateCreateTable(pk('bigint'), 'postgres')).toContain('id BIGSERIAL PRIMARY KEY');
    expect(generateCreateTable(pk('uuid'), 'postgres')).toContain('id uuid PRIMARY KEY');
    expect(generateCreateTable(pk('varchar(36)'), 'postgres')).toContain('id varchar(36) PRIMARY KEY');
    expect(generateCreateTable(pk('uuid'), 'postgres')).not.toContain('SERIAL');
  });

  it('postgres: UUID PK can opt in to gen_random_uuid()', () => {
    expect(generateCreateTable(pk('UUID'), 'postgres', { uuidDefault: true })).toContain('id UUID PRIMARY KEY DEFAULT gen_random_uuid()');
  });

  it('mysql / mssql / sqlite: no auto-increment for non-integer PKs', () => {
    expect(generateCreateTable(pk('char(36)'), 'mysql')).not.toContain('AUTO_INCREMENT');
    expect(generateCreateTable(pk('uniqueidentifier'), 'mssql')).not.toContain('IDENTITY');
    expect(generateCreateTable(pk('text'), 'sqlite')).toContain('id text PRIMARY KEY');
    expect(generateCreateTable(pk('text'), 'sqlite')).not.toContain('AUTOINCREMENT');
    expect(generateCreateTable(pk('int'), 'mssql')).toContain('IDENTITY(1,1) PRIMARY KEY');
    expect(generateCreateTable(pk('int'), 'sqlite')).toContain('id INTEGER PRIMARY KEY AUTOINCREMENT');
  });

  it('autoIncrement: false disables auto-increment on integer PKs', () => {
    const s = { tableName: 't', columns: [{ name: 'id', type: 'int', primaryKey: true, autoIncrement: false }] };
    expect(generateCreateTable(s, 'mysql')).toContain('id int PRIMARY KEY');
    expect(generateCreateTable(s, 'mysql')).not.toContain('AUTO_INCREMENT');
  });

  it('quotes string defaults but leaves numbers, booleans and functions', () => {
    const s = { tableName: 't', columns: [
      { name: 'a', type: 'text', defaultValue: 'hello' },
      { name: 'b', type: 'text', defaultValue: "it's" },
      { name: 'c', type: 'int', defaultValue: '42' },
      { name: 'd', type: 'boolean', defaultValue: 'true' },
      { name: 'e', type: 'timestamp', defaultValue: 'now()' },
      { name: 'f', type: 'timestamp', defaultValue: 'CURRENT_TIMESTAMP' },
      { name: 'g', type: 'text', defaultValue: "'already'" },
      { name: 'h', type: 'numeric', defaultValue: '-1.5' },
      { name: 'i', type: 'text', defaultValue: 'NULL' },
    ] };
    const sql = generateCreateTable(s, 'postgres');
    expect(sql).toContain("a text DEFAULT 'hello'");
    expect(sql).toContain("b text DEFAULT 'it''s'");
    expect(sql).toContain('c int DEFAULT 42');
    expect(sql).toContain('d boolean DEFAULT true');
    expect(sql).toContain('e timestamp DEFAULT now()');
    expect(sql).toContain('f timestamp DEFAULT CURRENT_TIMESTAMP');
    expect(sql).toContain("g text DEFAULT 'already'");
    expect(sql).toContain('h numeric DEFAULT -1.5');
    expect(sql).toContain('i text DEFAULT NULL');
  });

  it('quotes reserved words per dialect', () => {
    const s = { tableName: 'order', columns: [{ name: 'user', type: 'int' }, { name: 'group', type: 'int' }, { name: 'select', type: 'int' }, { name: 'total', type: 'int' }] };
    expect(generateCreateTable(s, 'postgres')).toBe('CREATE TABLE "order" (\n  "user" int,\n  "group" int,\n  "select" int,\n  total int\n);');
    expect(generateCreateTable(s, 'mysql')).toContain('CREATE TABLE `order`');
    expect(generateCreateTable(s, 'mysql')).toContain('`user` int');
    expect(generateCreateTable(s, 'mssql')).toContain('CREATE TABLE [order]');
    expect(generateCreateTable(s, 'mssql')).toContain('[group] int');
    expect(generateCreateTable(s, 'sqlite')).toContain('"select" int');
  });
});
