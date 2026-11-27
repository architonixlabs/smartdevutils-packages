/* ---
title: Save a run file, read it back and run it again
entry: index/runFileText, index/readRunFile, index/rerunFile
description: sdu-recipe-run/1 files are what smartdevutils.com's run summary downloads and uploads.
node: true
--- */
import { getRecipe, runRecipe, runFileText, readRunFile, rerunFile } from '@smartdevutils/recipes'

const run = await runRecipe(getRecipe('json-to-base64-env')!)
const text = runFileText(run) // write this to a .json file to upload it on the website
console.log(text.slice(0, 160) + '…')

const read = readRunFile(text)
if ('error' in read) throw new Error(read.error)
console.log('read back:', read.run.name, `${read.run.steps.length} steps`, read.notes)

const again = await rerunFile(text)
if ('error' in again) throw new Error(again.error)
console.log('same result:', again.run.trace.at(-1)?.output === run.trace.at(-1)?.output)
