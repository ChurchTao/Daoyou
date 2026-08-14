# 本地开发与部署

> 本页整理《万界道友》的本地开发、环境变量、数据库、构建、Docker、部署脚本与生产 cron 配置。项目简介、玩法、截图与赞助信息见 [README](../README.md)。

## 目录结构

```text
.
├── src/index.ts                 # Bun 后端入口，导出 Hono API 与 WebSocket 配置
├── src/server/                  # Hono API、认证、服务层、数据库访问
├── src/react-app/               # React SPA
├── src/shared/                  # 共享引擎、配置、类型、契约
├── drizzle/                     # 业务表 Drizzle migrations
├── drizzle-auth/                # Better Auth Drizzle migrations
├── drizzle.auth.config.ts       # Better Auth 独立迁移配置
├── scripts/                     # 部署脚本与生产/NATS Compose
├── docker/Dockerfile.app        # Bun 主服务镜像
└── vite.config.ts
```

## 运行方式

这个仓库不是 SSR 应用。

- `src/react-app` 使用 `BrowserRouter` 管理前端路由
- `src/server/app.ts` 提供 `/api/*` 和 `/internal/*` 接口
- `src/index.ts` 在生产环境注册 Bun 内置 cron；Cron 只向 NATS WorkQueue 发布后台 command
- 前端 SPA 独立部署到 Cloudflare Pages；后端 Docker 不再服务 `index.html` 或静态资源

当前路由约定：

- `/api/*`：游戏与后台 API
- `/api/auth/*`：Better Auth
- `/internal/cron/*`：内部定时任务接口
- `/api/health-check`：健康检查
- 其余如 `/login`、`/game`、`/admin`：Cloudflare Pages 上的前端 SPA 路由

## 环境要求

- `Bun 1.3+`
- `PostgreSQL`
- `Redis`：在线对局、邀请、截止时间、恢复索引和 API 部分能力的权威存储
- `NATS`：进程启动硬依赖；JetStream 承载领域事件、异步投影、后台 command、战斗演算指针、终态清理和回放归档，Core 只承载可丢失的跨实例实时提示

说明：

- 仓库脚本默认围绕 `bun` / `bunx` 编写，不建议继续沿用旧的 `npm + Next.js` 使用方式
- 开发模式默认端口是 `5173`
- 构建后服务默认端口是 `3000`

## 安装

```bash
bun install
cp .env.example .env.local
```

## 环境变量

### 启动时必需

这些变量缺失时，服务会在启动阶段或鉴权初始化阶段直接报错：

| 变量 | 说明 |
| --- | --- |
| `DATABASE_URL` | PostgreSQL 连接串 |
| `BETTER_AUTH_SECRET` | Better Auth 密钥 |
| `BETTER_AUTH_URL` | Better Auth 后端对外基准地址；生产填 API 域名，如 `https://api.example.com` |
| `NATS_SERVERS` | NATS 服务地址，多个地址使用逗号分隔 |
| `NATS_USER` / `NATS_PASSWORD` | NATS 应用用户凭据 |

实时战斗由 Bun/Hono 主服务直接承载；生产环境还必须配置：

| 变量 | 说明 |
| --- | --- |
| `REDIS_URL` | 在线对局唯一权威状态、邀请、凭据、截止时间与恢复索引 |
| `NATS_SERVERS` / `NATS_USER` / `NATS_PASSWORD` | 战斗演算、终态清理和回放归档使用的 JetStream，以及跨实例状态提示使用的 NATS Core |

客户端通过已认证的 session API 获取 60 秒有效的一次性 WebSocket ticket，不能自行声明玩家身份。实时战斗的数据边界固定为：`battle-v5` 只做确定性规则解析；Bun 主服务负责协议、调度和广播；进行中的权威状态、选招、锁定、邀请、演出战报和回放素材只在 Redis。主服务通过 JetStream 小型指针任务分配统一演算和终态清理；回放归档 consumer 再从 Redis 组装 `BattleReplayV1`，异步、幂等写入 `wanjiedaoyou_battle_replay_archives`。NATS 消息不承载完整 battle save 或战报；玩家 command 链路不查询或写入 PostgreSQL，也不使用 Redis Stream。

