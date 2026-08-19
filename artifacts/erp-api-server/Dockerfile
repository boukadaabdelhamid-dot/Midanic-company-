FROM node:22-alpine AS build

RUN npm install -g pnpm@10
WORKDIR /app

# Railway must use the repository root as the build context.
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY lib ./lib
COPY artifacts/erp-api-server ./artifacts/erp-api-server
COPY artifacts/erp ./artifacts/erp
COPY attached_assets ./attached_assets
RUN pnpm install --frozen-lockfile
ENV NODE_ENV=production
# Force a clean bundle — never run a stale checked-in dist.
RUN rm -rf /app/artifacts/erp-api-server/dist /app/artifacts/erp/dist && \
    VITE_API_URL="" pnpm --filter @workspace/erp run build && \
    pnpm --filter @workspace/erp-api-server run build

# ── Runtime image ─────────────────────────────────────────────────────────────
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Install every package that esbuild externalises so they are real npm
# installations (not broken pnpm symlinks). Exact versions match package.json.
RUN npm install \
      pg@8 \
      nodemailer@9 \
      @google-cloud/storage@7 \
      google-auth-library@10

COPY --from=build /app/artifacts/erp-api-server/dist ./artifacts/erp-api-server/dist
COPY --from=build /app/artifacts/erp/dist/public ./artifacts/erp/dist/public

EXPOSE 8080
CMD ["node", "--enable-source-maps", "/app/artifacts/erp-api-server/dist/index.mjs"]
