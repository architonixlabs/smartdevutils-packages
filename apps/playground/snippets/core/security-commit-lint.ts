/* ---
title: Lint commit messages
entry: security-extra2/gitCommitLint
node: true
--- */
import { gitCommitLint } from '@smartdevutils/core/security-extra2'

const messages = ['feat(auth): add passkey sign-in', 'fix: handle empty input', 'Updated stuff', 'feat: ']

for (const m of messages) {
  const r = gitCommitLint(m)
  console.log(r.valid ? 'ok  ' : 'FAIL', JSON.stringify(m), r.errors.join('; '))
}
