/* ---
title: Browse the catalog of every website tool
entry: tools-catalog/TOOL_CATALOG, tools-catalog/findToolBySlug, tools-catalog/findToolById
node: true
--- */
import { TOOL_CATALOG, findToolById } from '@smartdevutils/core/tools/catalog'
import { hasRunner } from '@smartdevutils/core/tools'

const byCategory = new Map<string, number>()
for (const t of TOOL_CATALOG) byCategory.set(t.category, (byCategory.get(t.category) ?? 0) + 1)
console.log(`${TOOL_CATALOG.length} tools in ${byCategory.size} categories`)
console.log(Object.fromEntries(byCategory))

const regex = findToolById('regex-tester')
console.log(regex?.name, '-', regex?.description)
console.log(`https://smartdevutils.com/tools/${regex?.slug}`, '| runs headless:', hasRunner('regex-tester'))
