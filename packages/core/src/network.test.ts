import { describe, it, expect } from 'vitest'
import { parseIpAddress, isPrivateIp, ipToInt, intToIp, parseHttpHeaders, classifyHttpStatus } from './network'

describe('parseIpAddress', () => {
  it('parses valid IPv4', () => {
    expect(parseIpAddress('192.168.1.1')).toEqual({ version: 4, octets: [192, 168, 1, 1], valid: true })
  })
  it('marks invalid ip', () => {
    expect(parseIpAddress('999.0.0.1').valid).toBe(false)
  })
  it('parses IPv6', () => {
    expect(parseIpAddress('::1').version).toBe(6)
  })
})

describe('isPrivateIp', () => {
  it('192.168.x.x is private', () => { expect(isPrivateIp('192.168.0.1')).toBe(true) })
  it('10.x.x.x is private', () => { expect(isPrivateIp('10.0.0.1')).toBe(true) })
  it('172.16.x.x is private', () => { expect(isPrivateIp('172.16.0.1')).toBe(true) })
  it('8.8.8.8 is public', () => { expect(isPrivateIp('8.8.8.8')).toBe(false) })
})

describe('ipToInt / intToIp', () => {
  it('round-trips correctly', () => {
    expect(intToIp(ipToInt('192.168.1.1'))).toBe('192.168.1.1')
  })
  it('converts 0.0.0.0 to 0', () => {
    expect(ipToInt('0.0.0.0')).toBe(0)
  })
})

describe('parseHttpHeaders', () => {
  it('parses raw header string', () => {
    const raw = 'Content-Type: application/json\r\nX-Custom: value'
    expect(parseHttpHeaders(raw)).toEqual({
      'content-type': 'application/json',
      'x-custom': 'value',
    })
  })
})

describe('classifyHttpStatus', () => {
  it('classifies 200 as Success', () => { expect(classifyHttpStatus(200).category).toBe('Success') })
  it('classifies 404 as Client Error', () => { expect(classifyHttpStatus(404).category).toBe('Client Error') })
  it('classifies 500 as Server Error', () => { expect(classifyHttpStatus(500).category).toBe('Server Error') })
  it('classifies 301 as Redirection', () => { expect(classifyHttpStatus(301).category).toBe('Redirection') })
})
