import { describe, expect, it } from 'vitest';
import { DdlToErdService, ErdFormat } from './ddl-to-erd';

const svc = new DdlToErdService();
const run = (sql: string, format: ErdFormat = 'mermaid') => {
  const r = svc.convert(sql, format);
  expect(r.error ?? null).toBeNull();
  return r.output;
};

/** Registry example 1 (PostgreSQL). */
const SHOP = `-- shop schema
CREATE TABLE users (
  id          BIGSERIAL PRIMARY KEY,
  email       VARCHAR(255) NOT NULL UNIQUE,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE TABLE orders (
  id       BIGSERIAL PRIMARY KEY,
  user_id  BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  total    NUMERIC(10, 2) NOT NULL, /* money */
  coupon_id INT REFERENCES coupons
);

CREATE TABLE order_items (
  order_id   BIGINT NOT NULL,
  line_no    INT NOT NULL,
  sku        TEXT NOT NULL,
  PRIMARY KEY (order_id, line_no),
  CONSTRAINT fk_items_order FOREIGN KEY (order_id) REFERENCES orders (id)
);`;

/** Registry example 2 (MySQL, backticks, ALTER TABLE). */
const BLOG = [
  'CREATE TABLE `authors` (',
  '  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,',
  "  `name` VARCHAR(100) CHARACTER SET utf8mb4 NOT NULL COMMENT 'display name, not unique',",
  '  PRIMARY KEY (`id`)',
  ') ENGINE=InnoDB;',
  '',
  'CREATE TABLE `posts` (',
  '  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,',
  '  `author_id` INT UNSIGNED NULL,',
  "  `status` ENUM('draft','live') NOT NULL DEFAULT 'draft',",
  '  PRIMARY KEY (`id`),',
  '  UNIQUE KEY `uk_author_status` (`author_id`, `status`),',
  '  KEY `idx_author` (`author_id`)',
  ');',
  '',
  'ALTER TABLE `posts` ADD CONSTRAINT `fk_posts_author` FOREIGN KEY (`author_id`) REFERENCES `authors` (`id`);',
].join('\n');

/** Registry example 3 (SQL Server, brackets, schema-qualified, composite FK). */
const HR = `CREATE TABLE [hr].[Departments] (
  [DeptId] INT IDENTITY(1,1) NOT NULL,
  [Region] CHAR(2) NOT NULL,
  [Name] NVARCHAR(100) NOT NULL,
  CONSTRAINT [PK_Departments] PRIMARY KEY CLUSTERED ([DeptId] ASC, [Region] ASC)
);
GO
CREATE TABLE [hr].[Employees] (
  [EmployeeId] INT NOT NULL PRIMARY KEY,
  [DeptId] INT NOT NULL,
  [Region] CHAR(2) NOT NULL,
  [Badge No] VARCHAR(20) NULL
);
GO
ALTER TABLE [hr].[Employees] WITH CHECK ADD CONSTRAINT [FK_Emp_Dept]
  FOREIGN KEY([DeptId], [Region]) REFERENCES [hr].[Departments] ([DeptId], [Region]);
GO`;

describe('DdlToErdService: Mermaid', () => {
  it('converts tables, keys and relationships (registry example 1)', () => {
    expect(run(SHOP)).toBe(`erDiagram
    users {
        BIGSERIAL id PK
        VARCHAR(255) email UK
        TIMESTAMP_WITH_TIME_ZONE created_at
    }
    orders {
        BIGSERIAL id PK
        BIGINT user_id FK
        NUMERIC(10_2) total
        INT coupon_id FK
    }
    order_items {
        BIGINT order_id PK, FK
        INT line_no PK
        TEXT sku
    }
    orders }o--|| users : "user_id"
    orders }o--o| coupons : "coupon_id"
    order_items }o--|| orders : "order_id"
`);
  });

  it('handles backticks, MySQL keys and ALTER TABLE foreign keys (registry example 2)', () => {
    expect(run(BLOG)).toBe(`erDiagram
    authors {
        INT_UNSIGNED id PK
        VARCHAR(100) name
    }
    posts {
        INT_UNSIGNED id PK
        INT_UNSIGNED author_id FK
        ENUM(draft_live) status
    }
    posts }o--o| authors : "author_id"
`);
  });

  it('handles brackets, schemas, GO and composite keys (registry example 3)', () => {
    expect(run(HR)).toBe(`erDiagram
    Departments {
        INT DeptId PK
        CHAR(2) Region PK
        NVARCHAR(100) Name
    }
    Employees {
        INT EmployeeId PK
        INT DeptId FK
        CHAR(2) Region FK
        VARCHAR(20) Badge_No
    }
    Employees }o--|| Departments : "DeptId, Region"
`);
  });

  it('marks a unique foreign key as one-to-one', () => {
    const out = run('CREATE TABLE a (id int primary key); CREATE TABLE b (a_id int not null unique references a(id));');
    expect(out).toContain('        int a_id FK, UK\n');
    expect(out).toContain('    b |o--|| a : "a_id"');
  });

  it('sanitises names that would break Mermaid syntax', () => {
    const out = run('CREATE TABLE "my table" ("first name" text, "2nd" int, "a""b {x} : y" text, "名前" text, "x-y" int, "x y" int);');
    expect(out).toBe(`erDiagram
    my_table {
        text first_name
        int _2nd
        text a_b_x_y
        text unnamed
        int x_y
        int x_y_2
    }
`);
    // every line is either the header, an entity open/close, or "type name [keys]"
    for (const line of out.trim().split('\n').slice(1)) {
      expect(line).toMatch(/^ {4}([A-Za-z_]\w* \{|\}| {4}[A-Za-z_][\w()[\]-]* [A-Za-z_]\w*( (PK|FK|UK)(, (PK|FK|UK))*)?)$/);
    }
  });

  it('prefixes the schema only when two schemas share a table name', () => {
    const out = run('CREATE TABLE a.users (id int primary key); CREATE TABLE b.users (id int primary key, a_id int references a.users(id));');
    expect(out).toContain('    a_users {');
    expect(out).toContain('    b_users {');
    expect(out).toContain('    b_users }o--o| a_users : "a_id"');
  });

  it('reads self-references and unknown target tables', () => {
    const out = run('CREATE TABLE node (id int primary key, parent_id int references node(id), owner int not null references "ext owner"(id));');
    expect(out).toContain('    node }o--o| node : "parent_id"');
    expect(out).toContain('    node }o--|| ext_owner : "owner"');
  });
});

