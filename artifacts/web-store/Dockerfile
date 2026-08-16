FROM node:22-alpine AS build
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
RUN npm install -g pnpm@10
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY lib ./lib
COPY artifacts/web-store ./artifacts/web-store
COPY attached_assets ./attached_assets
COPY vendor ./vendor
RUN pnpm install --frozen-lockfile
ENV NODE_ENV=production
RUN pnpm --filter @workspace/web-store run build

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
RUN npm install -g serve@14
COPY --from=build /app/artifacts/web-store/dist/public /app/public
WORKDIR /app
EXPOSE 3000
CMD ["sh", "-c", "serve -s public -l ${PORT:-3000}"]
