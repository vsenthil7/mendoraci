# syntax=docker/dockerfile:1.7
# Playwright test runner image — official MS image has chromium/firefox/webkit pre-installed.
# CP-3f: image bumped 1.48.0 -> 1.60.0 to match whatever @playwright/test pnpm
# resolves at install time. Trying to pin pnpm to 1.48.0 in package.json was
# fighting upstream; tracking the latest LTS playwright instead.
FROM mcr.microsoft.com/playwright:v1.60.0-jammy

WORKDIR /app
ENV PNPM_HOME=/usr/local/share/pnpm \
    PATH=/usr/local/share/pnpm:$PATH
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate

# Install deps (caches when only test sources change)
COPY package.json pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
COPY packages/mask-policy/package.json packages/mask-policy/
RUN pnpm install --no-frozen-lockfile

# Copy what tests actually need
COPY tsconfig.base.json ./
COPY tests ./tests
COPY packages ./packages
COPY apps ./apps

# Build workspace pkgs so test imports resolve
RUN pnpm --filter @mendoraci/shared build \
 && pnpm --filter @mendoraci/mask-policy build

# Default: run all suites, all browsers
CMD ["pnpm", "exec", "playwright", "test", "--config=tests/playwright/playwright.config.ts"]
