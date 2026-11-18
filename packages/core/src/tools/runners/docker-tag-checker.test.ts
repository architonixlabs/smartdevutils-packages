import { describe, expect, it } from 'vitest'
import { analyseDockerImages, runner } from './docker-tag-checker'

const run = (input: string) =>
  runner.run(input) as { output: string; error?: string; meta?: { results: { image: string; status: string }[]; unpinned: number } }

describe('docker-tag-checker runner', () => {
  it('classifies pinned, versioned and unpinned images', () => {
    const text = [
      'FROM node:latest',
      'FROM nginx:1.25',
      'image: postgres:16@sha256:abc123',
    ].join('\n')
    const r = run(text)
    expect(r.meta!.results.map((x) => x.status)).toEqual(['unpinned', 'versioned', 'pinned'])
    expect(r.meta!.unpinned).toBe(1)
    expect(r.output.split('\n')[0]).toBe('3 images: 1 pinned, 1 versioned, 1 unpinned')
    expect(r.output).toContain('[unpinned] node:latest\n  Pin the image: node:VERSION@sha256:DIGEST')
  })

  it('skips build stages, scratch and --platform flags (website fixes)', () => {
    const text = [
      'FROM --platform=linux/amd64 golang:1.22 AS builder',
      'FROM builder',
      'FROM scratch',
    ].join('\r\n')
    expect(analyseDockerImages(text).map((r) => r.image)).toEqual(['golang:1.22'])
  })

  it('treats a registry port without a tag as unpinned and quoted compose values as images', () => {
    const res = analyseDockerImages('  image: "localhost:5000/app"\n  - image: \'redis:7\'')
    expect(res.map((r) => [r.image, r.status])).toEqual([
      ['localhost:5000/app', 'unpinned'],
      ['redis:7', 'versioned'],
    ])
  })

  it('flags build-variable images as versioned', () => {
    expect(analyseDockerImages('FROM ${BASE_IMAGE}')[0].status).toBe('versioned')
  })

  it('says when nothing was found, and gives empty output for blank input', () => {
    expect(run('RUN echo hi').output).toBe('No FROM or image: lines found.')
    expect(run('  ')).toEqual({ output: '' })
  })
})