### 建议同时配置

| 变量 | 说明 |
| --- | --- |
| `REDIS_URL` | Redis 连接串；缺失时相关功能会在运行时失败 |
| `API_IP_RATE_LIMIT_WINDOW_SECONDS` | `/api/*` 全局 IP 令牌桶补充周期秒数；默认 `60` |
| `API_IP_RATE_LIMIT_MAX_REQUESTS` | `/api/*` 同 IP 令牌桶容量和每周期补充 token 数；默认 `300` |
| `PUBLIC_WEB_ORIGINS` | 允许访问 API 的前端 origin，逗号分隔，如 `https://app.example.com,http://localhost:5173` |
| `BETTER_AUTH_COOKIE_DOMAIN` | 可选；同站子域部署时可填 `.example.com` 启用跨子域 cookie |
| `ADMIN_EMAILS` | 管理员邮箱白名单，逗号分隔 |
| `ADMIN_USER_IDS` | Better Auth 管理员用户 ID 白名单，逗号分隔；账号管理工具必须配置 |

### 生产 cron 必需

| 变量 | 说明 |
| --- | --- |
| `CRON_SECRET` | 保护 `/internal/cron/*` 接口的 Bearer 密钥；生产环境必须配置，调度器调用时也要携带它 |

### 登录 / 注册相关

当前鉴权中，以下接口会强制要求 ALTCHA PoW payload：

- `/api/auth/sign-in/email`
- `/api/auth/sign-up/email`
- `/api/auth/request-password-reset`
- `/api/auth/email-otp/send-verification-otp`

前端通过 `/api/captcha/challenge` 获取带场景和过期时间的 challenge，完成 PoW 后把 payload 发送给认证接口。服务端会验证签名、场景和有效期，并通过 Redis 原子记录 challenge 的单次消费状态，防止重放。

| 变量 | 说明 |
| --- | --- |
| `VITE_API_BASE_URL` | 前端构建时注入的后端 API 基地址，如 `https://api.example.com` |
| `ALTCHA_HMAC_SECRET` | 服务端签发和验证 ALTCHA challenge 的独立 HMAC 密钥；生产环境必须配置 |

ALTCHA 不需要前端 site key。认证 CAPTCHA 启用时 Redis 也是强依赖；Redis 不可用时，受保护的认证请求会失败关闭，避免 challenge 被重复使用。

### 邮件能力

邮箱验证码、密码注册验证邮件、重置密码邮件、后台邮件广播都会使用SMTP。密码注册必须完成邮箱验证后才能登录；验证链接完成后会自动登录：

