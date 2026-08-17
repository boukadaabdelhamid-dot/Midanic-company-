FROM node:22-alpine AS build

RUN npm install -g pnpm@10
WORKDIR /app

# Railway must use the repository root as the build context.  Build from the
# checked-out Midanic source instead of cloning a different repository.
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY lib ./lib
COPY artifacts/erp-api-server ./artifacts/erp-api-server
RUN pnpm install --frozen-lockfile
ENV NODE_ENV=production
# Force a fresh bundle so a stale checked-in/cached dist directory can never
# become the runtime entrypoint after a Railway rebuild.
ARG ERP_API_BUILD_REV=2026-08-18-01
RUN rm -rf /app/artifacts/erp-api-server/dist && pnpm --filter @workspace/erp-api-server run build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

# The ERP bundle intentionally externalizes pg and a few native/runtime
# packages, so retain the pnpm dependency tree in the runtime image.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/artifacts/erp-api-server/dist ./artifacts/erp-api-server/dist
COPY --from=build /app/package.json ./package.json

EXPOSE 8080
CMD ["node", "--enable-source-maps", "/app/artifacts/erp-api-server/dist/index.mjs"]
