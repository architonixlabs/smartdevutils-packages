# SmartDevUtils Playground — spec (v1)

Status: building, 2026-11-27. Served at **https://smartdevutils.com/playground/**.

## Goal

One place to learn and try every `@smartdevutils/*` package: pick a package, pick a function, tool,
element or component, read what it does, edit a working example and run it in the browser, then
copy the exact code (install line, imports, framework wiring) into your own project.

Decisions (owner, 2026-11-27):

- Lives in this repo as `apps/playground` (private, never published), built from the workspace, so
  docs and examples are always the code that ships. Served by its own container; the SmartDevUtils
  site's nginx proxies `/playground/` to it (same pattern as `/mcp`).
- Live in v1: JavaScript/TypeScript (core, browser, recipes), HTML with the `<sdu-*>` elements and the
  theme, and React (TSX). Angular entries are docs plus copyable code and **Open in StackBlitz**.
- Saving: autosave per entry in this browser, **Share** puts the code in the URL hash (never sent to a
  server), plus Copy, Download and Open in StackBlitz. No accounts.

## Content (generated at build time: `scripts/build-docs.mjs` → `src/assets/docs.json`)

| Source | Becomes |
|---|---|
| `packages/*/package.json` | name, version, description, install line, export subpaths |
| `packages/*/README.md` | package overview (Markdown) and **guide snippets** from its fenced code blocks |
| `packages/*/CHANGELOG.md` | latest release notes |
| `packages/*/dist/**/*.d.ts` (TypeScript compiler API) | API items per export subpath: name, kind, signature, JSDoc |
| `core` `TOOL_SPECS` + `TOOL_CATALOG` | Tools section: runnable tools get a `runTool()` snippet using real website examples as input; the rest are listed as website-only |
| `elements/custom-elements.json` | Elements section: tag, attributes, events, an HTML snippet per tag |
| `snippets/<package>/*.{ts,tsx,html}` | hand-written examples (front matter: title, entry, description) |

Every snippet that can run in Node (`lang: ts|js`, no DOM) is executed by `pnpm --filter playground test`
against the workspace build, so a documented example cannot silently break.

## Running code safely

The playground is on the same origin as the site (accounts, API), so user code never runs in the
playground page itself:

- Code runs in `sandbox.html`, loaded in `<iframe sandbox="allow-scripts">` (no `allow-same-origin`)
  and served with `Content-Security-Policy: sandbox allow-scripts; …`. Its origin is opaque: no access
  to the site's cookies, storage or API session.
- The parent compiles TS/TSX with sucrase and posts `{ type: 'run' }`; the sandbox imports the code as a
  blob module. Bare imports (`@smartdevutils/core/encoding`, `react`) resolve through an import map to
  self-hosted bundles under `/playground/runtime/` (built from the workspace by Vite; no third-party CDN).
  Those files are served with `Access-Control-Allow-Origin: *` because the sandbox origin is opaque.
- Messages are checked: the parent only accepts messages whose `source` is the current iframe window and
  whose shape matches the protocol; the sandbox only accepts messages from its parent.
- Every run gets a fresh iframe; **Stop** removes it. Shared links never auto-run: the visitor presses Run.

## Contracts

`src/app/core/model.ts` (docs data) and `src/app/core/sandbox-protocol.ts` (messages) are the shared
contracts between the generator, the sandbox and the UI. Change them first, then the parts.

## UI

- Header: name, package version, light/dark, link back to smartdevutils.com.
- Left: search across everything; packages → sections (Overview, API by module, Tools, Elements,
  Components, Recipes, Theme) → entries. Deep link `/playground/<package>/<section>/<entry>`.
- Entry page: summary, signature, docs (Markdown, sanitized), then the playground: editor (CodeMirror),
  Run (Ctrl/Cmd+Enter), Stop, Reset, Share, Copy, Download, Open in StackBlitz; output console and a
  preview pane for HTML/React; an **Integrate** tab with install command and the same code for Node,
  plain HTML, React and Angular where the package supports them.
- Accessible: keyboard only works end to end, visible focus, labelled controls, live region for run
  results, respects `prefers-color-scheme` and reduced motion; works at phone width.

## Deploy

`apps/playground/Dockerfile` builds the workspace and the app, then serves `dist/browser` with
nginx-unprivileged at `/playground/` (port 8080 in the container). SmartDevUtils `docker-compose.yml`
service `smartdevutils-playground` (build context `../smartdevutils-packages`); the site nginx proxies
`/playground/`. Linked from the site's downloads page, footer and llms.txt.
