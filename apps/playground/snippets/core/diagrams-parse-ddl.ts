/* ---
title: Read tables and foreign keys from DDL
entry: diagrams/parseDdl, diagrams/resolveForeignKey
node: true
--- */
import { parseDdl, resolveForeignKey } from '@smartdevutils/core/diagrams'

const { tables } = parseDdl(`
  CREATE TABLE customers (id INT PRIMARY KEY, email VARCHAR(200) NOT NULL);
  CREATE TABLE orders (
    id INT PRIMARY KEY,
    customer_id INT NOT NULL REFERENCES customers(id),
    total DECIMAL(10,2)
  );`)

for (const table of tables) {
  console.log(`${table.name}: ${table.columns.map((c) => `${c.name}${c.pk ? ' (pk)' : ''}${c.fk ? ' (fk)' : ''}`).join(', ')}`)
  for (const fk of table.foreignKeys) {
    const target = resolveForeignKey(tables, fk, table)
    console.log(`  ${fk.columns.join(', ')} -> ${target?.name ?? 'missing table'}(${fk.refColumns.join(', ')})`)
  }
}
