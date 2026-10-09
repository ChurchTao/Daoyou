# 本地开发与部署

> 本页整理《万界道友》的本地开发、环境变量、数据库、构建、Docker、部署脚本与生产 cron 配置。项目简介、玩法、截图与赞助信息见 [README](../README.md)。

## 目录结构

```text
.
├── apps/api/src/main.ts      # Node/Nest 后端入口与原生 WebSocket 配置
├── apps/api/src/                  # Nest 模块、认证、服务层、数据库访问
├── apps/web/src/               # React SPA
├── packages/shared/src/                  # 共享引擎、配置、类型、契约
├── drizzle/                     # 业务表 Drizzle migrations
├── drizzle-auth/                # Better Auth Drizzle migrations
├── drizzle.auth.config.ts       # Better Auth 独立迁移配置
├── scripts/                     # 部署脚本与生产/NATS Compose
├── docker/Dockerfile.app        # Node/Nest 主服务镜像
└── vite.config.ts
```

## 运行方式

这个仓库不是 SSR 应用。

- `apps/web/src` 使用 `BrowserRouter` 管理前端路由
- `apps/api/src/app.module.ts`组织提供`/api/*`和`/internal/*`接口的功能模块
- Nest运行时模块在生产环境注册UTC定时任务；Cron只向NATS WorkQueue发布后台command
- 前端 SPA 独立部署到 Cloudflare Pages；后端 Docker 不再服务 `index.html` 或静态资源

当前路由约定：

- `/api/*`：游戏与后台 API
- `/api/auth/*`：Better Auth
- `/internal/cron/*`：内部定时任务接口
- `/api/health-check`：健康检查
- 其余如 `/login`、`/game`、`/admin`：Cloudflare Pages 上的前端 SPA 路由

## 环境要求

- `pnpm 12.10.1`（workspace依赖管理；Turborepo编排任务）
- `Node.js 24.18+`（Nest运行时）
- `PostgreSQL`
- `Redis`：在线对局、邀请、截止时间、恢复索引和 API 部分能力的权威存储
- `NATS`：进程启动硬依赖；JetStream 承载领域事件、异步投影、后台 command、战斗演算指针、终态清理和回放归档，Core 只承载可丢失的跨实例实时提示

说明：

- 仓库使用 pnpm workspace 与单一 pnpm-lock.yaml；框架为 NestJS + React SPA
- 专用本地开发前端端口是 `5174`，预发布调试默认 `5173`
- 构建后服务默认端口是 `3000`

## 安装

推荐使用[纯本地开发与预发布隔离](./local-development.md)：启停服务、迁移数据库和启动应用分别执行。`dev` 组读取 `env/local.env`，`prd` 组读取 `env/staging.env`；浏览器自动化遵循[测试规范](./testing.md)。

