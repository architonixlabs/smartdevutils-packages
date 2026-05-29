# Contributing to SmartDevUtils Packages

## Setup

```bash
# Prerequisites: Node 20+, pnpm 9+
git clone https://github.com/ArchitonixLabs/smartdevutils-packages
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
