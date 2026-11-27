/* ---
title: Review a slow query
entry: database/analyzeQueryForIndexes, database/detectSlowQueryPatterns
node: true
--- */
import { analyzeQueryForIndexes, detectSlowQueryPatterns } from '@smartdevutils/core/database'

const sql = `SELECT * FROM orders
WHERE customer_id = 7 AND status = 'paid' AND note LIKE '%gift%'
ORDER BY created_at DESC`

console.log('Patterns:')
for (const p of detectSlowQueryPatterns(sql)) console.log(`  [${p.severity}] ${p.pattern}: ${p.suggestion}`)

console.log('Index suggestions:')
for (const s of analyzeQueryForIndexes(sql)) console.log(`  ${s.sql}  -- ${s.reason}`)
