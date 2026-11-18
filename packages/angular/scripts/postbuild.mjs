// ng-packagr writes dist/package.json for publishing from dist/. This package is published from its
// root (exports point into dist/), so that copy would only confuse tools that look inside dist/.
import { rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

rmSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'dist', 'package.json'), { force: true })
