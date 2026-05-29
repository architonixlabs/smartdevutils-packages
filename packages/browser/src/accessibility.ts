import axe from 'axe-core'
import DOMPurify from 'dompurify'

export type WcagViolation = { rule: string; element: string; description: string; level: 'A' | 'AA' | 'AAA' }
export type AccessibilityResult = { score: number; violations: WcagViolation[]; warnings: string[] }

export async function checkHtmlAccessibility(html: string): Promise<AccessibilityResult> {
  const container = document.createElement('div')
  container.innerHTML = DOMPurify.sanitize(html)
  document.body.appendChild(container)
  try {
    const results = await axe.run(container)
    const violations: WcagViolation[] = results.violations.map(v => ({
      rule: v.id,
      element: v.nodes[0]?.html ?? '',
      description: v.description,
      level: (v.tags.includes('wcag2aaa') ? 'AAA' : v.tags.includes('wcag2aa') ? 'AA' : 'A') as 'A' | 'AA' | 'AAA',
    }))
    return { score: Math.max(0, 100 - violations.length * 10), violations, warnings: [] }
  } finally {
    document.body.removeChild(container)
  }
}

export async function getWcagViolations(html: string): Promise<WcagViolation[]> {
  return (await checkHtmlAccessibility(html)).violations
}