```bash
pnpm install
pnpm run services up -d --wait
pnpm run db:migrate
pnpm run dev
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

实时战斗由 Node/Nest 主服务直接承载；生产环境还必须配置：

| 变量 | 说明 |
| --- | --- |
| `REDIS_URL` | 在线对局唯一权威状态、邀请、凭据、截止时间与恢复索引 |
| `NATS_SERVERS` / `NATS_USER` / `NATS_PASSWORD` | 战斗演算、终态清理和回放归档使用的 JetStream，以及跨实例状态提示使用的 NATS Core |

原生WebSocket升级验证Better Auth会话、Origin和参与／观战权限，客户端不能自行声明玩家身份。`combat-v6`共享引擎保持确定性，Nest负责传输与生命周期，现有应用服务保留战斗编排。进行中的V6战斗以Redis为权威，保留CAS与占用锁；终态投影与回放归档继续通过NATS和现有幂等处理写入`combat_replay_archives`／`combat_replay_participants`。框架迁移不更换战斗协议、奖励事务或持久化模型。

### 建议同时配置

| 变量 | 说明 |
| --- | --- |
| `REDIS_URL` | Redis 连接串；缺失时相关功能会在运行时失败 |
| `API_IP_RATE_LIMIT_WINDOW_SECONDS` | `/api/*` 全局 IP 令牌桶补充周期秒数；默认 `60` |
| `API_IP_RATE_LIMIT_MAX_REQUESTS` | `/api/*` 同 IP 令牌桶容量和每周期补充 token 数；默认 `300` |
| `PUBLIC_WEB_ORIGINS` | 允许访问 API 的前端 origin，逗号分隔，如 `https://app.example.com,http://localhost:5173` |
| `BETTER_AUTH_COOKIE_DOMAIN` | 可选；同站子域部署时可填 `.example.com`；跨站模式必须取消设置 |
| `BETTER_AUTH_CROSS_SITE_COOKIES` | 默认关闭；设为 `true` 启用 `SameSite=None; Secure; HttpOnly`，要求 `BETTER_AUTH_URL` 为 HTTPS |
| `ADMIN_EMAILS` | 管理员邮箱白名单，逗号分隔 |
| `ADMIN_USER_IDS` | Better Auth 管理员用户 ID 白名单，逗号分隔；账号管理工具必须配置 |

### 生产 cron 必需

| 变量 | 说明 |
| --- | --- |
| `CRON_SECRET` | 保护 `/internal/cron/*` 接口的 Bearer 密钥；生产环境必须配置，调度器调用时也要携带它 |

### 登录 / 注册相关

配置 `ALTCHA_HMAC_SECRET` 后，以下接口强制要求 ALTCHA PoW payload；未配置或为空时跳过人机验证：

- `/api/auth/sign-in/email`
- `/api/auth/sign-up/email`
- `/api/auth/request-password-reset`
- `/api/auth/email-otp/send-verification-otp`

前端通过 `/api/captcha/challenge` 获取带场景和过期时间的 challenge，完成 PoW 后把 payload 发送给认证接口。服务端会验证签名、场景和有效期，并通过 Redis 原子记录 challenge 的单次消费状态，防止重放。

| 变量 | 说明 |
| --- | --- |
| `VITE_API_BASE_URL` | 前端构建时注入的后端 API 基地址，如 `https://api.example.com` |
| `ALTCHA_HMAC_SECRET` | 服务端签发和验证 ALTCHA challenge 的独立 HMAC 密钥；是否配置决定是否启用人机验证 |

ALTCHA 不需要前端 site key。认证 CAPTCHA 启用时 Redis 也是强依赖；Redis 不可用时，受保护的认证请求会失败关闭，避免 challenge 被重复使用。

### 邮件能力

邮箱验证码、密码注册验证邮件、重置密码邮件、后台邮件广播都会使用SMTP。密码注册必须完成邮箱验证后才能登录；验证链接完成后会自动登录：

| 变量                                      | 说明          |
| ----------------------------------------- | ------------- |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` | SMTP 连接配置 |
| `SMTP_USER` / `SMTP_PASS`                 | SMTP 认证信息 |
| `MAIL_FROM`                               | 发件人        |

### AI 能力

AI 相关功能支持 DeepSeek 与阿里云百炼（Qwen），统一通过 `aiClient.ts` 调用。服务端只认一张路由表：

`LLM_PROVIDER=<provider>[/<model>][:<weight>][,...]`

| 需求 | 配置 |
| --- | --- |
| 单供应商单模型 | `alibaba` 或 `alibaba/qwen3.7-flash` |
| 单供应商多模型 | `alibaba/qwen3.7-flash:70,alibaba/qwen-plus:30` |
| 多供应商单模型 | `alibaba/qwen3.7-flash:70,deepseek/deepseek-v4-flash:30` |
| 多供应商多模型 | `alibaba/qwen3.7-flash:50,alibaba/qwen-plus:20,deepseek/deepseek-v4-flash:30` |

规则：

- 省略 `/model` 时用该供应商默认模型（`qwen3.7-flash` / `deepseek-v4-flash`）
- 省略 `:weight` 时该条权重为 `1`（等权）
- 多于一条路由时，按用户 id 做稳定 hash 分流；同一用户始终命中同一条 `provider + model`
- 无用户上下文（如 cron）时落到当前权重最高的路由
- 列出的每个供应商都必须配置对应 API Key
- 未设置 `LLM_PROVIDER` 时自动回退：有 `ALIBABA_API_KEY` 用 `alibaba`，否则有 `DEEPSEEK_API_KEY` 用 `deepseek`
- 玩家 BYOK 仍优先生效，不走服务端分流

其它变量：

- `ALIBABA_API_KEY`：阿里云百炼 API Key
- `ALIBABA_BASE_URL`：可选，默认国内北京 `https://dashscope.aliyuncs.com/compatible-mode/v1`
- `DEEPSEEK_API_KEY`：DeepSeek API Key

玩家也可以在游戏设置中保存自己的供应商、API Key 与模型。BYOK 配置只保存在当前浏览器；请求携带的 provider 必须是服务端白名单枚举，baseURL 不能由客户端指定。配置不完整或格式无效时服务端返回 400，不会静默消耗服务器额度。

## 数据库初始化

首次启动通常要做两件事：

1. Better Auth 表迁移
2. 应用业务表迁移

```bash
pnpm run db:migrate
```

说明：

- 本地命令从 `env/local.env` 加载配置；独立的 Drizzle／认证工具需由进程环境或 `node --env-file=...` 显式提供配置
- `drizzle/` 目录下已经存在业务表迁移文件
- `drizzle/` 只管理 `wanjiedaoyou_*` 业务表
- `drizzle-auth/` 只管理固定 `better_auth` schema，并使用独立迁移历史表
- `pnpm run auth:migrate` 使用 `drizzle.auth.config.ts` 执行认证迁移
- `pnpm run auth:generate` 用于认证 Drizzle schema 变更后生成迁移，不是每次启动都要执行
- 升级部署时先执行 `pnpm run auth:migrate` 建立认证基线，再部署使用共享node-postgres连接池的新版本

## 本地开发

1. 准备好 `env/local.env`
2. 确保数据库、Redis 和 NATS JetStream 可连接
3. 执行迁移
4. 启动开发服务器

```bash
pnpm run services up -d --wait
pnpm run dev
```

专用本地 NATS 监听 `14222`，监控端口为 `18222`；开发凭据与 `env/local.env` 一致。持久数据保存在 `daoyou-local` 专用卷中。

生产硬切顺序、Stream/consumer、DLQ 和故障检查参见 [nats-domain-events.md](nats-domain-events.md)。

访问：

- 前端页面：`http://127.0.0.1:5174`
- 健康检查：`http://127.0.0.1:5174/api/health-check`

`pnpm run dev` 会同时启动 Vite 前端和 Node/Nest 主服务；Vite 将 `/api`、`/internal` 与 WebSocket 升级代理到Nest服务。

本地 NATS 使用 JetStream 文件卷保存消息和 durable consumer 的投递位点。启动时发现历史消息是预期行为；回放归档和事务消息会在 PostgreSQL 可用后继续消费。若 PostgreSQL 暂时不可用，事务消息恢复器会以 5 秒至 60 秒退避重试，避免连接超时期间持续打满连接池；不应通过删除 NATS 数据卷来规避数据库故障。

## 构建与运行

| 命令 | 作用 |
| --- | --- |
| `pnpm run dev` | 启动 Vite 与 Node/Nest 主服务 |
| `pnpm run dev:api` / `dev:web` | 独立启动本地 API／Web |
| `pnpm run prd` / `prd:api` / `prd:web` | 使用预发布配置启动两者／仅 API／仅 Web |
| `pnpm run build` | 通过Turbo构建前端与服务端 |
| `pnpm run build:client` | 构建 Cloudflare Pages 使用的前端 SPA |
| `pnpm run build:server` | 构建 Docker 使用的 Node/Nest 后端 |
| `pnpm run lint` | ESLint 检查 |
| `pnpm run typecheck` | API、Web、共享源码与维护工具类型检查 |
| `pnpm run test` | Vitest |
| `pnpm run services up -d --wait` / `down` | 启停本地依赖服务 |
| `pnpm run db:migrate` | 使用选定环境依次迁移认证与业务表 |
| `pnpm run auth:generate` | 生成 `better_auth` Drizzle 迁移 |
| `pnpm run auth:migrate` | 执行 `better_auth` 独立迁移流 |

构建产物：

- `build:client`在 `apps/web` 使用Vite，产出SPA至 `apps/web/dist`
- `build:server`在 `apps/api` 执行 `nest build`（CLI 12 ESM Rspack），产出Node运行的Nest服务入口`apps/api/dist/main.js`，需配套生产node_modules

## Docker

React SPA继续独立部署到Cloudflare Pages，不进入后端镜像。`app`（`3000`）使用Node 24运行Nest API与原生WebSocket；`combat-v6`保持独立于框架。镜像以非root用户运行，仅包含Node、生产依赖与编译产物。PostgreSQL回放归档继续由应用侧NATS consumer完成。

本地构建镜像：

```bash
docker build -t daoyou-app:local -f docker/Dockerfile.app .
```

运行镜像：

```bash
docker run --rm --stop-timeout 75 -p 3000:3000 \
  --env-file /path/to/.env.production \
  daoyou-app:local
```

注意：

- `VITE_API_BASE_URL` 是前端 Pages 构建期变量，不进入后端 Docker 镜像
- 服务运行时环境变量通过 shell、容器环境或 `--env-file` 注入

## 仓库内现成部署脚本

### Nest API 蓝绿发布

标签推送构建镜像时同时写入版本标签、`sha-<完整提交SHA>`和`latest`。部署时指定版本／SHA或镜像digest，并记录上一版本；回滚使用同一脚本传入上一镜像。Nest镜像使用Node健康检查和75秒停机宽限期。若回滚到迁移前的Bun镜像，须同时恢复该版本的Compose健康检查（旧镜像不保证包含Node）。仓库命令切换不代表已经发布生产，当前验收状态见[迁移记录](nestjs-migration.md)。

```bash
APP_IMAGE=swkzymlyy/daoyou-app:<version> \
ENV_FILE=/root/daoyou/.env.production \
./scripts/blue-green-app.sh
```

这个脚本会：

- 在 `daoyou-app-blue` / `daoyou-app-green` 间部署闲置颜色
- 同时验证 Docker health 与宿主机 `/api/health-check`
- 写入目标 upstream 配置，经 `nginx -t` 校验后 reload OpenResty；校验或 reload 失败时恢复备份
- 短暂 drain 后停止旧颜色容器

生产 Compose 只定义 `app-blue` 和 `app-green`；实时战斗与 API 随同一Node/Nest主服务蓝绿发布； `blue-green-app.sh` 通过 Compose 启动闲置 app profile 并切换 OpenResty。React SPA 仍由 Cloudflare Pages 独立部署。

## 生产 cron 配置方式

当前仓库默认采用两层设计：

- 生产环境中Nest `CronService`按`apps/api/src/lib/jobs/schedules.ts`注册UTC调度，Cron只发布JetStream command，durable Worker consumer执行job runner
- `/internal/cron/*` 仍然保留，便于手动触发、联调，或后续切回外部调度器

当前十项调度与手动入口如下。HTTP入口均为`GET /internal/cron/<路径>`；频率以`apps/api/src/lib/jobs/schedules.ts`为准，入口以`apps/api/src/runtime/internal-cron.controller.ts`为准。

| HTTP路径 | 后台command | 频率（Asia/Shanghai） |
| --- | --- | --- |
| `auction-expire` | `auction.expire` | 每2分钟 |
| `rank-rewards` | `ranking.rewards.distribute` | 每天00:00 |
| `market-refresh` | `market.refresh` | 每5分钟 |
| `resource-replay-cleanup` | `resource-replay.cleanup` | 每天02:30 |
| `expired-data-cleanup` | `expired-data.cleanup` | 每天02:45 |
| `material-library-daily-generation` | `material-library.generate` | 每天01:00 |
| `sponsorship-reconcile` | `sponsorship.reconcile` | 每10分钟 |
| `sponsorship-deep-reconcile` | `sponsorship.deep-reconcile` | 每天03:15 |
| `sponsorship-cleanup` | `sponsorship.cleanup` | 每天03:30 |
| `sponsorship-admin-digest` | `sponsorship.admin-digest` | 每天09:00 |

说明：

- Nest Schedule仍运行在Web进程内，但实际任务已与调度回调解耦；发布成功的 command 由 JetStream 持久化并可跨应用重启继续执行
- 调度显式使用`UTC`时区，所以 `rank-rewards` 在代码里配置为 `0 16 * * *`，对应北京时间次日 `00:00`
- 内置调度不直接调用 job runner，也不走 HTTP；它发布 `daoyou.command.cron.>` command
- `/internal/cron/*` 接口继续要求 `Authorization: Bearer ${CRON_SECRET}`，适合人工补跑或外部调度
- 这些任务内部带 Redis 分布式锁与幂等保护，重复触发会返回 `skipped`

需要外部HTTP调度时，先明确停用内置调度的方案；当前没有独立开关，不能仅添加以下配置就视为已切换。下面仅列前三项等价请求，完整十项需按上表配置；crontab时区为Asia/Shanghai：

```cron
*/2 * * * * curl -fsS -H "Authorization: Bearer ${CRON_SECRET}" https://your-domain/internal/cron/auction-expire
0 0 * * * curl -fsS -H "Authorization: Bearer ${CRON_SECRET}" https://your-domain/internal/cron/rank-rewards
*/5 * * * * curl -fsS -H "Authorization: Bearer ${CRON_SECRET}" https://your-domain/internal/cron/market-refresh
```

## CI / 镜像发布

当前仓库的 [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml) 会在推送任意Git标签时：

- 构建 Docker 镜像
- 推送到 Docker Hub

工作流为镜像写入Git标签、完整提交SHA标签及`latest`，不会自动运行服务器蓝绿脚本，也没有独立的lint／共享测试质量门禁。Docker构建包含服务端类型检查与构建；完整前后端构建、lint和共享测试仍需在发布前执行。

## 架构原则

- 引擎层（`packages/shared/src/engine`）完全独立于 UI 和框架
- 业务逻辑放在 Service 层
- 数据访问使用 Repository 模式
