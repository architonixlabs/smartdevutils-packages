import { describe, expect, it } from 'vitest';
import { buildDdlChangeDiagram, DDL_CHANGE_LEGEND } from './ddl-change-diagram';

const BEFORE = `CREATE TABLE customers (id INT PRIMARY KEY, email VARCHAR(100), name TEXT);
CREATE TABLE clients_legacy (id INT PRIMARY KEY, code TEXT, region TEXT, owner TEXT);
CREATE TABLE orders (id INT PRIMARY KEY, customer_id INT NOT NULL REFERENCES customers(id), total FLOAT);
CREATE TABLE audit (id INT, note TEXT, legacy_id INT REFERENCES clients_legacy(id));
CREATE TABLE coupons (id INT PRIMARY KEY, code TEXT);
CREATE TABLE unrelated (id INT PRIMARY KEY);`;

const AFTER = `CREATE TABLE customers (id INT PRIMARY KEY, email VARCHAR(255), name TEXT, phone TEXT);
CREATE TABLE accounts (id INT PRIMARY KEY, code TEXT, region TEXT, owner TEXT);
CREATE TABLE orders (id INT PRIMARY KEY, customer_id INT NOT NULL REFERENCES customers(id), total DECIMAL(12,2), coupon_id INT REFERENCES coupons(id));
CREATE TABLE coupons (id INT PRIMARY KEY, code TEXT);
CREATE TABLE shipments (id INT PRIMARY KEY, order_id INT NOT NULL REFERENCES orders(id));
CREATE TABLE unrelated (id INT PRIMARY KEY);`;

/** Lines of one entity block, from its header to the closing "}". */
function block(src: string, id: string): string[] {
  const lines = src.split('\n');
  const start = lines.findIndex(l => l.startsWith(`    ${id} {`) || l.startsWith(`    ${id}[`));
  expect(start, `entity ${id}`).toBeGreaterThan(-1);
  const end = lines.indexOf('    }', start);
  return lines.slice(start, end + 1);
}

