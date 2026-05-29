import { renderHook, act } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { useHashGenerator } from './useHashGenerator'

describe('useHashGenerator', () => {
  it('initializes with empty hash', () => {
    const { result } = renderHook(() => useHashGenerator())
    expect(result.current.hash).toBe('')
  })

  it('computes sha256 hash', () => {
    const { result } = renderHook(() => useHashGenerator())
    act(() => {
      result.current.compute('hello', 'sha256')
    })
    expect(result.current.hash).toBe(
      '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824'
    )
  })

  it('computes md5 hash', () => {
    const { result } = renderHook(() => useHashGenerator())
    act(() => {
      result.current.compute('hello', 'md5')
    })
    expect(result.current.hash).toBe('5d41402abc4b2a76b9719d911017c592')
  })

  it('returns empty string for empty input', () => {
    const { result } = renderHook(() => useHashGenerator())
    act(() => {
      result.current.compute('')
    })
    expect(result.current.hash).toBe('')
  })
})
