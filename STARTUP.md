# 万界道友启动说明

本文按当前代码整理。项目是 `Hono + React SPA`，使用 Bun 运行，不是 Next.js/SSR 项目。

## 1. 环境要求

- Bun 1.3+（后端 Dockerfile 当前固定为 `1.3.13`）
- PostgreSQL
- Redis
- Docker 与 Docker Compose（用于启动仓库自带的 NATS JetStream）
- NATS JetStream

安装 Bun（Linux/macOS）：

```bash
curl -fsSL https://bun.com/install | bash
bun --version
```

## 2. 安装依赖

```bash
cd /home/summy/cwork/xiuxian/Daoyou
bun install
cp .env.example .env.local
```

项目使用 `bun.lock`。不要改用 npm、Yarn 或 pnpm，也不要生成其它锁文件。

## 3. 准备环境变量

编辑 `.env.local`，本地启动至少需要以下配置：

```dotenv
PORT=3000

DATABASE_URL=postgresql://daoyou:daoyou-local-password@127.0.0.1:5432/daoyou
DB_MAX_CONNECTIONS=4

# 本地测试若不需要天地灵气行动力限制，可设置为 false
QI_SYSTEM_ENABLED=false

# 开发环境启用内部定时任务（含每 2 小时系统拍卖补货）
INTERNAL_CRON_ENABLED=true

REDIS_URL=redis://127.0.0.1:6379/0

NATS_SERVERS=nats://127.0.0.1:4222
NATS_USER=app
NATS_PASSWORD=local-nats-password

BETTER_AUTH_SECRET=请替换为足够长的随机字符串
BETTER_AUTH_URL=http://localhost:3000
PUBLIC_WEB_ORIGINS=http://localhost:5173

ALTCHA_HMAC_SECRET=请替换为另一个随机字符串

LLM_PROVIDER=
ALIBABA_API_KEY=
DEEPSEEK_API_KEY=
```

可使用 `openssl rand -hex 32` 分别生成两个随机密钥。

注意：

- `DATABASE_URL`、`BETTER_AUTH_SECRET` 和 `BETTER_AUTH_URL` 缺失时，后端会在加载阶段报错。
- NATS 是启动硬依赖。
- Redis 在当前代码中也是启动硬依赖：在线战斗运行时启动时会立即执行 Redis `PING`。
- `.env.example` 中的 AI Key 是示例占位值；没有真实 Key 时应清空，玩家也可以使用浏览器端 BYOK。
- `QI_SYSTEM_ENABLED=false` 会关闭天地灵气预扣：相关玩法仍可正常执行，但不会扣除灵气；删除此项或改为 `true` 即可恢复限制。
- `INTERNAL_CRON_ENABLED=true` 会在开发环境启用内部定时任务；系统拍卖行每逢双数整点刷新一轮，生产环境默认启用。
- 系统拍卖货源仅包含材料和丹药，品质为凡品、灵品、玄品，玄品封顶；品质越高，货单与库存越少。
- 密码注册、邮箱验证和密码重置需要有效 SMTP 配置；GitHub 登录需要 OAuth 配置。这些不是进程启动的必要条件。

## 4. 启动 PostgreSQL、Redis 和 NATS

仓库只自带 NATS Compose。若本机已有 PostgreSQL 和 Redis，可直接使用现有服务，并相应调整 `.env.local`。

没有现成服务时，可用 Docker 启动本地 PostgreSQL 和 Redis：

```bash
docker run -d \
  --name daoyou-postgres \
  -e POSTGRES_USER=daoyou \
  -e POSTGRES_PASSWORD=daoyou-local-password \
  -e POSTGRES_DB=daoyou \
  -p 5432:5432 \
  -v daoyou-postgres-data:/var/lib/postgresql/data \
  postgres:17-alpine

docker run -d \
  --name daoyou-redis \
  -p 6379:6379 \
  -v daoyou-redis-data:/data \
  redis:7-alpine
```

启动仓库提供的 NATS JetStream：

```bash
docker compose -f scripts/docker-compose.nats.yml up -d
```

NATS 端口为 `4222`，监控端口为 `8222`；本地账号和密码与上面的环境变量一致。

## 5. 初始化数据库

首次启动或拉取到新迁移后执行：

```bash
bunx drizzle-kit migrate
bun run auth:migrate
```

第一条命令迁移 `wanjiedaoyou_*` 业务表，第二条命令迁移独立的 `better_auth` schema。

## 6. 启动开发环境

```bash
bun run dev
```

该命令同时启动：

- React/Vite 前端：<http://localhost:5173>
- Bun/Hono API：<http://localhost:3000>

Vite 会把 `/api`、`/internal` 和 WebSocket 请求代理到 Bun/Hono 服务。日常开发从以下地址访问：

- 页面：<http://localhost:5173>
- 健康检查：<http://localhost:5173/api/health-check>

也可以分别启动：

```bash
bun run dev:web
bun run dev:api
```

仅启动前端时页面可以打开，但登录和游戏 API 无法使用。

## 7. 构建检查

```bash
bun run build
```

该命令依次构建前端 SPA、Bun/Hono 后端和在线战斗 resolver Worker。

其它检查命令：

```bash
bun run lint
bun run test
```

## 8. 生产后端

推荐使用仓库提供的 Dockerfile：

```bash
docker build -t daoyou-app:local -f docker/Dockerfile.app .
docker run --rm -p 3000:3000 \
  --env-file /path/to/.env.production \
  daoyou-app:local
```

生产镜像只包含 Bun/Hono 后端，不包含 React SPA。前端需执行 `bun run build:client` 后独立部署为静态站点。

当前 `package.json` 没有 `start` 或 `preview` 脚本。若不使用 Docker，可执行：

```bash
bun run build:server
NODE_ENV=production bun run dist/index.js
```

## 9. 常见启动错误

- `bun: command not found`：尚未安装 Bun，或 `~/.bun/bin` 未加入 `PATH`。
- `Missing DATABASE_URL`：`.env.local` 中未配置 PostgreSQL 连接串。
- `NATS_SERVERS is required`：NATS 环境变量未加载。
- `REDIS_URL is required before using Redis`：Redis 连接串缺失。
- 健康检查返回 `503`：检查响应里的 `redis`、`nats` 和 `messaging` 状态，再查看对应服务日志。
- `EADDRINUSE`：默认的 `3000` 或 `5173` 端口已被其它进程占用。
