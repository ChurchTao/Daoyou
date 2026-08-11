# 万界道友

<p align="center">
  <img src="public/assets/daoyou_logo.webp" alt="万界道友 Logo" width="200" />
</p>

<p align="center">
  <strong>一款 AIGC 驱动、高自由度文字体验、修仙世界观的开源游戏项目。</strong>
</p>

> 本仓库当前实现为 `Hono + React SPA`。  
> 这里的说明以现有代码为准，已不再适用于旧版 Next.js 架构。

---

## 项目愿景

**《万界道友》** 旨在打造一套"修仙宇宙的开源骨架"。它不仅是一个可以直接游玩的文字修仙游戏，更是一套高度结构化、AIGC 友好的底层架构。我们希望通过**高自由度的输入 + AIGC 反馈**，结合**严格的数值与战斗模型**，让创作者能够在此基础上快速搭建属于自己的修仙世界。

- **玩法层面**：鼓励玩家通过文字描述塑造角色，AI 实时生成反馈，带来"千人千面"的体验。
- **系统层面**：保持系统的稳定、正交与可组合性，确保数值平衡与逻辑自洽。
- **表现层面**：坚持"文字即界面"，采用水墨意境 UI，适配移动端体验。

## 核心特色

- 🤖 **AIGC 深度集成**：角色背景、战斗播报、奇遇故事、物品描述全流程 AI 生成，每一次体验都独一无二。当前统一使用 DeepSeek。
- ⚔️ **深度战斗引擎**：基于时间轴的回合制战斗，支持神通、法宝、状态效果（Buff/Debuff）、五行克制、伤害管道等复杂机制。
- ☯️ **严谨修仙体系**：完整的境界（炼气至渡劫）、灵根（金木水火土风雷冰）、功法、命格、炼丹炼器系统。
- 📱 **水墨风 UI**：基于 `Ink` 组件库（21 个组件）打造的纯文字 UI，简洁优雅，沉浸感强。
- 🛠️ **开发者友好**：清晰的分层架构（Engine/Service/API），TypeScript 全栈开发，易于扩展与二创。

## 🖼 游戏画面

<p align="center">
  <img src="https://page-r2.daoyou.org/index/Xnip2026-02-02_18-45-05.png" alt="游戏主界面" width="260" />
  <img src="https://page-r2.daoyou.org/index/Xnip2026-02-02_18-50-45.png" alt="主界面下方信息" width="260" />
  <img src="https://page-r2.daoyou.org/index/Xnip2026-02-02_19-03-00.png" alt="修仙界大地图" width="260" />
</p>

<p align="center">
  <img src="https://page-r2.daoyou.org/index/Xnip2026-02-02_19-01-06.png" alt="造物仙炉" width="260" />
  <img src="https://page-r2.daoyou.org/index/Xnip2026-02-02_19-01-32.png" alt="藏经阁" width="260" />
  <img src="https://page-r2.daoyou.org/index/Xnip2026-02-02_19-02-21.png" alt="云游坊市" width="260" />
</p>

## 当前技术栈

- 服务端：`Hono 4` + `Bun`
- 前端：`React 19` + `React Router 7` + `Vite 8`
- 样式：`Tailwind CSS 4`
- 数据库：`PostgreSQL` + `Drizzle ORM`
- 认证：`Better Auth`
- 缓存 / 分布式协调：`Redis`
- 消息与实时广播：`NATS JetStream` + `NATS Core`
- AI 能力：`AI SDK` + `DeepSeek`

## 当前目录结构