| 变量                                      | 说明          |
| ----------------------------------------- | ------------- |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` | SMTP 连接配置 |
| `SMTP_USER` / `SMTP_PASS`                 | SMTP 认证信息 |
| `MAIL_FROM`                               | 发件人        |

### AI 能力

AI 相关功能只调用 DeepSeek 官方 API。服务端默认配置：

- `DEEPSEEK_API_KEY`：服务端 DeepSeek API Key
- `DEEPSEEK_MODEL`：服务端默认模型，未配置时使用 `deepseek-chat`

玩家也可以在游戏设置中保存自己的 DeepSeek API Key 与模型。BYOK 配置只保存在当前浏览器；请求携带的配置不完整或格式无效时，服务端会返回 400，不会静默消耗服务器额度。

## 数据库初始化

首次启动通常要做两件事：

1. 应用业务表迁移
2. Better Auth 表迁移

```bash
bunx drizzle-kit migrate
bun run auth:migrate
```

说明：

- 运行这些命令前，请先确保 `DATABASE_URL`、`BETTER_AUTH_SECRET`、`BETTER_AUTH_URL` 已在当前进程环境中可见
- `drizzle/` 目录下已经存在业务表迁移文件
- `drizzle/` 只管理 `wanjiedaoyou_*` 业务表
- `drizzle-auth/` 只管理固定 `better_auth` schema，并使用独立迁移历史表
- `bun run auth:migrate` 使用 `drizzle.auth.config.ts` 执行认证迁移
- `bun run auth:generate` 用于认证 Drizzle schema 变更后生成迁移，不是每次启动都要执行
- 升级部署时先执行 `bun run auth:migrate` 建立认证基线，再部署使用共享 Bun SQL 连接池的新版本

## 本地开发

1. 准备好 `.env.local`
2. 确保数据库、Redis 和 NATS JetStream 可连接
3. 执行迁移
4. 启动开发服务器

```bash
docker compose -f scripts/docker-compose.nats.yml up -d
bun run dev
```

本地 NATS 容器监听 `4222`，监控端口为 `8222`，开发凭据与 `.env.example` 一致。持久数据保存在 Docker volume `nats-data` 中。

生产硬切顺序、Stream/consumer、DLQ 和故障检查参见 [nats-domain-events.md](nats-domain-events.md)。

访问：

- 前端页面：`http://localhost:5173`
- 健康检查：`http://localhost:5173/api/health-check`

`bun run dev` 会同时启动 Vite 前端和 Bun/Hono 主服务；Vite 将 `/api`、`/internal` 与 WebSocket 升级代理到 Bun 服务。

本地 NATS 使用 JetStream 文件卷保存消息和 durable consumer 的投递位点。启动时发现历史消息是预期行为；回放归档和事务消息会在 PostgreSQL 可用后继续消费。若 PostgreSQL 暂时不可用，事务消息恢复器会以 5 秒至 60 秒退避重试，避免连接超时期间持续打满连接池；不应通过删除 NATS 数据卷来规避数据库故障。

## 构建与运行

| 命令 | 作用 |
| --- | --- |
| `bun run dev` | 启动 Vite 与 Bun/Hono 主服务 |
| `bun run build` | 依次构建前端与服务端 |
| `bun run build:client` | 构建 Cloudflare Pages 使用的前端 SPA |
| `bun run build:server` | 构建 Docker 使用的 Bun/Hono 后端 |
| `bun run preview` | 先构建，再运行 `dist/index.js` |
| `bun run start` | 直接运行已构建产物 |
| `bun run lint` | ESLint 检查 |
| `bun run test` | Vitest |
| `bun run battle:smoke` | 实时战斗 2v2/4v4、超时默认出招、协议、负载与 Worker 故障注入验收 |
| `REDIS_URL=redis://127.0.0.1:6379/15 bun run battle:e2e:redis` | 使用本机隔离 Redis DB 验收重启、多实例、幂等和归档 staging |
| `bun run auth:generate` | 生成 `better_auth` Drizzle 迁移 |
| `bun run auth:migrate` | 执行 `better_auth` 独立迁移流 |

构建产物：

- `build:client` 产出前端 SPA
- `build:server` 产出 Bun 运行的 Hono 服务入口 `dist/index.js`

## Docker

React SPA 继续独立部署到 Cloudflare Pages，不进入后端镜像。`app`（`3000`）使用 Bun，同时承载 Hono API 与实时战斗 WebSocket；`battle-v5` 仍是无框架依赖的纯战斗引擎。PostgreSQL 回放归档由应用侧 NATS consumer 完成。

本地构建镜像：

```bash
docker build -t daoyou-app:local -f docker/Dockerfile.app .
```

运行镜像：

```bash
docker run --rm -p 3000:3000 \
  --env-file /path/to/.env.production \
  daoyou-app:local
```

注意：

- `VITE_API_BASE_URL` 是前端 Pages 构建期变量，不进入后端 Docker 镜像
- 服务运行时环境变量通过 shell、容器环境或 `--env-file` 注入

## 仓库内现成部署脚本

### Hono API 蓝绿发布

