FROM node:22-alpine AS build

RUN npm install -g pnpm@10
WORKDIR /app

# Railway must use the repository root as the build context.
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY lib ./lib
COPY artifacts/erp-api-server ./artifacts/erp-api-server
RUN pnpm install --frozen-lockfile
ENV NODE_ENV=production
# Force a clean bundle — never run a stale checked-in dist.
RUN rm -rf /app/artifacts/erp-api-server/dist && \
    pnpm --filter @workspace/erp-api-server run build

# ── Runtime image ─────────────────────────────────────────────────────────────
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Install runtime dependencies directly via npm so pnpm symlinks are never
# involved. The ERP bundle externalizes pg (and a few other native packages);
# those must be present as real packages in node_modules, not broken symlinks.
RUN npm install pg@8 nodemailer@9 bcryptjs@3

COPY --from=build /app/artifacts/erp-api-server/dist ./artifacts/erp-api-server/dist

EXPOSE 8080
CMD ["node", "--enable-source-maps", "/app/artifacts/erp-api-server/dist/index.mjs"]
