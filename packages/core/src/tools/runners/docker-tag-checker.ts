// Mirrors the website's DockerTagCheckerComponent.analyse(). The website shows a table and has no output
// panel, so `output` here is a plain-text version of that table and `meta.results` holds the rows.
import { detectUnpinnedDockerImages, type DockerImageResult } from '../../devops-tools'
import { defineRunner } from '../define'
import { spec } from '../specs/docker-tag-checker'

/**
 * Wraps the core detector, fixing cases it misreads (same rules as the website):
 * - `FROM --platform=linux/amd64 node:20` (the flag was reported as the image)
 * - `FROM builder` referencing an earlier `AS builder` stage (reported as unpinned)
 * - registry ports: `localhost:5000/app` has no tag but was reported as versioned
 * - quoted compose values `image: "nginx:1.25"` and CRLF input
 */
export function analyseDockerImages(text: string): DockerImageResult[] {
  const stages = new Set<string>()
  const results: DockerImageResult[] = []
  for (const line of text.split(/\r\n|\r|\n/)) {
    const from = /^\s*FROM\s+((?:--\S+\s+)*)(\S+)(?:\s+AS\s+(\S+))?/i.exec(line)
    const compose = /^\s*(?:-\s*)?image:\s*["']?([^\s"'#]+)/i.exec(line)
    const image = from?.[2] ?? compose?.[1]
    const isStageRef = !!from && !!image && stages.has(image.toLowerCase())
    if (from?.[3]) stages.add(from[3].toLowerCase())
    if (!image || image.toLowerCase() === 'scratch' || isStageRef) continue
    if (image.includes('$')) {
      results.push({
        image,
        status: 'versioned',
        suggestion: 'Image comes from a build variable — check that its default is pinned.',
      })
      continue
    }
    const [core] = detectUnpinnedDockerImages(`FROM ${image}`)
    const lastSegment = image.split('@')[0].split('/').pop() ?? ''
    const tag = lastSegment.includes(':') ? lastSegment.split(':').pop() : ''
    if (!image.includes('@sha256:') && (!tag || tag === 'latest')) {
      results.push({
        image,
        status: 'unpinned',
        suggestion: `Pin the image: ${image.replace(/:latest$/, '')}:VERSION@sha256:DIGEST`,
      })
    } else {
      results.push(
        core ?? {
          image,
          status: 'versioned',
          suggestion: 'Consider pinning with a SHA digest for full reproducibility.',
        },
      )
    }
  }
  return results
}

export function dockerReport(results: DockerImageResult[]): string {
  if (!results.length) return 'No FROM or image: lines found.'
  const count = (s: DockerImageResult['status']) => results.filter((r) => r.status === s).length
  const head = `${results.length} image${results.length === 1 ? '' : 's'}: ${count('pinned')} pinned, ${count('versioned')} versioned, ${count('unpinned')} unpinned`
  return [head, '', ...results.map((r) => `[${r.status}] ${r.image}\n  ${r.suggestion}`)].join('\n')
}

export const runner = defineRunner(spec, (input) => {
  if (!input.trim()) return { output: '' }
  const results = analyseDockerImages(input)
  return {
    output: dockerReport(results),
    meta: { results, unpinned: results.filter((r) => r.status === 'unpinned').length },
  }
})

export default runner
