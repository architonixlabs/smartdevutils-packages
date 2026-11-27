# SmartDevUtils Playground image. Build context: the smartdevutils-packages repo root.
#   docker build -f apps/playground/Dockerfile -t smartdevutils-playground .
# Serves the Angular app at /playground/ on port 8080 as a non-root user; works with a read-only root
# filesystem plus a tmpfs on /tmp (nginx pid and temp files live there in the unprivileged image).

# ---- build: the workspace packages, the docs data, the sandbox runtime and the Angular app ----
FROM node:24.22.3-bookworm-slim AS build
ENV CI=true \
    NG_CLI_ANALYTICS=false \
    TURBO_TELEMETRY_DISABLED=1 \
    NPM_CONFIG_UPDATE_NOTIFIER=false
RUN npm install -g pnpm@9.15.0
WORKDIR /repo

# Dependencies first, keyed on the lockfile only, so code changes reuse this layer.
COPY pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm fetch

COPY . .
RUN pnpm install --frozen-lockfile --offline

# All packages (topological order): the docs generator reads their dist/ types, READMEs and manifests.
RUN pnpm --filter "./packages/*" run build
RUN pnpm --filter @smartdevutils-apps/playground build

# ---- serve ----
FROM nginxinc/nginx-unprivileged:1.30.6-alpine3.24
COPY apps/playground/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/playground/dist/browser /usr/share/nginx/html/playground
USER 101
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/playground/ || exit 1
# Run nginx directly: the image's entrypoint scripts try to rewrite config, which a read-only filesystem refuses.
ENTRYPOINT ["nginx", "-g", "daemon off;"]
