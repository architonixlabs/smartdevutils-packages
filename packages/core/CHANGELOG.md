# Changelog — @smartdevutils/core

## 1.3.1

### Patch Changes

- `generateFakeDataset` / `generateFakeRecord`: the `ipv4` field type now always returns an IPv4 address (it used `faker.internet.ip()`, which sometimes returned IPv6).

## 1.3.0

### Minor Changes

- - js-yaml moves from ^4.1.1 to ^5.5.0, behind the same wrapper the website uses (`src/yaml.ts`). It keeps js-yaml 4's results: merge keys and timestamps in the default schema, `undefined` for empty input and `null` for a comment-only input, and `!!set` read as an object. One difference remains: js-yaml 5 reads an empty key (`: value`) as YAML 1.2 allows, where js-yaml 4 threw. This affects `yamlFormat` in `@smartdevutils/core/formats`.
  - `@smartdevutils/core/tools` adds `optionsForMode`, `modeLabels` and `defaultOptions` for building forms from a `ToolSpec`.
- Packaging fixes, headless tool runners and Mermaid diagram builders.

  **Packaging**

  - Dependencies are no longer copied into `dist`. faker, sql-formatter, terser, js-beautify, js-yaml, marked and the rest are now normal `import`/`require` calls of the packages listed in `dependencies`. Builds are much smaller: `data.js` goes from 508 kB to 2.6 kB, `formats.js` from 1,100 kB to 1.9 kB, and the root entry from 2,143 kB to 160 kB (raw, including the chunks each entry loads).
  - `@faker-js/faker` moves from ^9 to ^10.5. This clears the faker advisory that the website currently carries as a Trivy exception.
  - **Node 20.19 or later is now required** (`engines.node: ">=20.19"`). faker 10, change-case 5 and other dependencies are ESM-only, and the CommonJS build loads them with `require()`, which works without a flag only from Node 20.19 and 22.12.
  - The EFF word list for `generatePassphrase` is still bundled (it is a JSON data file). `eff-diceware-passphrase` is now a build-time dependency only.
  - js-beautify is imported through its default export, so Node's ESM loader can load `formats` and `formatting`.
  - `"sideEffects": false`. In every `exports` entry, `types` now comes first so TypeScript picks it up.

  **New: `@smartdevutils/core/tools`**, the tool runner contract.

  - `ToolSpec` gives each tool's id, website slug, name, category, tool type, modes, options, input kind and output kind.
  - `ToolRunner.run(input, { mode, options, signal })` returns `{ output, error?, meta? }`, synchronously or as a Promise. It never throws for bad input.
  - `loadRunner(idOrSlug)` loads each tool lazily, and each runner is its own entry: `@smartdevutils/core/tools/<tool id>`. Also new: `TOOL_SPECS`, `RUNNABLE_TOOL_IDS`, `getToolSpec`, `hasRunner`, `runTool` and `defineRunner`.
  - There are runners for 20 tools. Their modes and options mean the same as on smartdevutils.com:
    - Encoders, JSON, generators and hashing: url-encoder-decoder, base64-encoder-decoder, json-formatter, uuid-generator, hash-generator.
    - Databases: sql-create-table, ddl-diff, index-advisor, slow-query-detector, migration-generator.
    - DevOps: cicd-pipeline-builder, k8s-yaml-validator, docker-tag-checker, log-parser.
    - AI/ML, planning and testing: system-prompt-analyzer, training-data-formatter, gantt-generator, sprint-velocity, boundary-value-analyzer, performance-sla-checker.
  - New `@smartdevutils/core/tools/catalog`: `TOOL_CATALOG` holds id, slug, name, category, type, description and modes for all 210 website tools, plus `findToolById` and `findToolBySlug`. It is generated from the website registry by `scripts/gen-tool-catalog.mjs`.

  **New: `@smartdevutils/core/diagrams`**, pure Mermaid and DBML text builders ported from the website. It has no `mermaid` dependency:

  - `renderFlowchart`, `composeToMermaid` (Docker Compose), `k8sToMermaid`
  - `parseDdl`, `ddlToErd` (Mermaid ERD or DBML), `buildDdlChangeDiagram`
  - `workflowToMermaid` and `visualizeWorkflow` (GitHub Actions), `buildChart` (chart maker)
  - `extractMermaidBlocks`, the Mermaid live editor helpers (templates, share links, `detectDiagramType`), and the existing `generateGanttMermaid`.

## 1.2.0

Bug-fix release. Public function signatures are unchanged; new parameters and result fields are optional.

### devops-tools

