# 万界道友

<p align="center">
  <img src="public/assets/daoyou_logo.png" alt="万界道友 Logo" width="200" />
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

- 🤖 **AIGC 深度集成**：角色背景、战斗播报、奇遇故事、物品描述全流程 AI 生成，每一次体验都独一无二。支持 DeepSeek、火山引擎 ARK、Kimi 三种 AI Provider。
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
- 缓存 / 定时任务依赖：`Redis`
- AI 能力：`AI SDK` + `DeepSeek / ARK / Kimi / Alibaba / OpenRouter / OpenAI-compatible`

## 当前目录结构

```text
.
├── src/index.ts                 # 根 Hono 应用，生产环境负责 SPA fallback
├── src/server/                  # Hono API、认证、服务层、数据库访问
├── src/react-app/               # React SPA
├── src/shared/                  # 共享引擎、配置、类型、契约
├── drizzle/                     # Drizzle SQL migrations
├── scripts/                     # Docker 启停脚本
├── Dockerfile
├── docker-compose.yml
└── vite.config.ts
```

## 运行方式

这个仓库不是 SSR 应用。

- `src/react-app` 使用 `BrowserRouter` 管理前端路由
- `src/server/app.ts` 提供 `/api/*` 和 `/internal/*` 接口
- `src/index.ts` 在生产环境对非 API 的 `GET/HEAD` 请求返回 `dist/index.html`，由前端 SPA 接管路由

当前路由约定：

- `/api/*`：游戏与后台 API
- `/api/auth/*`：Better Auth
- `/internal/cron/*`：内部定时任务接口
- `/api/health-check`：健康检查
- 其余如 `/login`、`/game`、`/admin`：前端 SPA 路由

## 环境要求

- `Bun 1.3+`
- `PostgreSQL`
- `Redis`：不是进程启动硬依赖，但排行榜、世界聊天、部分定时任务等功能会用到

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
| `BETTER_AUTH_URL` | Better Auth 对外基准地址；本地开发通常填 `http://localhost:5173`，构建后本地运行通常填 `http://localhost:3000` |

### 建议同时配置

| 变量 | 说明 |
| --- | --- |
| `REDIS_URL` | Redis 连接串；缺失时相关功能会在运行时失败 |
| `CRON_SECRET` | 保护 `/internal/cron/*` 接口；不配置时这些接口不会做 Bearer 校验 |
| `BETTER_AUTH_DB_SCHEMA` | Better Auth schema 名；默认值为 `better_auth` |
| `ADMIN_EMAILS` | 管理员邮箱白名单，逗号分隔 |

### 登录 / 注册相关

当前鉴权中，以下接口会强制要求 Turnstile token：

- `/api/auth/sign-in/email`
- `/api/auth/sign-up/email`
- `/api/auth/request-password-reset`
- `/api/auth/email-otp/send-verification-otp`

因此前端若不配置 Turnstile，相关表单无法正常工作。

| 变量 | 说明 |
| --- | --- |
| `VITE_TURNSTILE_SITE_KEY` | 前端构建时注入；没有它，登录/注册/找回密码页不会渲染验证码组件 |
| `TURNSTILE_SECRET_KEY` 或 `TURNSTILE_SECRET` | 服务端校验 Turnstile 的密钥；未配置时服务端仍要求 token，但不会调用 Cloudflare 做真正校验 |

### 邮件能力

邮箱验证码、重置密码邮件、后台邮件广播都会使用 SMTP：

| 变量 | 说明 |
| --- | --- |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` | SMTP 连接配置 |
| `SMTP_USER` / `SMTP_PASS` | SMTP 认证信息 |
| `MAIL_FROM` | 发件人 |

### AI 能力

AI 相关功能按 `PROVIDER_CHOOSE` 选择 provider：

- `deepseek`
- `ark`
- `kimi`
- `alibaba`
- `openrouter`
- 其他情况走 `OPENAI_API_KEY` / `OPENAI_BASE_URL` / `OPENAI_MODEL`

请按所选 provider 配置对应的 `*_API_KEY`、`*_BASE_URL`、`*_MODEL_USE`、`*_MODEL_FAST_USE`。

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
- `bun run auth:migrate` 使用 `src/server/lib/auth/auth.ts` 中的 Better Auth 配置执行迁移
- `bun run auth:generate` 用于在认证 schema 变更后重新生成 `better-auth.schema.sql`，不是每次启动都要执行

## 本地开发

1. 准备好 `.env.local`
2. 确保数据库和 Redis 可连接
3. 执行迁移
4. 启动开发服务器

```bash
bun run dev
```

访问：

- 前端页面：`http://localhost:5173`
- 健康检查：`http://localhost:5173/api/health-check`

`bun run dev` 由 `vite` 启动，并通过 `@hono/vite-dev-server` 同时提供前端页面和 Hono API。

## 构建与运行

| 命令 | 作用 |
| --- | --- |
| `bun run dev` | 本地开发 |
| `bun run build` | 构建前端与服务端到 `dist/` |
| `bun run preview` | 先构建，再运行 `dist/index.js` |
| `bun run start` | 直接运行已构建产物 |
| `bun run lint` | ESLint 检查 |
| `bun run test` | Vitest |
| `bun run auth:generate` | 重新生成 Better Auth schema SQL |
| `bun run auth:migrate` | 执行 Better Auth 迁移 |

构建产物：

- `dist/index.html`：前端 SPA
- `dist/index.js`：Bun 运行的 Hono 服务入口

## Docker

仓库内已经提供 Dockerfile，运行形态是单容器 Hono 服务，默认监听 `3000`。

本地构建镜像：

```bash
docker build -t daoyou-hono-bun:local \
  --build-arg VITE_TURNSTILE_SITE_KEY=your-public-site-key \
  -f Dockerfile .
```

运行镜像：

```bash
docker run --rm -p 3000:3000 \
  --env-file /path/to/.env.production \
  daoyou-hono-bun:local
```

注意：

- `VITE_TURNSTILE_SITE_KEY` 是前端构建期变量，不是单纯的运行时变量
- 服务运行时环境变量通过 shell、容器环境或 `--env-file` 注入

## 仓库内现成部署脚本

### 构建本地镜像并启动

```bash
ENV_FILE=/path/to/.env.production ./scripts/start-local.sh
```

这个脚本会：

- 依据当前仓库构建本地镜像
- 启动容器
- 轮询 `/api/health-check` 直到就绪

### 拉取远程镜像并启动

```bash
ENV_FILE=/path/to/.env.production ./scripts/deploy-local.sh
```

这个脚本会：

- 拉取远程镜像，默认是 `swkzymlyy/daoyou-hono:latest`
- 删除同名旧容器
- 启动新容器并等待健康检查成功

### 使用 docker compose

```bash
docker compose up -d
```

`docker-compose.yml` 默认使用远程镜像，并通过 `env_file` 注入运行时环境。

## CI / 镜像发布

当前仓库的 [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) 会在 `master` 分支推送时：

- 构建 Docker 镜像
- 推送到 Docker Hub
- 将 `VITE_TURNSTILE_SITE_KEY` 作为构建参数注入

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

欢迎加入《万界道友》交流群，与其他道友共同探讨修仙大计：

<p align="center">
  <img src="https://free.picui.cn/free/2026/02/24/699d3f0b15dd6.jpg" alt="交流群二维码" width="200" />
</p>

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
