import { describe, it, expect } from 'vitest'
import { runner } from './log-parser'

const JSON_LOG = `{"timestamp":"2024-10-10T13:55:36Z","level":"INFO","source":"api-gateway","message":"Request received"}
{"timestamp":"2024-10-10T13:55:37Z","level":"WARN","source":"auth-service","message":"Token expiring soon"}
{"timestamp":"2024-10-10T13:55:38Z","level":"ERROR","source":"db-pool","message":"Connection timeout after 30s"}
{"timestamp":"2024-10-10T13:55:39Z","level":"DEBUG","source":"cache","message":"Cache miss for key user:42"}`

const APACHE = `192.0.2.10 - frank [10/Oct/2024:13:55:36 -0700] "GET /index.html HTTP/1.1" 200 2326
192.0.2.11 - - [10/Oct/2024:13:55:37 -0700] "POST /api/login HTTP/1.1" 401 512
192.0.2.12 - - [10/Oct/2024:13:55:39 -0700] "GET /boom HTTP/1.1" 503 128`

type R = { output: string; error?: string; meta: Record<string, unknown> }

describe('log-parser runner', () => {
  it('returns nothing for empty input', () => {
    expect(runner.run('   \n')).toEqual({ output: '' })
  })

  it('parses JSON lines into a table with all entries', () => {
    const r = runner.run(JSON_LOG) as R
    const lines = r.output.split('\n')
    expect(lines[0]).toBe('Timestamp\tLevel\tSource\tMessage')
    expect(lines[1]).toBe('2024-10-10T13:55:36Z\tINFO\tapi-gateway\tRequest received')
    expect(lines[lines.length - 1]).toBe('Showing 4 of 4 entries')
    expect(r.meta.total).toBe(4)
  })

  it('filters by level (levelFilter)', () => {
    const r = runner.run(JSON_LOG, { options: { levelFilter: 'ERROR' } }) as R
    expect(r.output).toContain('Showing 1 of 4 entries')
    expect(r.output).toContain('db-pool\tConnection timeout after 30s')
  })

  it('reads Apache access logs like the website (status decides the level)', () => {
    const lines = (runner.run(APACHE) as R).output.split('\n')
    expect(lines[1]).toBe('10/Oct/2024:13:55:36 -0700\tINFO\t192.0.2.10\tGET /index.html HTTP/1.1 → 200')
    expect(lines[2]).toContain('\tWARN\t')
    expect(lines[3]).toContain('\tERROR\t')
  })

  it('takes the level from a keyword in syslog lines and treats CRLF as newlines', () => {
    const r = runner.run(
      'Oct 10 13:55:37 web-01 app[5678]: ERROR Failed to connect\r\nOct 10 13:55:38 web-01 systemd[1]: WARNING Memory at 85%',
      { options: { levelFilter: 'WARN' } },
    ) as R
    expect(r.output).toContain('Oct 10 13:55:38\tWARN\tsystemd[1]\tWARNING Memory at 85%')
    expect(r.output).toContain('Showing 1 of 2 entries')
  })

  it('falls back to ALL for an unknown level', () => {
    expect((runner.run(JSON_LOG, { options: { levelFilter: 'NOPE' } }) as R).output).toContain('Showing 4 of 4 entries')
  })
})
