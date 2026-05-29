import { faker } from '@faker-js/faker'

export function jsonToCsv(json: object[]): string {
  if (!json.length) throw new Error('Input array is empty')
  const keys = Object.keys(json[0])
  const escape = (v: unknown) => {
    const s = String(v ?? '')
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"`
      : s
  }
  const header = keys.join(',')
  const rows = json.map(row => keys.map(k => escape((row as Record<string, unknown>)[k])).join(','))
  return [header, ...rows].join('\n')
}

export function csvToJson(csv: string): object[] {
  const lines = csv.split('\n').filter(l => l.trim())
  if (lines.length < 2) return []
  const headers = parseCSVLine(lines[0])
  return lines.slice(1).map(line => {
    const values = parseCSVLine(line)
    return Object.fromEntries(headers.map((h, i) => [h, values[i] ?? '']))
  })
}

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = '', inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++ }
      else inQuotes = !inQuotes
    } else if (ch === ',' && !inQuotes) {
      result.push(current); current = ''
    } else {
      current += ch
    }
  }
  result.push(current)
  return result
}

export type FakeFieldType =
  | 'fullName' | 'firstName' | 'lastName' | 'email' | 'phone'
  | 'uuid' | 'date' | 'url' | 'company' | 'number' | 'boolean'
  | 'address' | 'city' | 'country' | 'zipCode' | 'ipv4'

export type FakeSchema = Record<string, FakeFieldType>

function generateField(type: FakeFieldType): unknown {
  switch (type) {
    case 'fullName':   return faker.person.fullName()
    case 'firstName':  return faker.person.firstName()
    case 'lastName':   return faker.person.lastName()
    case 'email':      return faker.internet.email()
    case 'phone':      return faker.phone.number()
    case 'uuid':       return faker.string.uuid()
    case 'date':       return faker.date.past().toISOString()
    case 'url':        return faker.internet.url()
    case 'company':    return faker.company.name()
    case 'number':     return faker.number.int({ min: 1, max: 10000 })
    case 'boolean':    return faker.datatype.boolean()
    case 'address':    return faker.location.streetAddress()
    case 'city':       return faker.location.city()
    case 'country':    return faker.location.country()
    case 'zipCode':    return faker.location.zipCode()
    case 'ipv4':       return faker.internet.ip()
    default:           return ''
  }
}

export function generateFakeRecord(schema: FakeSchema): object {
  return Object.fromEntries(
    Object.entries(schema).map(([key, type]) => [key, generateField(type)])
  )
}

export function generateFakeDataset(schema: FakeSchema, count: number): object[] {
  return Array.from({ length: count }, () => generateFakeRecord(schema))
}
