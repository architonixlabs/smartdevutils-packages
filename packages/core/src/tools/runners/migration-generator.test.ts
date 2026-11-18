import { describe, it, expect } from 'vitest'
import { generateMigrationSql } from '../../database'
import { runner } from './migration-generator'

// The website's "Add Columns (PostgreSQL)" and "Drop Column (MySQL)" examples.
const PG_BEFORE = 'CREATE TABLE users (\n  id SERIAL PRIMARY KEY,\n  username VARCHAR(100)\n);'
const PG_AFTER =
  'CREATE TABLE users (\n  id SERIAL PRIMARY KEY,\n  username VARCHAR(100),\n  email TEXT,\n  created_at TIMESTAMP DEFAULT NOW()\n);'
const MY_BEFORE =
  'CREATE TABLE products (\n  id INT AUTO_INCREMENT PRIMARY KEY,\n  name VARCHAR(200),\n  sku VARCHAR(50),\n  price DECIMAL(10,2)\n);'
const MY_AFTER = 'CREATE TABLE products (\n  id INT AUTO_INCREMENT PRIMARY KEY,\n  name VARCHAR(200),\n  price DECIMAL(10,2)\n);'

describe('migration-generator runner', () => {
  it('outputs the UP script by default and keeps both in meta', () => {
    const expected = generateMigrationSql(PG_BEFORE, PG_AFTER, 'postgres')
    const r = runner.run(PG_BEFORE, { options: { after: PG_AFTER } }) as { output: string; meta?: Record<string, unknown> }
    expect(r.output).toBe(expected.up)
    expect(r.meta?.down).toBe(expected.down)
    expect(r.output).toContain('email')
  })

  it('uses the dialect option and the part option', () => {
    const expected = generateMigrationSql(MY_BEFORE, MY_AFTER, 'mysql')
    const down = runner.run(MY_BEFORE, { options: { after: MY_AFTER, dialect: 'mysql', part: 'down' } }) as { output: string }
    expect(down.output).toBe(expected.down)
    const both = runner.run(MY_BEFORE, { options: { after: MY_AFTER, dialect: 'mysql', part: 'both' } }) as { output: string }
    expect(both.output).toBe(`-- UP\n${expected.up}\n\n-- DOWN\n${expected.down}`)
  })

  it('shows "-- No schema changes" when nothing changed', () => {
    const r = runner.run(PG_BEFORE, { options: { after: PG_BEFORE } }) as { output: string }
    expect(r.output).toBe(generateMigrationSql(PG_BEFORE, PG_BEFORE, 'postgres').up || '-- No schema changes')
    expect(r.output).toContain('No schema changes')
  })

  it('gives the website error when both sides are empty', () => {
    expect(runner.run('')).toEqual({
      output: '',
      error: 'Paste a CREATE TABLE statement in "Before" and/or "After".',
    })
  })

  it('turns the core error for input with no CREATE TABLE into `error`', () => {
    const r = runner.run('SELECT 1;', { options: { after: 'SELECT 2;' } }) as { output: string; error?: string }
    expect(r.output).toBe('')
    expect(r.error).toBeTruthy()
  })
})
