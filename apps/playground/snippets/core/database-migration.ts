/* ---
title: Diff two schemas and generate the migration
entry: database/diffDdlStatements, database/generateMigrationSql
node: true
--- */
import { diffDdlStatements, generateMigrationSql } from '@smartdevutils/core/database'

const before = `CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(100),
  legacy_flag BOOLEAN
);`
const after = `CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(255) NOT NULL,
  email TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);`

const diff = diffDdlStatements(before, after)
console.log('added  :', diff.added.map((c) => c.name))
console.log('removed:', diff.removed.map((c) => c.name))
console.log('changed:', diff.changed.map((c) => `${c.name}: ${c.before} -> ${c.after}`))

const migration = generateMigrationSql(before, after, 'postgres')
console.log('-- up\n' + migration.up)
console.log('-- down\n' + migration.down)
if (migration.warnings?.length) console.log('warnings:', migration.warnings)
