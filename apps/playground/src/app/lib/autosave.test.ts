import { describe, expect, it } from 'vitest'
import {
  AUTOSAVE_PREFIX,
  MAX_AUTOSAVE_CODE,
  autosaveKey,
  clearAutosave,
  hashCode,
  loadAutosave,
  saveAutosave,
  type StorageLike,
} from './autosave'

function memoryStorage(): StorageLike & { map: Map<string, string> } {
  const map = new Map<string, string>()
  return {
    map,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  }
}

const throwing: StorageLike = {
  getItem: () => {
    throw new Error('blocked')
  },
  setItem: () => {
    throw new Error('quota')
  },
  removeItem: () => {
    throw new Error('blocked')
  },
}

describe('autosave', () => {
  it('builds stable, distinct keys', () => {
    const a = autosaveKey('core', 'hashing', 'sha256', 'basic')
    expect(a).toBe(`${AUTOSAVE_PREFIX}core/hashing/sha256/basic`)
    expect(autosaveKey('core', 'hashing', 'sha256', 'other')).not.toBe(a)
    expect(autosaveKey('a/b', 'c', 'd', 'e')).not.toBe(autosaveKey('a', 'b/c', 'd', 'e'))
  })

  it('saves, loads and clears', () => {
    const s = memoryStorage()
    const key = autosaveKey('core', 'hashing', 'sha256', 'basic')
    expect(saveAutosave(s, key, 'edited', 'original', 123)).toBe(true)
    expect(loadAutosave(s, key)).toEqual({ code: 'edited', savedAt: 123, base: hashCode('original') })
    clearAutosave(s, key)
    expect(loadAutosave(s, key)).toBeNull()
  })

  it('removes the record when the code is back to the original', () => {
    const s = memoryStorage()
    saveAutosave(s, 'k', 'edited', 'original')
    saveAutosave(s, 'k', 'original', 'original')
    expect(s.map.size).toBe(0)
  })

  it('ignores corrupt records and refuses huge edits', () => {
    const s = memoryStorage()
    s.setItem('bad', '{oops')
    s.setItem('wrong', JSON.stringify({ code: 5 }))
    expect(loadAutosave(s, 'bad')).toBeNull()
    expect(loadAutosave(s, 'wrong')).toBeNull()
    expect(saveAutosave(s, 'big', 'x'.repeat(MAX_AUTOSAVE_CODE + 1), '')).toBe(false)
  })

  it('never throws when storage is missing or blocked', () => {
    expect(loadAutosave(null, 'k')).toBeNull()
    expect(saveAutosave(null, 'k', 'a', 'b')).toBe(false)
    expect(loadAutosave(throwing, 'k')).toBeNull()
    expect(saveAutosave(throwing, 'k', 'a', 'b')).toBe(false)
    expect(() => clearAutosave(throwing, 'k')).not.toThrow()
  })

  it('hashes deterministically', () => {
    expect(hashCode('abc')).toBe(hashCode('abc'))
    expect(hashCode('abc')).not.toBe(hashCode('abd'))
    expect(hashCode('')).toMatch(/^[0-9a-f]{8}$/)
  })
})
