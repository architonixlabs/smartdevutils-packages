import { describe, it, expect } from 'vitest'
import { jsonToCsv, csvToJson, generateFakeRecord, generateFakeDataset } from './data'

describe('jsonToCsv', () => {
  it('produces header row from object keys', () => {
    const csv = jsonToCsv([{ name: 'Alice', age: 30 }])
    expect(csv.split('\n')[0]).toBe('name,age')
  })
  it('produces data row', () => {
    const csv = jsonToCsv([{ name: 'Alice', age: 30 }])
    expect(csv.split('\n')[1]).toBe('Alice,30')
  })
  it('wraps values with commas in quotes', () => {
    const csv = jsonToCsv([{ name: 'Alice, Jr.' }])
    expect(csv).toContain('"Alice, Jr."')
  })
  it('throws on empty array', () => {
    expect(() => jsonToCsv([])).toThrow()
  })
})

describe('csvToJson', () => {
  it('parses header + one row', () => {
    expect(csvToJson('name,age\nAlice,30')).toEqual([{ name: 'Alice', age: '30' }])
  })
  it('handles quoted values', () => {
    expect(csvToJson('name\n"Alice, Jr."')).toEqual([{ name: 'Alice, Jr.' }])
  })
})

describe('generateFakeRecord', () => {
  it('generates a record with requested fields', () => {
    const record = generateFakeRecord({ name: 'fullName', email: 'email' })
    expect(typeof record['name']).toBe('string')
    expect((record['email'] as string)).toContain('@')
  })
})

describe('generateFakeDataset', () => {
  it('generates the requested number of records', () => {
    const data = generateFakeDataset({ id: 'uuid' }, 5)
    expect(data).toHaveLength(5)
  })
})
