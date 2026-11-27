/* ---
title: Sort versions and read file permissions
entry: developer/compareSemver, developer/parseSemver, developer/chmodToString
node: true
--- */
import { compareSemver, parseSemver, chmodToString, stringToChmod, formatBytes } from '@smartdevutils/core/developer'

const versions = ['1.10.0', '1.9.3', '2.0.0', '1.10.1', '0.9.12']
console.log([...versions].sort(compareSemver))
console.log(parseSemver('2.4.1-beta.3'))

console.log('755 =', chmodToString('755'), '| rw-r----- =', stringToChmod('rw-r-----'))
console.log(formatBytes(1536000, 1))
