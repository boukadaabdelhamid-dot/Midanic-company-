# ──────────────────────────────────────────────
# Stage 1: Build (frontend + API)
# ──────────────────────────────────────────────
FROM node:22-alpine AS builder

# Install pnpm v10 explicitly — matches the pnpm-lock.yaml lockfileVersion 9.0
# generated on this project. corepack would pull v11 which breaks
# onlyBuiltDependencies handling (ERR_PNPM_IGNORED_BUILD_SCRIPTS).
RUN npm install -g pnpm@10

WORKDIR /app

# Copy workspace manifests first for better layer caching
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY lib/db/package.json              lib/db/
COPY lib/api-spec/package.json        lib/api-spec/
COPY lib/api-zod/package.json         lib/api-zod/
COPY lib/api-client-react/package.json lib/api-client-react/
COPY artifacts/api-server/package.json  artifacts/api-server/
COPY artifacts/midanic-web/package.json artifacts/midanic-web/

RUN pnpm install --frozen-lockfile

# Copy the rest of the source code
COPY . .

# Build the React frontend
# PORT is required by vite.config.ts at startup (dev server config) — pass a
# dummy value so the config doesn't throw during `vite build`.
RUN BASE_PATH=/ PORT=3000 pnpm --filter @workspace/midanic-web run build

# Build the API server (esbuild bundles everything into dist/)
RUN pnpm --filter @workspace/api-server run build

# ──────────────────────────────────────────────
# Stage 2: Run (minimal image)
# ──────────────────────────────────────────────
FROM node:22-alpine AS runner

# Run as a non-root user to reduce the attack surface in production.
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

ENV NODE_ENV=production
# Railway injects PORT at runtime; fall back to 8080 for local docker run
ENV PORT=8080

# Copy the esbuild bundle (includes pino workers and migration SQL files)
COPY --from=builder /app/artifacts/api-server/dist ./dist

# Copy the built frontend so the API can serve it as static files
COPY --from=builder /app/artifacts/midanic-web/dist/public ./public

# Ensure the non-root user owns all app files
RUN chown -R appuser:appgroup /app
USER appuser

EXPOSE 8080

CMD ["node", "--enable-source-maps", "/app/dist/index.mjs"]
