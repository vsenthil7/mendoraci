# syntax=docker/dockerfile:1.7

FROM node:20-alpine AS base
WORKDIR /app
ENV PNPM_HOME=/usr/local/share/pnpm \
    PATH=/usr/local/share/pnpm:$PATH
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate

FROM base AS deps
COPY package.json pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
COPY packages/mask-policy/package.json packages/mask-policy/
RUN pnpm install --no-frozen-lockfile

FROM deps AS dev
COPY tsconfig.base.json ./
COPY apps/web ./apps/web
COPY packages ./packages
RUN pnpm --filter @mendoraci/shared build
EXPOSE 3000
WORKDIR /app/apps/web
CMD ["pnpm", "dev"]

FROM deps AS build
COPY tsconfig.base.json ./
COPY apps/web ./apps/web
COPY packages ./packages
RUN pnpm --filter @mendoraci/shared build && pnpm --filter @mendoraci/web build

FROM node:20-alpine AS prod
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
COPY --from=build /app/apps/web/.next ./apps/web/.next
COPY --from=build /app/apps/web/public ./apps/web/public
COPY --from=build /app/apps/web/package.json ./apps/web/package.json
COPY --from=build /app/node_modules ./node_modules
EXPOSE 3000
USER node
WORKDIR /app/apps/web
CMD ["pnpm", "start"]
