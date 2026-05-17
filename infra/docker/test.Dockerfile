# syntax=docker/dockerfile:1.7
FROM mcr.microsoft.com/playwright:v1.48.0-jammy
WORKDIR /app
ENV PNPM_HOME=/usr/local/share/pnpm \
    PATH=/usr/local/share/pnpm:$PATH \
    NODE_ENV=test
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
COPY . /app
RUN pnpm install --no-frozen-lockfile
CMD ["pnpm", "test:all"]
