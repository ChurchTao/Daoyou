# syntax=docker/dockerfile:1

FROM node:24.18.0-bookworm-slim AS node-base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN npm install --global pnpm@10.34.6

FROM node-base AS builder
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/web/package.json ./apps/web/package.json
COPY packages/constants/package.json ./packages/constants/package.json
COPY packages/game-domain/package.json ./packages/game-domain/package.json
COPY packages/combat-core/package.json ./packages/combat-core/package.json
COPY packages/game-content/package.json ./packages/game-content/package.json
COPY packages/contracts/package.json ./packages/contracts/package.json
COPY packages/game-rules/package.json ./packages/game-rules/package.json
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm run build:server && pnpm --filter @daoyou/api deploy --prod /out

FROM node:24.18.0-bookworm-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY --from=builder /out ./

USER node
EXPOSE 3000
STOPSIGNAL SIGTERM
CMD ["node", "dist/main.js"]
