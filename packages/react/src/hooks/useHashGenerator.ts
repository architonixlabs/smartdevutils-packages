import { useState } from 'react'
import { md5, sha1, sha256, sha512 } from '@smartdevutils/core/hashing'
import { sha384 } from '@smartdevutils/core/security'

export type HashAlgorithm = 'md5' | 'sha1' | 'sha256' | 'sha384' | 'sha512'

export interface UseHashGeneratorReturn {
  hash: string
  algorithm: HashAlgorithm
  setAlgorithm: (algo: HashAlgorithm) => void
  compute: (input: string, algo?: HashAlgorithm) => string
}

export function useHashGenerator(): UseHashGeneratorReturn {
  const [hash, setHash] = useState('')
  const [algorithm, setAlgorithm] = useState<HashAlgorithm>('sha256')

  const compute = (input: string, algo: HashAlgorithm = algorithm): string => {
    if (!input) { setHash(''); return '' }
    let result: string
    switch (algo) {
      case 'md5':    result = md5(input); break
      case 'sha1':   result = sha1(input); break
      case 'sha256': result = sha256(input); break
      case 'sha384': result = sha384(input); break
      case 'sha512': result = sha512(input); break
      default:       result = sha256(input)
    }
    setHash(result)
    return result
  }

  return { hash, algorithm, setAlgorithm, compute }
}
