/* ---
title: Checksums of the same text
entry: hashing/sha256, hashing/sha512, hashing/md5, hashing/sha1
description: Every hash is lower-case hex of the UTF-8 bytes, so it matches sha256sum and friends.
node: true
--- */
import { md5, sha1, sha256, sha512 } from '@smartdevutils/core/hashing'

const text = 'The quick brown fox jumps over the lazy dog'

console.log('md5   ', md5(text))
console.log('sha1  ', sha1(text))
console.log('sha256', sha256(text))
console.log('sha512', sha512(text).slice(0, 64) + '…')

// Compare against a published checksum:
const published = 'd7a8fbb307d7809469ca9abcb0082e4f8d5651e46d3cdb762d02d0bf37c9e592'
console.log('sha256 matches:', sha256(text) === published)