```text
.
├── src/index.ts                 # Bun 后端入口，导出 Hono API 与 WebSocket 配置
├── src/server/                  # Hono API、认证、服务层、数据库访问
├── src/react-app/               # React SPA
├── src/shared/                  # 共享引擎、配置、类型、契约
├── drizzle/                     # 业务表 Drizzle migrations
├── drizzle-auth/                # Better Auth Drizzle migrations
├── drizzle.auth.config.ts       # Better Auth 独立迁移配置
├── scripts/                     # 部署脚本、生产/NATS Compose 与战斗 E2E
├── docker/
│   ├── Dockerfile.app
│   └── Dockerfile.battle
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
- `Redis`：API 的部分能力按需使用；独立 battle-server 将其作为在线对局的启动硬依赖
- `NATS`：进程启动硬依赖；JetStream 承载领域事件、异步投影和后台 command，Core 承载跨实例实时广播

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

独立实时战斗服务由 Node.js 运行构建产物；生产环境还必须配置：

| 变量 | 说明 |
| --- | --- |
| `BATTLE_SERVER_PORT` | battle-server 监听端口，默认 `3100` |
| `BATTLE_SERVER_ORIGINS` | 允许连接 Socket.IO 的玩家前端 origin，逗号分隔 |
| `BATTLE_SERVER_API_ORIGINS` | 允许调用 Lobby API 的应用服务 origin；CORS 不是鉴权 |
| `BATTLE_SERVER_API_TOKEN` | 应用服务 / matchmaker 调用 Lobby API 时使用的独立 Bearer 密钥 |
| `BATTLE_SERVER_URL` | Hono Session Gateway 调用 battle-server 的内网地址 |
| `BATTLE_SERVER_PUBLIC_ORIGIN` | 返回给浏览器建立 Socket.IO 连接的公网地址 |
| `REDIS_URL` | 在线对局唯一权威状态、邀请、凭据、截止时间与恢复索引 |
| `NATS_SERVERS` / `NATS_USER` / `NATS_PASSWORD` | 结束对局回放归档使用的 JetStream |

客户端不得直接调用 boardgame.io 的 `/games/*` Lobby API，也不得持有上述 token。
应用侧 matchmaker 负责创建对局、预占 player slot 并把对应的 boardgame 凭据通过已认证的
业务接口交给正确玩家；Socket.IO 连接只使用该玩家自己的凭据。

实时战斗的数据边界固定为：`battle-v5` 只做确定性规则解析，boardgame.io 只做协议与编排；
进行中的 `G / ctx / _stateID`、选招、锁定、邀请和回放素材只在 Redis。对局结束后 battle-server
将 `BattleReplayV1` 发布到 NATS JetStream，应用侧 durable consumer 异步、幂等写入
`wanjiedaoyou_battle_replay_archives`。玩家 move 链路不查询或写入 PostgreSQL，也不使用 Redis Stream。

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

当前鉴权中，以下接口会强制要求 Turnstile token：

- `/api/auth/sign-in/email`
- `/api/auth/sign-up/email`
- `/api/auth/request-password-reset`
- `/api/auth/email-otp/send-verification-otp`

因此前端若不配置 Turnstile，相关表单无法正常工作。

| 变量 | 说明 |
| --- | --- |
| `VITE_API_BASE_URL` | 前端构建时注入的后端 API 基地址，如 `https://api.example.com` |
| `VITE_TURNSTILE_SITE_KEY` | 前端构建时注入；没有它，登录/注册/找回密码页不会渲染验证码组件 |
| `TURNSTILE_SECRET_KEY` 或 `TURNSTILE_SECRET` | 服务端校验 Turnstile 的密钥；未配置时服务端仍要求 token，但不会调用 Cloudflare 做真正校验 |

### 邮件能力

邮箱验证码、密码注册验证邮件、重置密码邮件、后台邮件广播都会使用SMTP。密码注册必须完成邮箱验证后才能登录；验证链接完成后会自动登录：

| 变量 | 说明 |
| --- | --- |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` | SMTP 连接配置 |
| `SMTP_USER` / `SMTP_PASS` | SMTP 认证信息 |
| `MAIL_FROM` | 发件人 |

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

生产硬切顺序、Stream/consumer、DLQ 和故障检查参见 [`docs/nats-domain-events.md`](docs/nats-domain-events.md)。

访问：

- 前端页面：`http://localhost:5173`
- 健康检查：`http://localhost:5173/api/health-check`

`bun run dev` 会同时启动三个进程：Vite 提供前端页面，Bun 在本地提供 Hono API，独立 battle-server 提供实时战斗；Vite 将 `/api` 和 `/internal` 代理到 Bun API 服务。battle-server 默认监听 `3100`，由 `BATTLE_SERVER_*` 环境变量控制。

本地 NATS 使用 JetStream 文件卷保存消息和 durable consumer 的投递位点。启动时发现历史消息是预期行为；回放归档和事务消息会在 PostgreSQL 可用后继续消费。若 PostgreSQL 暂时不可用，事务消息恢复器会以 5 秒至 60 秒退避重试，避免连接超时期间持续打满连接池；不应通过删除 NATS 数据卷来规避数据库故障。

## 构建与运行

| 命令 | 作用 |
| --- | --- |
| `bun run dev` | 启动 Vite、API 和 Node.js battle-server 本地开发进程 |
| `bun run build` | 依次构建前端与服务端 |
| `bun run build:client` | 构建 Cloudflare Pages 使用的前端 SPA |
| `bun run build:server` | 构建 Docker 使用的 Bun/Hono 后端 |
| `bun run build:battle` | 使用 Vite SSR 构建 Node LTS battle-server 到 `dist-battle/battle-server.js` |
| `bun run battle:server` | 使用 Node.js 启动已构建的独立战斗服务，默认监听 `3100` |
| `bun run battle:smoke` | 验证 2v2、4v4、超时与真实 Socket.IO 同步流程 |
| `bun run preview` | 先构建，再运行 `dist/index.js` |
| `bun run start` | 直接运行已构建产物 |
| `bun run lint` | ESLint 检查 |
| `bun run test` | Vitest |
| `bun run auth:generate` | 生成 `better_auth` Drizzle 迁移 |
| `bun run auth:migrate` | 执行 `better_auth` 独立迁移流 |

构建产物：

- `build:client` 产出前端 SPA
- `build:server` 产出 Bun 运行的 Hono 服务入口 `dist/index.js`

## Docker

React SPA 继续独立部署到 Cloudflare Pages，不进入任何后端镜像。主服务与
battle-server 使用独立镜像：`app`（`3000`）使用 Bun，`battle`（`3100`）使用
Node.js LTS；battle-server 只连接 Redis 与 NATS，不连接 PostgreSQL，并只负责编排实时对局；
`battle-v5` 仍是无框架依赖的纯战斗引擎。PostgreSQL 回放归档由应用侧 NATS consumer 完成。

本地构建镜像：

```bash
docker build -t daoyou-app:local -f docker/Dockerfile.app .
docker build -t daoyou-battle:local -f docker/Dockerfile.battle .
```

运行镜像：

```bash
docker run --rm -p 3000:3000 \
  --env-file /path/to/.env.production \
  daoyou-app:local
```

注意：

- `VITE_API_BASE_URL` 和 `VITE_TURNSTILE_SITE_KEY` 是前端 Pages 构建期变量，不进入后端 Docker 镜像
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

### battle-server 独立发布

```bash
BATTLE_IMAGE=swkzymlyy/daoyou-battle:<version> \
ENV_FILE=/root/daoyou/.env.production \
./scripts/deploy-battle.sh
```

这个脚本会：

- 使用 `scripts/docker-compose.production.yml` 更新稳定的 battle 服务
- 轮询容器 health 和 `/healthz`
- 不参与 Hono API 的蓝绿 upstream 切换

### 查看 battle 服务

```bash
ENV_FILE=/root/daoyou/.env.production \
docker compose -f scripts/docker-compose.production.yml ps
```

生产 Compose 显式定义 `app-blue`、`app-green` 和稳定的 battle 服务；
`blue-green-app.sh` 通过 Compose 启动闲置 app profile 并切换 OpenResty。
React SPA 仍由 Cloudflare Pages 独立部署。

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

当前仓库的 [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) 会在 `master` 分支推送时：

- 构建 Docker 镜像
- 推送到 Docker Hub

## 贡献指南

欢迎道友们共建这个修仙世界！

1. Fork 本仓库。
2. 创建特性分支 (`git checkout -b feature/NewFeature`)。
3. 提交更改 (`git commit -m 'Add some NewFeature'`)。
4. 推送到分支 (`git push origin feature/NewFeature`)。
5. 提交 Pull Request。

- **架构原则**：
  - 引擎层（`engine/`）完全独立于 UI 和框架
  - 业务逻辑放在 Service 层
  - 数据访问使用 Repository 模式

## 💬 交流群

欢迎加入《万界道友》QQ交流群，与其他道友共同探讨修仙大计:

- 1群: 1107586928

## 💖 赞助与鸣谢

感谢每一位帮助《万界道友》持续维护与成长的道友。新的赞助统一通过 [爱发电](https://afdian.com/u/baef2b20501311f09da252540025c377) 进行；具体规则请见 [赞助说明](SPONSORING.md)，公开赞助人名单与历史鸣谢请见 [SPONSORS.md](SPONSORS.md)。

赞助名单不会展示支付信息或具体金额，赞助不会影响游戏数值、账号权益或项目决策权。

## 🤝 致谢

特别鸣谢以下贡献者：

- [tpoisonooo](https://github.com/tpoisonooo)：在 [Issue #25](https://github.com/ChurchTao/Daoyou/issues/25) 中提供了宝贵的 LLM 优化思路与方法论，极大地提升了游戏的 AIGC 体验。

## 开源协议

本项目采用 [GNU General Public License v3.0](LICENSE) 协议开源。

这意味着你可以自由地：

- 共享：在任何媒介或格式下复制和分发材料
- 改编：混合、转换和构建材料

但必须遵守以下条款：

- **署名**：必须提供适当的归属。
- **相同方式共享**：如果你混合、转换或基于该材料进行构建，你必须在相同的协议下分发你的贡献。

详情请查阅 [LICENSE](LICENSE) 文件。

---

<p align="center">
  愿你在万界中得一二知己，共证长生。
</p>
