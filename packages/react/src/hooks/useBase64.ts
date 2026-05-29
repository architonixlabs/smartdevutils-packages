import { useState } from 'react'
import { base64Encode, base64Decode } from '@smartdevutils/core/encoding'

export interface UseBase64Return {
  encoded: string
  decoded: string
  encode: (input: string) => void
  decode: (input: string) => void
  error: string
}

export function useBase64(): UseBase64Return {
  const [encoded, setEncoded] = useState('')
  const [decoded, setDecoded] = useState('')
  const [error, setError] = useState('')

  const encode = (input: string) => {
    setError('')
    try { setEncoded(base64Encode(input)) } catch { setError('Encoding failed') }
  }

  const decode = (input: string) => {
    setError('')
    try { setDecoded(base64Decode(input)) } catch { setError('Invalid Base64') }
  }

  return { encoded, decoded, encode, decode, error }
}