describe('DdlToErdService: DBML', () => {
  it('converts registry example 1', () => {
    expect(run(SHOP, 'dbml')).toBe(`Table users {
  id BIGSERIAL [pk, increment]
  email VARCHAR(255) [unique, not null]
  created_at "TIMESTAMP WITH TIME ZONE"
}

Table orders {
  id BIGSERIAL [pk, increment]
  user_id BIGINT [not null]
  total NUMERIC(10,2) [not null]
  coupon_id INT
}

Table order_items {
  order_id BIGINT [not null]
  line_no INT [not null]
  sku TEXT [not null]

  indexes {
    (order_id, line_no) [pk]
  }
}

Ref: orders.user_id > users.id
Ref: order_items.order_id > orders.id
`);
    const r = svc.convert(SHOP, 'dbml');
    expect((r.metadata?.['warnings'] as string[]).join(' ')).toMatch(/coupon_id.*coupons.*omitted/);
  });

  it('converts registry example 2 with a composite unique index', () => {
    expect(run(BLOG, 'dbml')).toBe(`Table authors {
  id "INT UNSIGNED" [pk, increment]
  name VARCHAR(100) [not null]
}

Table posts {
  id "INT UNSIGNED" [pk, increment]
  author_id "INT UNSIGNED"
  status "ENUM('draft','live')" [not null]

  indexes {
    (author_id, status) [unique]
  }
}

Ref: posts.author_id > authors.id
`);
  });

  it('converts registry example 3 with schemas and composite references', () => {
    expect(run(HR, 'dbml')).toBe(`Table hr.Departments {
  DeptId INT [increment, not null]
  Region CHAR(2) [not null]
  Name NVARCHAR(100) [not null]

  indexes {
    (DeptId, Region) [pk]
  }
}

Table hr.Employees {
  EmployeeId INT [pk]
  DeptId INT [not null]
  Region CHAR(2) [not null]
  "Badge No" VARCHAR(20)
}

Ref: hr.Employees.(DeptId, Region) > hr.Departments.(DeptId, Region)
`);
  });

  it('falls back to the referenced primary key when REFERENCES names no column', () => {
    expect(run('CREATE TABLE a (id int primary key); CREATE TABLE b (a_id int references a);', 'dbml')).toContain('Ref: b.a_id > a.id');
  });

  it('quotes odd names without letting them close the quote', () => {
    const out = run('CREATE TABLE "we""ird" ("a b" text, "q""x" int);', 'dbml');
    expect(out).toContain(`Table "we'ird" {`);
    expect(out).toContain('  "a b" text');
    expect(out).toContain(`  "q'x" int`);
  });
});

