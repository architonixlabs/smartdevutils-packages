// Absolute paths used by the docs generator and the tests. Resolved from this file, so the
// generator works from any working directory (repo root or apps/playground).
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const here = path.dirname(fileURLToPath(import.meta.url))

export const APP_DIR = path.resolve(here, '..', '..')
export const REPO_ROOT = path.resolve(APP_DIR, '..', '..')
export const PACKAGES_DIR = path.join(REPO_ROOT, 'packages')
export const SNIPPETS_DIR = path.join(APP_DIR, 'snippets')
export const DOCS_OUT = path.join(APP_DIR, 'src', 'assets', 'docs.json')
/** Scratch folder for executing snippets. Inside node_modules so it is ignored by git and bare
 *  `@smartdevutils/*` imports resolve through apps/playground/node_modules. */
export const RUN_DIR = path.join(APP_DIR, 'node_modules', '.cache', 'sdu-snippets')

/** The website's examples file (sibling repo). Optional: the build falls back to spec defaults. */
export const TOOL_EXAMPLES_FILE =
  process.env.SDU_TOOL_EXAMPLES ??
  path.resolve(REPO_ROOT, '..', 'SmartDevUtils', 'SmartDevUtils.Client', 'src', 'app', 'data', 'tool-examples.ts')

/** Committed copy of the runnable tools' website examples, for builds without the website repo (Docker). */
export const TOOL_EXAMPLES_SNAPSHOT = path.join(APP_DIR, 'scripts', 'data', 'tool-examples.json')

/** Packages in the order the playground lists them. */
export const PACKAGE_IDS = ['core', 'browser', 'recipes', 'elements', 'react', 'angular', 'theme']
