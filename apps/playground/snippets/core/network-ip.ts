/* ---
title: Classify IP addresses and HTTP status codes
entry: network/isPrivateIp, network/parseIpAddress, network/classifyHttpStatus
node: true
--- */
import { parseIpAddress, isPrivateIp, ipToInt, intToIp, classifyHttpStatus } from '@smartdevutils/core/network'

for (const ip of ['10.20.30.40', '192.168.1.20', '8.8.8.8', '300.1.1.1']) {
  const parsed = parseIpAddress(ip)
  console.log(ip.padEnd(13), parsed.valid ? (isPrivateIp(ip) ? 'private' : 'public') : 'invalid')
}

const n = ipToInt('192.168.1.20')
console.log(n, intToIp(n + 1))

for (const code of [200, 301, 404, 503]) console.log(code, classifyHttpStatus(code).category)
