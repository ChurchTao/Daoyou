# 本地开发

需要 Bun 1.3.14+、Node.js 和 Docker。`env/local.env` 随仓库提供，包含专用本地容器配置，克隆后无需复制模板。

启动本地服务：

```bash
bun run services up -d --wait   # 启动 PostgreSQL、Redis、NATS、Mailpit
bun run db:migrate             # 执行认证和业务迁移
bun run dev                    # 启动 API 与 Vite
```

环境文件不再由脚本自动生成。启动和迁移命令重复执行不会清空数据；停止容器使用 `bun run services down`，数据保留在专用卷中。

| 服务 | 地址 |
| --- | --- |
| 页面 | http://127.0.0.1:5174 |
| API | http://127.0.0.1:3001 |
| PostgreSQL | `127.0.0.1:15432`，数据库 `daoyou_local` |
| Redis | `127.0.0.1:16379` |
| NATS / 监控 | `127.0.0.1:14222` / http://127.0.0.1:18222 |
| SMTP / Mailpit | `127.0.0.1:11025` / http://127.0.0.1:18025 |

## 选择环境

两套开发命令分别显式加载一个文件：

| 用途 | 本地 `env/local.env` | 预发布 `env/staging.env` |
| --- | --- | --- |
| 同时启动 | `bun run dev` | `bun run prd` |
| 仅 API | `bun run dev:api` | `bun run prd:api` |
| 仅 Web | `bun run dev:web` | `bun run prd:web` |

`prd` 指预发布调试，两组都使用 `NODE_ENV=development`，API 启用 watch，Web 使用 Node.js 运行 Vite。API 和 Web 分别读取同一份环境文件；Vite 根据 `HOST`、`WEB_PORT` 监听，并把 API／WebSocket 代理到 `PORT`。本地端口为 3001／5174；预发布调试默认 3000／5173。

`env/staging.env` 从 `env/example.env` 准备，已有文件继续使用；它连接远程服务，不能用于自动化模拟测试写入。`env/local.env` 和 `env/example.env` 纳入 Git，其他 `env/` 配置默认忽略。原根目录 `.env` 原样移至 `env/legacy.env` 保留，不被任何命令加载；不将真实凭据放入本地配置或 `VITE_*`。整个 `env/` 排除在 Docker 构建上下文之外。

`bunfig.toml` 的 `env = false` 关闭 Bun 自动加载，Bun `--env-file` 显式选择文件。Vite 保持默认环境文件加载行为；项目根目录不放 `.env` 或其他 `.env.*` 文件，环境配置集中在 `env/`，由启动命令注入。保留系统／CI 注入变量，不再手写解析、清理环境变量、固定端口校验或子进程管理；不要在 Shell 中预先导出另一环境的业务凭据。

组合启动由 Bun `run --parallel` 管理。浏览器长流程测试时不编辑 API 文件；如需关闭 watch，在两个终端执行 `bun --env-file=env/local.env src/index.ts` 和 `bun run dev:web`，不增加专用脚本。

## 构建与迁移

`build:client` 和 `build:server` 保留为 CI/CD 稳定入口，不要求本地环境文件或本地数据库启动：

- `build:client`：`vite.config.ts` 构建 SPA，保留 `version.json` 和构建 ID。
- `build:server`：`vite.server.config.ts` 构建 Hono 服务，再由 `vite.battle-worker.config.ts` 构建 resolver Worker。Docker 继续调用此命令，产物路径不变。
- `build`：Bun `run --sequential` 依次调用两个构建入口；各目标会清理自己的输出，生产仍按原有独立构建方式发布。

前端公开配置由 CI 环境变量注入；需要文件时显式使用 `bun --env-file=env/staging.env run build:client`。服务端密钥和连接串在部署启动时注入，不在构建时绑定环境。构建目标使用 `--config` 区分，Vite mode 不再用于 client/server 分流。

`bun run db:migrate` 仅加载 `env/local.env`，依次执行认证和业务迁移。预发布／生产迁移沿用原子工具并显式注入环境，例如 `bun --env-file=env/staging.env run auth:migrate` 和 `bun --env-file=env/staging.env x drizzle-kit migrate`；不会随 `prd` 启动自动迁移。

## 注册与测试

`ALTCHA_HMAC_SECRET` 是人机验证唯一开关：未配置或为空时，服务端跳过验证，前端读取 `/api/captcha/config` 后不显示验证码组件；配置后强制校验。配置接口失败不会视作关闭验证。前端不读取密钥，也没有本地认证开关或伪造验证码 token。

邮箱激活、密码重置和邮箱 OTP 使用所有环境共用的正常流程；本地邮件送到 Mailpit。账号通过真实页面注册，验证码和链接从 Mailpit 获取，不再用脚本绕过账号／角色创建。已有本地测试账号可复用；若未验证邮箱，按登录页提示完成验证。多人操作应使用独立浏览器配置文件／上下文，避免共享 Cookie。

项目只有两层测试：`src/shared` 纯单元测试，以及 Codex 使用浏览器／Playwright 的真实用户流程模拟。操作规范见 [测试规范](./testing.md)。不保留一次性冒烟、故障注入、种子或性能采样脚本；需要的数据与步骤由当次任务按实际页面准备，结果记录在任务或相关设计文档中。

已有测试账号的查询方式、统一密码和登录要求统一维护在[本地测试账号与密码](./testing.md#3-本地测试账号与密码)，测试前按该规范复用账号。

本地未配置 LLM、OAuth、支付凭据；涉及这些外部能力时需明确准备条件，不能把无法走通的功能记为已验证。需要准备特殊角色数据时，在当次任务中明确本地范围并执行必要操作，不将临时准备过程扩展成长期脚本。

## 检查与迁移

```bash
bun run lint
bun run test
bun run build
```

新库安装已修正 `0000` 中唯一索引与外键的创建顺序。`0036_unified_v6_replay` 针对尚未上线的 v6 清空旧开发回放并建立统一角色关联表。迁移与清理仅在本地验证，未向预发布执行。

认证整理时已通过 Codex 浏览器验证无验证码注册、Mailpit 激活和密码登录，以及配置密钥后启用验证码、移除后关闭。本轮原生启动改造已验证 `dev` 组合启动、Node 承载 Vite、页面与登录会话读取、`prd:web` 独立启动、本地重复迁移、Lint、`build:client`、完整 `build`，以及原 Dockerfile 的实际镜像构建。未启动连接远程服务的 `prd:api`，未发布镜像；本轮不涉及共享业务逻辑，未重复共享单元测试。
