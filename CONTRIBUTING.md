# Contributing to SmartDevUtils Packages

## Setup

```bash
# Prerequisites: Node 20+, pnpm 9+
git clone https://github.com/architonixlabs/smartdevutils-packages
cd smartdevutils-packages
pnpm install
```

## Development

```bash
# Build all packages
pnpm build

# Run all tests
pnpm test

# Run tests for a specific package
cd packages/core && pnpm test
cd packages/react && pnpm test

# Type check
cd packages/core && pnpm lint
```

## Adding a New Tool

1. Add the utility function to the appropriate module in `packages/core/src/`
2. Write a test in the corresponding `.test.ts` file
3. Export it from `packages/core/src/index.ts`
4. (Optional) Create a React component in `packages/react/src/components/`
5. Add a changeset: `pnpm changeset`

## Adding a Tool Runner

1. Write the spec in `packages/core/src/tools/specs/<tool id>.ts`. Copy the id, slug, name, category, tool type and modes from the website registry, and use the website's own setting names as option keys.
2. Write the runner in `packages/core/src/tools/runners/<tool id>.ts` with `defineRunner`. `output` must be the text the website shows in its output panel for the same input and settings.
3. Add the spec to `tools/specs/index.ts` and the loader to `tools/loaders.ts`. A test fails if a runner file is not registered or a spec drifts from the catalog.
4. Write `runners/<tool id>.test.ts` with synthetic data. Recipes that use only runnable tools become runnable in `@smartdevutils/recipes` automatically.

## UI packages (theme, elements, angular, react)

- Styles live in `packages/theme` (`src/tokens.mjs` and `src/base.css`). Use `--sdu-*` tokens and `.sdu-*` classes; no Tailwind in new components.
- Keep `<sdu-tool>`, `SduToolComponent` and `SduTool` (and the recipe and diagram components) in step: same labels, same `data-role` hooks, same behaviour.
- Logic that more than one UI needs goes into `@smartdevutils/core`, `@smartdevutils/recipes` or `@smartdevutils/browser`, not into a UI package.
- After `pnpm build`, run `pnpm e2e:ui`. It drives the five apps in `examples/` in Microsoft Edge (headless) and stops the servers it starts.

## Submitting a Pull Request

1. Fork and create a branch from `main`
2. Make your changes with tests
3. Run `pnpm changeset` and describe your change
4. Open a PR against `main`

## Changesets

We use [Changesets](https://github.com/changesets/changesets) for versioning. When you make a user-facing change, run:

```bash
pnpm changeset
```

Follow the prompts to select the affected packages and describe the change. Commit the generated `.changeset/*.md` file with your PR.
