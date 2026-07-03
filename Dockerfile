# syntax=docker/dockerfile:1

FROM oven/bun:1.3.13 AS builder
WORKDIR /app

# 1) 先拷贝依赖描述文件以利用 Docker layer 缓存
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile

# 2) 拷贝源码并构建
COPY . .
RUN bun run build:server

FROM oven/bun:1.3.13 AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY --from=builder /app/dist ./dist

EXPOSE 3000

CMD ["bun", "run", "dist/index.js"]
