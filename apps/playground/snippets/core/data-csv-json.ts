/* ---
title: CSV to JSON and back
entry: data/csvToJson, data/jsonToCsv
node: true
--- */
import { csvToJson, jsonToCsv } from '@smartdevutils/core/data'

const csv = `id,name,city
1,Ada Lovelace,London
2,Grace Hopper,"New York, NY"`

const rows = csvToJson(csv)
console.log(rows)

// Values that contain a comma or a quote are quoted again.
console.log(jsonToCsv(rows))
