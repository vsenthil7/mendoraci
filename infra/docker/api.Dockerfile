# syntax=docker/dockerfile:1.7

FROM node:22-alpine AS base
WORKDIR /app
ENV PNPM_HOME=/usr/local/share/pnpm \
    PATH=/usr/local/share/pnpm:$PATH
# Build tools required for node-pty native rebuild that Bob CLI pulls in.
# (Bob's install does `node-gyp rebuild` on node-pty@1.0.0; without python+gcc
#  the postinstall exits 1 and Bob refuses to launch on alpine.)
RUN apk add --no-cache wget python3 make g++ libc6-compat \
 && corepack enable \
 && corepack prepare pnpm@9.12.0 --activate

FROM base AS deps
# Copy manifests only first for layer caching.
COPY package.json pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
COPY packages/mask-policy/package.json packages/mask-policy/
RUN pnpm install --no-frozen-lockfile

FROM deps AS dev
COPY tsconfig.base.json ./
COPY apps/api ./apps/api
COPY packages ./packages
# Build shared/mask-policy once so apps/api can import them.
RUN pnpm --filter @mendoraci/shared build \
 && pnpm --filter @mendoraci/mask-policy build

# Install IBM Bob Shell CLI globally so the RCA handler can shell out to it.
# We install the npm package directly from IBM's S3 tarball; this matches the
# documented Windows path and avoids the bobshell.sh wrapper which is
# interactive (asks for package manager choice).
# Anchor: RT-003 RCA (BR-003, BR-012), CP-5 mini-sprint.
RUN BOB_VERSION=$(wget -qO- https://s3.us-south.cloud-object-storage.appdomain.cloud/bob-shell/bobshell-version.txt | tr -d '\r\n ') \
 && echo "Installing IBM Bob Shell v${BOB_VERSION}" \
 && npm install -g --loglevel=error "https://s3.us-south.cloud-object-storage.appdomain.cloud/bob-shell/bobshell-${BOB_VERSION}.tgz" \
 && bob --version

EXPOSE 4000
WORKDIR /app/apps/api
CMD ["pnpm", "dev"]

FROM deps AS build
COPY tsconfig.base.json ./
COPY apps/api ./apps/api
COPY packages ./packages
RUN pnpm --filter @mendoraci/shared build \
 && pnpm --filter @mendoraci/mask-policy build \
 && pnpm --filter @mendoraci/api build

FROM node:22-alpine AS prod
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache python3 make g++ libc6-compat \
 && corepack enable \
 && corepack prepare pnpm@9.12.0 --activate
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/packages/mask-policy/dist ./packages/mask-policy/dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api/package.json ./apps/api/package.json
# Install Bob CLI in prod too.
RUN BOB_VERSION=$(wget -qO- https://s3.us-south.cloud-object-storage.appdomain.cloud/bob-shell/bobshell-version.txt | tr -d '\r\n ') \
 && npm install -g --loglevel=error "https://s3.us-south.cloud-object-storage.appdomain.cloud/bob-shell/bobshell-${BOB_VERSION}.tgz" \
 && bob --version
EXPOSE 4000
USER node
CMD ["node", "apps/api/dist/index.js"]
