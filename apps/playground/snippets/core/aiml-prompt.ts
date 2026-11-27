/* ---
title: Estimate tokens and review a system prompt
entry: aiml-tools/estimateTokensForModel, aiml-tools/analyzeSystemPrompt
description: Token counts are estimates; prices change, so check the provider before you budget.
node: true
--- */
import { estimateTokensForModel, analyzeSystemPrompt } from '@smartdevutils/core/aiml-tools'

const prompt = `You are a support agent for Acme Cloud.
Answer in under 120 words, in plain English.
Never share account data. If you are unsure, say so and offer to open a ticket.
Reply in Markdown with a short list of next steps.`

console.log(estimateTokensForModel(prompt, 'gpt-4o'))

const review = analyzeSystemPrompt(prompt)
console.log(review.overall, review.scores)
for (const s of review.suggestions) console.log('-', s)
