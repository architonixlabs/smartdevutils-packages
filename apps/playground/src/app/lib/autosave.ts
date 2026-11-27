// Per-entry, per-snippet autosave in this browser only. Storage can be missing or throw (private mode,
// blocked site data, quota), so every access is guarded and failures are silent.

export const AUTOSAVE_PREFIX = 'sdu-playground:v1:code:'
/** Edits longer than this are not autosaved (localStorage quota is ~5 MB per origin). */
export const MAX_AUTOSAVE_CODE = 200_000

export interface AutosaveRecord {
  code: string
  savedAt: number
  /** Hash of the original snippet the edit started from, to tell when the example changed since. */
  base: string
}

export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

export function autosaveKey(pkg: string, section: string, entry: string, snippetId: string): string {
  return `${AUTOSAVE_PREFIX}${[pkg, section, entry, snippetId].map(encodeURIComponent).join('/')}`
}

/** Small, fast, non-cryptographic string hash (FNV-1a, hex). */
export function hashCode(s: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16).padStart(8, '0')
}

export function safeStorage(): StorageLike | null {
  try {
    const s = globalThis.localStorage
    return s ?? null
  } catch {
    return null
  }
}

export function loadAutosave(storage: StorageLike | null, key: string): AutosaveRecord | null {
  if (!storage) return null
  try {
    const raw = storage.getItem(key)
    if (!raw) return null
    const v = JSON.parse(raw) as unknown
    if (!v || typeof v !== 'object') return null
    const r = v as Record<string, unknown>
    if (typeof r['code'] !== 'string' || r['code'].length > MAX_AUTOSAVE_CODE) return null
    return {
      code: r['code'],
      savedAt: typeof r['savedAt'] === 'number' ? r['savedAt'] : 0,
      base: typeof r['base'] === 'string' ? r['base'] : '',
    }
  } catch {
    return null
  }
}

/** Saves `code`; removes the record when the code equals the original snippet. Returns false on failure. */
export function saveAutosave(
  storage: StorageLike | null,
  key: string,
  code: string,
  original: string,
  now = Date.now(),
): boolean {
  if (!storage) return false
  try {
    if (code === original) {
      storage.removeItem(key)
      return true
    }
    if (code.length > MAX_AUTOSAVE_CODE) return false
    const rec: AutosaveRecord = { code, savedAt: now, base: hashCode(original) }
    storage.setItem(key, JSON.stringify(rec))
    return true
  } catch {
    return false
  }
}

export function clearAutosave(storage: StorageLike | null, key: string): void {
  try {
    storage?.removeItem(key)
  } catch {
    /* storage unavailable */
  }
}
