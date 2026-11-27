/* ---
title: Scan a config file for leaked secrets
entry: security/scanForSecrets
description: The fake key is assembled at run time so this example does not trip secret scanners itself.
node: true
--- */
import { scanForSecrets } from '@smartdevutils/core/security'

const fakeAwsKey = 'AKIA' + 'IOSFODNN7EXAMPLE' // AWS's documented example key
const config = `region = "eu-west-1"
access_key_id = "${fakeAwsKey}"
log_level = "debug"`

const findings = scanForSecrets(config)
if (!findings.length) console.log('No secrets found')
for (const f of findings) console.log(`line ${f.line}: ${f.type} (${f.match.slice(0, 6)}…)`)
