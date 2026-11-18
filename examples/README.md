# Examples

Small apps that use the UI packages from this repository through workspace links. `pnpm build` at the root builds them. They are private and never published.

| Folder | Stack | Uses |
|--------|-------|------|
| `plain-html-cdn` | One HTML file, no bundler | The CDN build of `@smartdevutils/elements` (`dist/cdn/sdu-elements.js`), with Mermaid served from the same folder |
| `vue-vite` | Vue 3, Vite | `@smartdevutils/elements` |
| `react-vite` | React 18, Vite | `SduTool`, `SduDiagram`, `SduRecipe`, `SduRecipeRun` from `@smartdevutils/react` |
| `angular-19` | Angular 19, zone.js, client-side | `@smartdevutils/angular` |
| `angular-22-ssr` | Angular 22, zoneless, server rendering (Express) | `@smartdevutils/angular`. The server runs the tools, so its HTML already holds their output |

Each page has the same sections, which the end-to-end check relies on: `#tool`, `#diagram`, `#recipe` and `#recipe-run`, plus a light/dark switch. All sample data is synthetic.

## Run them

```bash
pnpm install
pnpm build                              # packages, then examples
node scripts/e2e-ui.mjs                 # checks all five in Microsoft Edge (headless)
node scripts/e2e-ui.mjs --only=vue-vite --headed
```

To look at one by hand:

- the Vite apps: `pnpm --filter @smartdevutils-examples/vue-vite dev`;
- `angular-19`: `pnpm --filter @smartdevutils-examples/angular-19 start`;
- `angular-22-ssr`: `pnpm --filter @smartdevutils-examples/angular-22-ssr start` after a build (it listens on port 4000, or `PORT`);
- `plain-html-cdn`: serve `examples/plain-html-cdn/dist` with any static file server.

## Monorepo note for Angular 22

Inside this repository, `@smartdevutils/angular` is a link to `packages/angular`, whose own `node_modules` hold the Angular 19 it is built with. `examples/angular-22-ssr/tsconfig.json` maps `@angular/*` to the app's own Angular 22 (`paths`), which is what an install from npm gives you anyway. Apps that install the package from npm do not need this.
