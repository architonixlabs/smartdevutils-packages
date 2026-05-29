import { useState } from 'react'
import { md5, sha1, sha256, sha512 } from '@smartdevutils/core/hashing'
import { sha384 } from '@smartdevutils/core/security'

export type HashAlgorithm = 'md5' | 'sha1' | 'sha256' | 'sha384' | 'sha512'

export interface UseHashGeneratorReturn {
  hash: string
  algorithm: HashAlgorithm
  setAlgorithm: (algo: HashAlgorithm) => void
  compute: (input: string, algo?: HashAlgorithm) => void
}

export function useHashGenerator(): UseHashGeneratorReturn {
  const [hash, setHash] = useState('')
  const [algorithm, setAlgorithm] = useState<HashAlgorithm>('sha256')

  const compute = (input: string, algo: HashAlgorithm = algorithm) => {
    if (!input) { setHash(''); return }
    switch (algo) {
      case 'md5':    setHash(md5(input)); break
      case 'sha1':   setHash(sha1(input)); break
      case 'sha256': setHash(sha256(input)); break
      case 'sha384': setHash(sha384(input)); break
      case 'sha512': setHash(sha512(input)); break
      default:       setHash(sha256(input))
    }
  }

  return { hash, algorithm, setAlgorithm, compute }
}
