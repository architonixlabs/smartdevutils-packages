// Copied from the website's core/services/chain.service.ts (the pure part, no Angular).
import type { ToolType } from '@smartdevutils/core/tools'

/** Tool types whose result is text another tool can take as input. */
const PIPE_SOURCES: ReadonlySet<ToolType> = new Set(['bidirectional', 'single', 'generator', 'formatter'])
/** Tool types that read one pasted text input, which is where a piped value lands. */
const PIPE_TARGETS: ReadonlySet<ToolType> = new Set(['bidirectional', 'single', 'analyzer', 'formatter'])

/** Whether output from a tool of type `from` makes sense as input to a tool of type `to` ("Send to" pipe). */
export function canPipe(from: { toolType?: ToolType }, to: { toolType?: ToolType }): boolean {
  return !!from.toolType && !!to.toolType && PIPE_SOURCES.has(from.toolType) && PIPE_TARGETS.has(to.toolType)
}

/** How many curated targets the "Send to" menu lists under "Suggested next". */
export const SUGGESTED_NEXT_MAX = 4

/** A tool's curated relatedToolIds that exist, minus itself, capped at SUGGESTED_NEXT_MAX. */
export function suggestedNextTools<T extends { id: string }>(
  self: { id: string; relatedToolIds?: readonly string[] } | undefined,
  all: readonly T[],
): T[] {
  return (self?.relatedToolIds ?? [])
    .map((id) => all.find((t) => t.id === id))
    .filter((t): t is T => !!t && t.id !== self!.id)
    .slice(0, SUGGESTED_NEXT_MAX)
}
