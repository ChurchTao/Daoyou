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
RUN pnpm run build:server \
    && pnpm --filter @daoyou/api deploy --prod /out \
    && find /out/dist /out/node_modules/@daoyou/*/dist -type f \
        \( -name '*.map' -o -name '*.d.ts' \) -delete

FROM node:24.18.0-bookworm-slim AS runtime-files
RUN rm -rf /usr/local/lib/node_modules /opt/yarn-* \
    /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack \
    /usr/local/bin/yarn /usr/local/bin/yarnpkg

# Copy the cleaned filesystem so removed tools do not remain in lower image layers.
FROM scratch AS runtime
COPY --from=runtime-files / /
WORKDIR /app

ENV PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
ENV NODE_ENV=production
ENV PORT=3000

COPY --from=builder /out ./

USER node
EXPOSE 3000
STOPSIGNAL SIGTERM
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "dist/main.js"]
