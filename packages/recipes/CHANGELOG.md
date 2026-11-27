# @smartdevutils/recipes

## 1.3.0

### Patch Changes

- Version aligned with the other @smartdevutils packages: every package now ships under one shared version. No API change from 0.1.0.

## 0.1.0

### Minor Changes

- First release of `@smartdevutils/recipes`.
  - `BUILTIN_RECIPES`: the 55 built-in SmartDevUtils recipes as data. The ids are the website's.
  - A headless engine: `runRecipe`, `runSteps`, `rerunFile`, `isRunnable`, `runnableRecipes` and `missingRunners`. It pipes each step's output into the next step through the `@smartdevutils/core/tools` runners and stops the way the website's replay does (on an error, on an empty output, or at a report tool).
  - Runs are recorded as `RecipeRun` and saved with `buildRunFile` or `runFileText` as `sdu-recipe-run/1` files. The website's "Upload run" reads these, and `readRunFile` reads files downloaded from the website.
  - The website's pure helpers, unchanged: `describeStep`, `profileValue`, `jsonChanges`, `lineDiff`, `capValue`, `parseRunFile` (same caps and validation), recipe export and import (`sdu-recipes/1`), and `canPipe`.
  - Two built-in recipes run headless today: `decode-base64-json-param` and `json-to-base64-env`. More become runnable as core adds runners.
- - `runFrom(run, index, { input?, mode?, options? })` runs a recorded run again from one step, with that step's input, mode or settings changed. The steps before it keep their trace.
  - `stepStatus(run, index, running?)`, `STEP_STATUS_LABEL` and `runFinished(run)` give a step list's status in the same words in every UI package.

### Patch Changes

- Updated dependencies
- Updated dependencies
  - @smartdevutils/core@1.3.0
