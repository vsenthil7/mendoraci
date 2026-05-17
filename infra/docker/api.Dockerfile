# syntax=docker/dockerfile:1.7

FROM node:20-alpine AS base
WORKDIR /app
ENV PNPM_HOME=/usr/local/share/pnpm \
    PATH=/usr/local/share/pnpm:$PATH
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate && apk add --no-cache wget

FROM base AS deps
COPY package.json pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
COPY packages/mask-policy/package.json packages/mask-policy/
RUN pnpm install --no-frozen-lockfile

FROM deps AS dev
COPY tsconfig.base.json ./
COPY apps/api ./apps/api
COPY packages ./packages
EXPOSE 4000
WORKDIR /app/apps/api
CMD ["pnpm", "dev"]

FROM deps AS build
COPY tsconfig.base.json ./
COPY apps/api ./apps/api
COPY packages ./packages
RUN pnpm --filter ./packages/shared build \
 && pnpm --filter ./packages/mask-policy build \
 && pnpm --filter ./apps/api build

FROM node:20-alpine AS prod
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/packages/mask-policy/dist ./packages/mask-policy/dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api/package.json ./apps/api/package.json
EXPOSE 4000
USER node
CMD ["node", "apps/api/dist/index.js"]