```bash
APP_IMAGE=swkzymlyy/daoyou-app:<version> \
ENV_FILE=/root/daoyou/.env.production \
./scripts/blue-green-app.sh
```

这个脚本会：

- 在 `daoyou-app-blue` / `daoyou-app-green` 间部署闲置颜色
- 同时验证 Docker health 与宿主机 `/api/health-check`
- 通过 `nginx -t` 后原子切换 OpenResty upstream
- 短暂 drain 后停止旧颜色容器

生产 Compose 只定义 `app-blue` 和 `app-green`；实时战斗与 API 随同一 Bun 主服务蓝绿发布； `blue-green-app.sh` 通过 Compose 启动闲置 app profile 并切换 OpenResty。React SPA 仍由 Cloudflare Pages 独立部署。

## 生产 cron 配置方式

当前仓库默认采用两层设计：

- 生产环境中 `src/index.ts` 注册 Bun 内置 cron，Cron 只发布 JetStream command，durable Worker consumer 执行 job runner
- `/internal/cron/*` 仍然保留，便于手动触发、联调，或后续切回外部调度器

- `GET /internal/cron/auction-expire`
- `GET /internal/cron/bet-battle-expire`
- `GET /internal/cron/rank-rewards`
- `GET /internal/cron/market-refresh`
- `GET /internal/cron/tower-enemy-sets`
- `GET /internal/cron/player-state-events-cleanup`
- `GET /internal/cron/expired-data-cleanup`

当前内置调度频率：

- `auction-expire`：每 2 分钟
- `bet-battle-expire`：每 2 分钟
- `rank-rewards`：每天 `00:00 Asia/Shanghai`
- `market-refresh`：每 5 分钟
- `tower-enemy-sets`：每小时
- `player-state-events-cleanup`：每天 `02:30 Asia/Shanghai`
- `expired-data-cleanup`：每天 `02:45 Asia/Shanghai`

说明：

- Bun 内置 cron 仍运行在 Web 进程内，但实际任务已与调度回调解耦；发布成功的 command 由 JetStream 持久化并可跨应用重启继续执行
- Bun 的 cron 表达式按 `UTC` 解释，所以 `rank-rewards` 在代码里配置为 `0 16 * * *`，对应北京时间次日 `00:00`
- 内置调度不直接调用 job runner，也不走 HTTP；它发布 `daoyou.command.cron.>` command
- `/internal/cron/*` 接口继续要求 `Authorization: Bearer ${CRON_SECRET}`，适合人工补跑或外部调度
- 这些任务内部带 Redis 分布式锁与幂等保护，重复触发会返回 `skipped`

如果你想改回外部 HTTP 调度，可使用：

```cron
*/2 * * * * curl -fsS -H "Authorization: Bearer ${CRON_SECRET}" https://your-domain/internal/cron/auction-expire
*/2 * * * * curl -fsS -H "Authorization: Bearer ${CRON_SECRET}" https://your-domain/internal/cron/bet-battle-expire
0 0 * * * curl -fsS -H "Authorization: Bearer ${CRON_SECRET}" https://your-domain/internal/cron/rank-rewards
*/5 * * * * curl -fsS -H "Authorization: Bearer ${CRON_SECRET}" https://your-domain/internal/cron/market-refresh
0 * * * * curl -fsS -H "Authorization: Bearer ${CRON_SECRET}" https://your-domain/internal/cron/tower-enemy-sets
30 2 * * * curl -fsS -H "Authorization: Bearer ${CRON_SECRET}" https://your-domain/internal/cron/player-state-events-cleanup
45 2 * * * curl -fsS -H "Authorization: Bearer ${CRON_SECRET}" https://your-domain/internal/cron/expired-data-cleanup
```

## CI / 镜像发布

当前仓库的 [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml) 会在 `master` 分支推送时：

- 构建 Docker 镜像
- 推送到 Docker Hub

## 架构原则

- 引擎层（`src/shared/engine`）完全独立于 UI 和框架
- 业务逻辑放在 Service 层
- 数据访问使用 Repository 模式
