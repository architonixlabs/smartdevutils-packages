/* ---
title: CREATE TABLE for PostgreSQL and MySQL
entry: database/generateCreateTable
node: true
--- */
import { generateCreateTable, type TableSchema } from '@smartdevutils/core/database'

const schema: TableSchema = {
  tableName: 'order_items',
  columns: [
    { name: 'id', type: 'BIGINT', primaryKey: true, autoIncrement: true },
    { name: 'order_id', type: 'BIGINT', nullable: false },
    { name: 'sku', type: 'VARCHAR(40)', nullable: false },
    { name: 'quantity', type: 'INT', nullable: false, defaultValue: '1' },
    { name: 'unit_price', type: 'DECIMAL(10,2)', nullable: false },
  ],
}

console.log(generateCreateTable(schema, 'postgres'))
console.log(generateCreateTable(schema, 'mysql'))