describe('buildDdlChangeDiagram', () => {
  it('returns no diagram when nothing changed', () => {
    const r = buildDdlChangeDiagram(BEFORE, BEFORE);
    expect(r.source).toBe('');
    expect(r.summary.tablesChanged + r.summary.tablesAdded + r.summary.tablesRemoved).toBe(0);
  });

  it('returns no diagram for empty or unreadable input', () => {
    expect(buildDdlChangeDiagram('', '').source).toBe('');
    expect(buildDdlChangeDiagram('SELECT 1;', 'hello').source).toBe('');
  });

  it('ignores whitespace and case differences in types and names', () => {
    expect(buildDdlChangeDiagram('CREATE TABLE t (a NUMERIC(10, 2));', 'create table T (A numeric(10,2));').source).toBe('');
  });

  it('starts with erDiagram and the legend as a Mermaid comment', () => {
    const lines = buildDdlChangeDiagram(BEFORE, AFTER).source.split('\n');
    expect(lines[0]).toBe('erDiagram');
    expect(lines[1]).toBe(`    %% ${DDL_CHANGE_LEGEND}`);
  });

  it('marks added columns and type changes old → new', () => {
    const r = buildDdlChangeDiagram(BEFORE, AFTER);
    const c = block(r.source, 'customers');
    expect(c[0]).toBe('    customers["~ customers (changed)"] {');
    expect(c).toContain('        VARCHAR(255) email "~ type: VARCHAR(100) → VARCHAR(255)"');
    expect(c).toContain('        TEXT phone "+ added"');
    expect(c).toContain('        TEXT name');
    expect(block(r.source, 'orders')).toContain('        DECIMAL(12_2) total "~ type: FLOAT → DECIMAL(12,2)"');
    expect(r.summary).toMatchObject({ columnsAdded: 2, typesChanged: 2, tablesChanged: 2 });
  });

  it('lists removed columns with their old type', () => {
    const r = buildDdlChangeDiagram(
      'CREATE TABLE products (id INT PRIMARY KEY, name VARCHAR(100), description TEXT);',
      'CREATE TABLE products (id INT PRIMARY KEY, name VARCHAR(100));',
    );
    expect(block(r.source, 'products')).toEqual([
      '    products["~ products (changed)"] {',
      '        INT id PK',
      '        VARCHAR(100) name',
      '        TEXT description "− removed"',
      '    }',
    ]);
    expect(r.summary.columnsRemoved).toBe(1);
    expect(r.source).toContain('    classDef changed ');
    expect(r.source).toContain('    class products changed');
  });

  it('marks new and dropped tables and styles them', () => {
    const r = buildDdlChangeDiagram(BEFORE, AFTER);
    expect(r.source).toContain('    shipments["+ shipments (new)"] {');
    expect(r.source).toContain('    audit["− audit (dropped)"] {');
    expect(r.source).toContain('    class accounts,shipments added');
    expect(r.source).toContain('    class clients_legacy,audit removed');
    expect(r.summary).toMatchObject({ tablesAdded: 2, tablesRemoved: 2 });
  });

  it('flags a new table that looks like a renamed dropped one', () => {
    const r = buildDdlChangeDiagram(BEFORE, AFTER);
    expect(r.source).toContain('    accounts["+ accounts (new, was clients_legacy?)"] {');
    expect(r.renameHints).toEqual(['accounts looks like a rename of clients_legacy (100% of columns match).']);
  });

  it('does not call a table a rename when few columns match', () => {
    const r = buildDdlChangeDiagram('CREATE TABLE a (id INT, x INT, y INT);', 'CREATE TABLE b (id INT, p INT, q INT);');
    expect(r.renameHints).toEqual([]);
    expect(r.source).toContain('    b["+ b (new)"] {');
    expect(r.source).toContain('    a["− a (dropped)"] {');
  });

  it('marks added, removed and kept relationships', () => {
    const src = buildDdlChangeDiagram(BEFORE, AFTER).source;
    expect(src).toContain('    orders }o--|| customers : "customer_id"');
    expect(src).toContain('    orders }o--o| coupons : "+ coupon_id"');
    expect(src).toContain('    shipments }o--|| orders : "+ order_id"');
    // removed relationships are dotted
    expect(src).toContain('    audit }o..o| clients_legacy : "− legacy_id"');
  });

  it('counts a foreign key added or removed by ALTER TABLE on an otherwise unchanged table', () => {
    const base = 'CREATE TABLE a (id INT PRIMARY KEY); CREATE TABLE b (id INT PRIMARY KEY, a_id INT);';
    const r = buildDdlChangeDiagram(base, base + ' ALTER TABLE b ADD CONSTRAINT fk FOREIGN KEY (a_id) REFERENCES a(id);');
    expect(r.summary).toMatchObject({ relationshipsAdded: 1, relationshipsRemoved: 0, tablesChanged: 1 });
    expect(r.source).toContain('    b["~ b (changed)"] {');
    expect(r.source).toContain('    b }o--o| a : "+ a_id"');
    const back = buildDdlChangeDiagram(base + ' ALTER TABLE b ADD FOREIGN KEY (a_id) REFERENCES a(id);', base);
    expect(back.summary.relationshipsRemoved).toBe(1);
    expect(back.source).toContain('    b }o..o| a : "− a_id"');
  });

  it('"Only changed tables" keeps direct FK neighbours and leaves the rest out', () => {
    const changed = buildDdlChangeDiagram(BEFORE, AFTER, 'changed');
    expect(changed.source).toContain('    coupons {'); // neighbour of orders
    expect(changed.source).not.toContain('unrelated');
    expect(changed.shownTables).toBe(7);
    expect(changed.totalTables).toBe(8);
    const all = buildDdlChangeDiagram(BEFORE, AFTER, 'all');
    expect(all.source).toContain('    unrelated {');
    expect(all.shownTables).toBe(8);
  });

  it('reduces hostile names to safe ids and keeps comments free of quotes and %%', () => {
    const r = buildDdlChangeDiagram(
      'CREATE TABLE "we;ird %% {x}" ("col""q" INT, "<script>" TEXT, "t" VARCHAR(10));',
      'CREATE TABLE "we;ird %% {x}" ("col""q" BIGINT, "new:%%col" TEXT, "t" "my""type%%");\nCREATE TABLE "a\nb" (id INT REFERENCES "we;ird %% {x}");',
    );
    const src = r.source;
    expect(src).toContain('    we_ird_x["~ we_ird_x (changed)"] {');
    expect(src).toContain('        BIGINT col_q "~ type: INT → BIGINT"');
    expect(src).toContain('        TEXT new_col "+ added"');
    expect(src).toContain('        TEXT script "− removed"');
    expect(src).toContain('    a_b }o--o| we_ird_x : "+ id"');
    const body = src.split('\n').slice(2).join('\n'); // skip the legend comment
    expect(body).not.toMatch(/%%|<script>|;/);
    for (const line of body.split('\n')) expect((line.match(/"/g) ?? []).length % 2).toBe(0);
  });

  it('keeps schemas apart and pairs a table that only gained a schema qualifier', () => {
    const r = buildDdlChangeDiagram('CREATE TABLE users (id INT);', 'CREATE TABLE app.users (id INT, x INT);');
    expect(r.summary).toMatchObject({ tablesAdded: 0, tablesRemoved: 0, columnsAdded: 1 });
    const two = buildDdlChangeDiagram(
      'CREATE TABLE a.t (id INT); CREATE TABLE b.t (id INT);',
      'CREATE TABLE a.t (id INT); CREATE TABLE b.t (id BIGINT);',
    );
    expect(two.source).toContain('    b_t["~ b_t (changed)"] {');
    expect(two.source).not.toContain('a_t');
  });

  it('caps the number of tables drawn and says so', () => {
    const before = Array.from({ length: 40 }, (_, i) => `CREATE TABLE t${i} (id INT);`).join('\n');
    const after = Array.from({ length: 40 }, (_, i) => `CREATE TABLE t${i} (id BIGINT);`).join('\n');
    const r = buildDdlChangeDiagram(before, after, 'all', 25);
    expect(r.capped).toBe(true);
    expect(r.shownTables).toBe(25);
    expect(r.totalTables).toBe(40);
    expect(r.source.match(/\["~ /g)?.length).toBe(25);
    expect(buildDdlChangeDiagram(before, after, 'all').capped).toBe(false);
  });
});
