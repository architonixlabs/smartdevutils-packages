/* ---
title: IDs, passwords and passphrases
entry: generation/generatePassword, generation/generatePassphrase, generation/generateUuid
description: Passwords and passphrases come from a cryptographic random source.
node: true
--- */
import { generateUuid, generatePassword, generatePassphrase, generateTimestamp } from '@smartdevutils/core/generation'

console.log('request id :', generateUuid())
console.log('password   :', generatePassword(24))
console.log('passphrase :', generatePassphrase(5))
console.log('created at :', generateTimestamp())