describe('DdlToErdService: parser', () => {
  const tables = (sql: string) => svc.parse(sql).tables;

  it('ignores comments, strings and expressions that contain keywords, commas and parentheses', () => {
    const [t] = tables(`CREATE TABLE t ( -- PRIMARY KEY (nope)
      id int, /* , fake int REFERENCES x */
      note text DEFAULT 'a, b) REFERENCES y; CREATE TABLE z (q int)',
      n int CHECK (n IN (1, 2) AND note NOT LIKE 'PRIMARY KEY'),
      g int GENERATED ALWAYS AS (n * 2) STORED
    );`);
    expect(t.columns.map(c => c.name)).toEqual(['id', 'note', 'n', 'g']);
    expect(t.primaryKey).toEqual([]);
    expect(t.foreignKeys).toEqual([]);
    expect(tables(`CREATE TABLE t (id int); -- CREATE TABLE hidden (id int);`)).toHaveLength(1);
  });

  it('reads types with arguments, arrays and several words', () => {
    const [t] = tables(`CREATE TABLE t (a numeric(10, 2), b text[], c integer[3], d double precision NOT NULL, e character varying(20),
      f timestamp(3) without time zone, g "My Type", h varchar(10) COLLATE "C", i int DEFAULT 0);`);
    expect(t.columns.map(c => c.type)).toEqual([
      'numeric(10,2)', 'text[]', 'integer[3]', 'double precision', 'character varying(20)', 'timestamp(3) without time zone', 'My Type', 'varchar(10)', 'int',
    ]);
  });

  it('reads CREATE TABLE variants', () => {
    expect(tables('CREATE TEMPORARY TABLE IF NOT EXISTS public."T1" (id int);')[0]).toMatchObject({ schema: 'public', name: 'T1' });
    expect(tables('create unlogged table t2 (id int)')[0].name).toBe('t2');
    expect(tables('CREATE OR REPLACE TABLE db.sch.t3 (id int)')[0]).toMatchObject({ schema: 'sch', name: 't3' });
  });

  it('reads identity and auto-increment columns', () => {
    const [t] = tables('CREATE TABLE t (a int GENERATED BY DEFAULT AS IDENTITY, b INTEGER PRIMARY KEY AUTOINCREMENT, c serial, d int);');
    expect(t.columns.map(c => c.increment)).toEqual([true, true, true, false]);
  });

  it('applies ALTER TABLE primary keys, unique constraints, columns and unique indexes', () => {
    const [t] = tables(`CREATE TABLE ONLY_T (a int, b int);
      ALTER TABLE ONLY only_t ADD PRIMARY KEY (a), ADD COLUMN c int NOT NULL REFERENCES other(id);
      ALTER TABLE only_t ADD CONSTRAINT uq UNIQUE (b);
      CREATE UNIQUE INDEX ix ON only_t (c DESC);
      CREATE INDEX plain ON only_t (a);`);
    expect(t.primaryKey).toEqual(['a']);
    expect(t.columns.find(c => c.name === 'b')?.unique).toBe(true);
    expect(t.columns.find(c => c.name === 'c')).toMatchObject({ unique: true, fk: true, notNull: true });
  });

  it('skips statements it does not understand and reports ALTERs on unknown tables', () => {
    const r = svc.parse(`DROP TABLE x; INSERT INTO t VALUES (1, 'CREATE TABLE q (id int)'); CREATE VIEW v AS SELECT 1;
      CREATE TABLE copy AS SELECT * FROM t; ALTER TABLE missing ADD CONSTRAINT fk FOREIGN KEY (a) REFERENCES t(id); CREATE TABLE ok (id int);`);
    expect(r.tables.map(t => t.name)).toEqual(['ok']);
    expect(r.warnings).toHaveLength(2);
  });

  it('treats a column named like a keyword as a column when a type follows', () => {
    const [t] = tables('CREATE TABLE t (key varchar(10), "primary" int, index int, id int);');
    expect(t.columns.map(c => c.name)).toEqual(['key', 'primary', 'index', 'id']);
  });
});

describe('DdlToErdService: edge cases', () => {
  it('returns empty output for empty input', () => {
    expect(svc.convert('  \n\t')).toEqual({ success: true, output: '' });
  });

  it('reports input without any table', () => {
    expect(svc.convert('SELECT 1;').error).toMatch(/No CREATE TABLE/);
    expect(svc.convert('CREATE TABLE').error).toMatch(/No CREATE TABLE/);
  });

  it('survives malformed and unterminated input', () => {
    expect(run('CREATE TABLE t (id int, name text')).toContain('        text name');
    expect(run(`CREATE TABLE t (id int DEFAULT 'unterminated`)).toContain('        int id');
    expect(run('CREATE TABLE t (id int, , );')).toContain('        int id');
    expect(run('CREATE TABLE t (id int REFERENCES , FOREIGN KEY () REFERENCES );')).toContain('        int id');
    expect(run('CREATE TABLE t ();')).toBe('erDiagram\n    t {\n    }\n');
  });

  it('accepts CRLF line endings and a BOM', () => {
    const out = run('﻿CREATE TABLE t (\r\n  id int, -- c\r\n  name text\r\n);\r\n');
    expect(out).toBe('erDiagram\n    t {\n        int id\n        text name\n    }\n');
  });

  it('handles 2,000 tables', () => {
    const sql = Array.from({ length: 2000 }, (_, i) =>
      `CREATE TABLE t${i} (id int primary key, parent_id int${i ? ` references t${i - 1}(id)` : ''}, name varchar(50) not null);`).join('\n');
    const r = svc.convert(sql);
    expect(r.metadata).toMatchObject({ tables: 2000, relationships: 1999 });
  });
});
