/* ---
title: Use a report tool's findings as data
entry: tools/slow-query-detector
description: Analyzer tools return a readable report in output and the same findings in meta, ready for CI checks.
node: true
--- */
import { runTool } from '@smartdevutils/core/tools'

const queries = [
  "SELECT * FROM users WHERE email LIKE '%@example.com'",
  'SELECT id, total FROM orders WHERE customer_id = 7 LIMIT 20',
]

for (const sql of queries) {
  const result = await runTool('slow-query-detector', sql)
  console.log(sql)
  console.log(result.output)
  console.log('meta keys:', Object.keys(result.meta ?? {}))
  console.log()
}