- `generateCicdPipeline` produces real, valid YAML (serialised with js-yaml) for every platform/language:
  - lint, docker and deploy are real commands instead of the literal `run: lint` / `run: docker` / `run: deploy`.
  - GitHub Actions adds a setup step per language (`actions/setup-node`, `setup-python`, `setup-go`, `setup-java`, `setup-dotnet`, `dtolnay/rust-toolchain`); deploy is a separate job (`needs: build`) gated on the branch.
  - GitLab CI sets a language `image`, uses a docker-in-docker job for image builds and a branch rule for deploy.
  - CircleCI uses a language image, `setup_remote_docker` and a workflow.
  - Azure Pipelines is now a full pipeline (`trigger`, `pool`, tool-installer task, `script` steps) instead of a bare list of commands.
  - New optional `CicdConfig` fields: `imageName`, `deployCommand`, `branch`.
  - install/lint/test/build always run in that order.

### database

- `diffDdlStatements`: table-level constraints (`CONSTRAINT`, `PRIMARY KEY (…)`, `UNIQUE (…)`, `CHECK`, `FOREIGN KEY`, MySQL `INDEX` / `KEY`) are no longer read as columns; `--` and `/* */` comments are stripped; unquoted identifiers compare case-insensitively (double-quoted ones are case-sensitive); `"x"`, `` `x` `` and `[x]` identifiers are supported; several `CREATE TABLE` statements are diffed per table. New optional fields: `ColumnDef.table` / `definition` / `rawName`, `changed[].table` / `beforeColumn` / `afterColumn`, `DdlDiff.addedTables` / `removedTables`. `type` is now the data type only; `changed[].before` / `after` keep the full definition.
- `generateMigrationSql`:
  - Postgres emits `TYPE`, `SET/DROP NOT NULL` and `SET/DROP DEFAULT` as separate statements; MySQL uses `MODIFY COLUMN` with the full definition (without `PRIMARY KEY` / `UNIQUE`).
  - A dropped and an added column of the same type produce `-- WARNING: possible rename …; DROP+ADD loses data` with a `RENAME COLUMN` hint.
  - Constraint changes that cannot be expressed as ALTER COLUMN produce a `-- WARNING` instead of being dropped silently.
  - New tables become `CREATE TABLE` (and `DROP TABLE` in down); removed tables are dropped and re-created in down.
  - No differences now return `-- No schema changes` for both `up` and `down`.
  - New optional result fields: `warnings`, `hasChanges`.
  - **Behaviour change:** throws when neither input contains a `CREATE TABLE`.
- `analyzeQueryForIndexes`: resolves table aliases; ignores string literals and SELECT aliases used in ORDER BY; understands `IN`, `BETWEEN`, `IS [NOT] NULL`, range and prefix-`LIKE` predicates (leading-wildcard LIKE is skipped); credits JOIN ON / USING columns to the joined table; suggests a composite index (equality columns, then ORDER BY or the first range column), but not across `OR`; looks inside subqueries and UNION branches. New optional fields: `IndexSuggestion.table`, `columns`.
- `detectSlowQueryPatterns`: works on tokens, so string literals and comments are ignored; checks each statement on its own; UPDATE/DELETE-without-WHERE is based on the statement keyword (no more false positive on `deleted_at`); `NOT IN ( SELECT` matches with any whitespace; `TOP n`, `TOP (n)` and `FETCH FIRST|NEXT n ROWS` count as limits; a `SELECT` with no `FROM` is not flagged for a missing LIMIT.
- `generateCreateTable`: only integer primary keys auto-increment (`SERIAL` / `BIGSERIAL` / `SMALLSERIAL`, `AUTO_INCREMENT`, `IDENTITY(1,1)`, SQLite `INTEGER PRIMARY KEY AUTOINCREMENT`); UUID / VARCHAR primary keys keep their type. New `ColumnDef.autoIncrement: false` opts out. New optional third parameter `{ uuidDefault: true }` adds `DEFAULT gen_random_uuid()` (Postgres `UUID`) or `DEFAULT NEWID()` (MSSQL `UNIQUEIDENTIFIER`). String defaults are quoted and escaped; numbers, booleans, `NULL`, function calls and `CURRENT_TIMESTAMP`-style keywords stay as they are. Reserved-word identifiers (`order`, `user`, `group`, `select`, …) are quoted per dialect.

### aiml-tools

- `formatTrainingData`: `openai` and `anthropic` now produce different output. OpenAI puts the system prompt in `messages` as `{"role":"system"}`. Anthropic (Amazon Bedrock Claude fine-tuning) puts it in a top-level `"system"` string with only user/assistant in `messages`. A system prompt can be set per row (`system`) or for all rows (`options.systemPrompt`).
  - **Behaviour change:** rows with a missing or empty `input` / `output` now throw an Error that lists every bad row (`err.errors`). Before, they produced invalid JSONL.
  - New `formatTrainingDataWithReport` does not throw; it returns `{ output, errors, validRows }`.
- `estimateTokensForModel`: CJK, Kana and Hangul characters count as about 1 token each (Latin text still uses about 4 characters per token); empty text is 0 tokens / 0 words. Prices are unchanged. Results now include `isEstimate`, `pricingAsOf`, `pricingNote` and `pricingKnown`. New exports `MODEL_PRICING_AS_OF` and `MODEL_PRICING_NOTE`.
