# 本地开发

需要 pnpm 12.10.1、Node.js 24.18+ 和 Docker。独立运行维护命令前先执行 `pnpm exec turbo run build --filter="./packages/*"`；根 dev、build、typecheck、test 会自动按依赖图安排库构建。pnpm管理workspace依赖，Turborepo编排任务，Node运行Nest API与Vite。先执行 `pnpm install --frozen-lockfile`。首次将 `env/local.example.env` 复制为 `env/local.env`；已有本地配置保留。模板只含专用本地容器凭据，实际文件被Git忽略。

启动本地服务：

```bash
pnpm run services up -d --wait   # 启动 PostgreSQL、Redis、NATS、Mailpit
pnpm run db:migrate             # 执行认证和业务迁移
pnpm run dev                    # 启动 API 与 Vite
```

环境文件不再由脚本自动生成。启动和迁移命令重复执行不会清空数据；停止容器使用 `pnpm run services down`，数据保留在专用卷中。

| 服务 | 地址 |
| --- | --- |
| 页面 | http://127.0.0.1:5174 |
| API | http://127.0.0.1:3001 |
| PostgreSQL | `127.0.0.1:15432`，数据库 `daoyou_local` |
| Redis | `127.0.0.1:16379` |
| NATS / 监控 | `127.0.0.1:14222` / http://127.0.0.1:18222 |
| SMTP / Mailpit | `127.0.0.1:11025` / http://127.0.0.1:18025 |

## Workspace 与配置边界

- `apps/api`：Nest 功能模块、服务端基础设施与维护命令；运行依赖、Nest CLI 和 Oxlint 在本包声明；使用默认 tsc 构建。
- `apps/web`：React SPA、静态资源与 Vite 配置；React、Vite 和 Tailwind 依赖在本包声明。
- `packages/*`：由 tsc 编译为 `dist` 中的 JavaScript 与声明文件，JSON 内容随编译复制。API 在运行时加载，Web 由 Vite 打包，不独立部署。常量、领域模型、战斗 core、内容、玩法规则与契约分别位于 `constants`、`game-domain`、`combat-core`、`game-content`、`game-rules`、`contracts`；旧 shared 已清退，依赖方向和验收进度见 [应用边界](architecture-boundaries.md)。宿主使用明确的 `exports`，不以TS／Vite源码别名绕过边界；包内使用相对源码导入，避免类型检查读取自身陈旧 dist。公开叶子入口需单独注册。
- 根目录保留 `pnpm-workspace.yaml`、单一 `pnpm-lock.yaml`、`turbo.json`、lint/test/typecheck、迁移配置和部署入口。内部依赖使用 `workspace:*`，各包自行声明依赖。

Web/packages/根工具使用 ESLint 的 JS、TypeScript、React Hooks 推荐规则及 Vite Fast Refresh 配置，API 使用 `oxlint --type-aware`。

Oxlint 以 TypeScript 插件的 `correctness: error` 为基线，补充原有推荐规则中未被基线覆盖的检查；保留全 API 的 `no-floating-promises` 和入口、HTTP、Runtime、Realtime 的 `no-misused-promises`。新增的 `await-thenable`、`no-base-to-string`、`no-misused-spread`、`no-redundant-type-constituents`、`no-useless-default-assignment`、`restrict-template-expressions`、`unbound-method` 暂不启用，避免配置整理扩大为既有业务代码的类型规则整改。

迁移完成后已删除包边界检查脚本、`check:boundaries` 命令及两套 linter 的导入限制；包依赖方向、公开入口和数据库注入仍遵循架构约定。战斗内核继续禁止直接使用 `Math.random()` 和 `Date.now()`。

LLM生成和提示词位于API的 `lib/generation`；共同的修为与突破计算位于共享包。

Nest `ConfigurationModule` 使用 `@nestjs/config`、关闭dotenv自动发现，并提供一次Zod校验后的不可变环境快照。Nest服务注入 `AppConfigService`，使用类型化的 `get()` 读取配置，独立仓储／基础库使用 `getRuntimeEnvironment()`。端口、数据库URL、连接池上限、认证配置和消息配置在启动时校验；production还要求Redis地址与cron密钥且禁止 `APP_ENV=local`。错误只报告字段与约束，不输出凭据。

`DatabaseModule`以 `DRIZZLE_DATABASE` Provider 导出既有Drizzle客户端和 `DatabaseService`，Nest SQL／资源读取入口显式注入并向下传递客户端，与独立仓储共用一个pg.Pool，事务继续使用 `DbExecutor`／`DbTransaction`。Runtime在请求及消息排空后关闭连接；健康检查同时探测PostgreSQL、Redis、NATS及消息设施。

业务实现归所属feature的 `application/`（宗门组织为 `sects/organization/`），实时广播归 `realtime/infrastructure/`。`player/application/state`拥有跨领域资源读取、提交和命令协调；秘境/蜃楼归所属feature，调度和业务消息组合归`runtime`，`lib`只保留共享技术设施。避免新增集中式业务实现。浏览器业务HTTP请求使用 `apps/web/src/lib/api/fetch.ts` 的 `apiFetch`，不修改全局fetch。完整边界和发布顺序见 [架构审查与规范](monorepo-architecture.md)。

## NestJS API

`dev:api`、`prd:api`、`build:server`和Docker均使用Nest；旧Hono入口、路由和依赖已移除。框架代码与工具链迁移完成；特殊数据／发布验收见迁移记录。

```bash
pnpm run dev:api       # 首次构建 Nest，随后监听源码并重建、重启 Node.js
pnpm run dev:web       # 另一个终端启动前端
pnpm run build:server  # 类型检查并生成 apps/api/dist/main.js
```

Nest 使用 `nest start --no-shell --env-file ...` 和默认 tsc 编译器。根 `dev`／`prd` 命令通过 `turbo watch` 先按依赖图构建库，再启动应用；修改工作区源码时重建依赖并重启受影响的开发任务，CLI 通过 SIGTERM 排空旧 API。直接执行 API 包内的 dev 命令只启动 Nest，不替代根工作区 watch。类型检查随 Nest 构建执行。提示词通过 Nest CLI assets 复制到 `dist/prompts`，启动时读取和解析一次。API只清理 `apps/api/dist`，Vite只清理 `apps/web/dist`，两者可独立构建。Docker使用同一pnpm锁文件构建，再通过 `pnpm --filter @daoyou/api deploy --prod /out` 生成独立运行目录；最终镜像仅复制该目录，入口为 `dist/main.js`。Web及根开发工具不会进入运行镜像。workspace 禁用自动安装 peer 依赖；`syncInjectedDepsAfterScripts: [build]` 在 workspace 构建后同步注入依赖，确保 API、Web 和 deploy 使用当前产物。

当前HTTP入口已迁入Nest，特殊数据与生产验收仍有未完成项。长流程验证需要关闭watch时，先执行`pnpm run build:server`，再执行`APP_ENV=local NODE_ENV=development node --env-file=env/local.env apps/api/dist/main.js`。详情见 [迁移进度](nestjs-migration.md)。

workspace 使用 pnpm 原生的 `resolvePeersFromWorkspaceRoot: false` 和 `dedupePeerDependents: false`，禁止应用借用根开发依赖或合并不同 peer 环境下的包实例，避免 Better Auth 的可选 peer 将 `vitest`、`drizzle-kit` 带入 `deploy --prod`。API／Web 各自声明插件必需的运行 peer，根开发工具仍供测试和迁移使用；不修改第三方包元数据。调整 peer 配置时，使用 `pnpm install --lockfile-only --no-prefer-frozen-lockfile` 重新解析并核对锁文件版本，再执行 frozen install、完整构建及部署目录检查。运行镜像保留 Node 24／Debian bookworm 文件系统及非 root 用户，清理 npm、Corepack、Yarn 后重新复制基础层；部署目录仅删除本项目 API 与六个库的 source map、声明文件，保留运行 JavaScript、JSON 和提示词。宿主构建产物仍保留调试与类型文件。

Nest收到SIGTERM／SIGINT后拒绝新请求，停止定时发布并排空HTTP；30秒后关闭剩余HTTP连接，触发流式请求取消，继续等待处理器结束。随后停止消息消费者／发布任务、关闭数据库与Redis。启动期间收到信号会先等待初始化结束，再统一清理。整个停机过程超过60秒则以失败状态强制退出；生产Compose设置75秒停机宽限期。请求取消不能撤销已经提交的事务，恢复仍依赖现有幂等与outbox机制。

## 选择环境

两套开发命令分别显式加载一个文件：

| 用途 | 本地 `env/local.env` | 预发布 `env/staging.env` |
| --- | --- | --- |
| 同时启动 | `pnpm run dev` | `pnpm run prd` |
| 仅 API | `pnpm run dev:api` | `pnpm run prd:api` |
| 仅 Web | `pnpm run dev:web` | `pnpm run prd:web` |

`prd` 指预发布调试，两组都使用 `NODE_ENV=development`，API 启用 watch，Web 使用 Node.js 运行 Vite。API 和 Web 分别读取同一份环境文件；Vite 根据 `HOST`、`WEB_PORT` 监听，并把 API／WebSocket 代理到 `PORT`。本地端口为 3001／5174；预发布调试默认 3000／5173。

`env/staging.env` 从 `env/example.env` 准备，已有文件继续使用；它连接远程服务，不能用于自动化模拟测试写入。仅 `env/local.example.env` 和 `env/example.env` 纳入Git，实际 `env/` 配置默认忽略。原根目录 `.env` 原样移至 `env/legacy.env` 保留，不被任何命令加载；不将真实凭据放入本地配置或 `VITE_*`。整个 `env/` 排除在 Docker 构建上下文之外。

Node的 `--env-file` 显式选择文件；Nest ConfigModule关闭dotenv自动发现。Vite使用 `envDir: false`，避免叠加另一份配置；公开的 `VITE_*` 由进程环境注入。不要在Shell中预先导出另一环境的业务凭据。

Turbo开发任务不缓存，使用loose环境模式向子进程传递开发配置。构建使用默认strict模式，只传入声明的 `NODE_ENV`、`VITE_*`、`CF_PAGES_COMMIT_SHA`、`GITHUB_SHA`；这些值参与缓存键。共享包源码和根tsconfig变化会使依赖任务失效。`.turbo/` 不入Git或Docker上下文。

终端Ctrl-C终止开发任务及子进程。浏览器长流程测试使用上述构建后的无watch命令和 `pnpm run dev:web`，不增加专用脚本。

## 构建与迁移

`build:client` 和 `build:server` 保留为 CI/CD 稳定入口，不要求本地环境文件或本地数据库启动：

- `build:client`：`apps/web/vite.config.ts` 构建 SPA 至 `apps/web/dist`，保留 `version.json` 和构建 ID。
- `build:server`：`nest build` 根据 `apps/api/nest-cli.json` 构建Nest服务`apps/api/dist/main.js`，由Node运行并使用外部生产依赖。Docker调用此命令；旧resolver Worker已退役，没有额外Worker构建。
- `build`：Turbo按依赖图构建两个独立包；各目标会清理自己的输出，生产仍按原有独立构建方式发布。

前端公开配置由 CI 环境变量注入；需要文件时显式使用 `node --env-file=env/staging.env node_modules/turbo/bin/turbo run build --filter=@daoyou/web`。服务端密钥和连接串在部署启动时注入，不在构建时绑定环境。根命令分别进入对应 workspace；Vite只负责Web，Nest CLI只负责API。

`pnpm run db:migrate` 仅加载 `env/local.env`，依次执行认证和业务迁移。预发布／生产迁移沿用原子工具并显式注入环境，例如 `node --env-file=env/staging.env node_modules/drizzle-kit/bin.cjs migrate --config drizzle.auth.config.ts` 和 `node --env-file=env/staging.env node_modules/drizzle-kit/bin.cjs migrate`；不会随 `prd` 启动自动迁移。

## 注册与测试

`ALTCHA_HMAC_SECRET` 是人机验证唯一开关：未配置或为空时，服务端跳过验证，前端读取 `/api/captcha/config` 后不显示验证码组件；配置后强制校验。配置接口失败不会视作关闭验证。前端不读取密钥，也没有本地认证开关或伪造验证码 token。

邮箱激活、密码重置和邮箱 OTP 使用所有环境共用的正常流程；本地邮件送到 Mailpit。账号通过真实页面注册，验证码和链接从 Mailpit 获取，不再用脚本绕过账号／角色创建。已有本地测试账号可复用；若未验证邮箱，按登录页提示完成验证。多人操作应使用独立浏览器配置文件／上下文，避免共享 Cookie。

项目只有两层测试：`packages/*/src` 纯单元测试，以及 Codex 使用浏览器／Playwright 的真实用户流程模拟。操作规范见 [测试规范](./testing.md)。不保留一次性冒烟、故障注入、种子或性能采样脚本；需要的数据与步骤由当次任务按实际页面准备，结果记录在任务或相关设计文档中。

已有测试账号的查询方式、统一密码和登录要求统一维护在[本地测试账号与密码](./testing.md#3-本地测试账号与密码)，测试前按该规范复用账号。

本地未配置 LLM、OAuth、支付凭据；涉及这些外部能力时需明确准备条件，不能把无法走通的功能记为已验证。需要准备特殊角色数据时，在当次任务中明确本地范围并执行必要操作，不将临时准备过程扩展成长期脚本。

## 检查与迁移

```bash
pnpm run lint
pnpm run typecheck
pnpm run test
pnpm run build
```

新库安装已修正 `0000` 中唯一索引与外键的创建顺序。`0036_unified_v6_replay` 针对尚未上线的 v6 清空旧开发回放并建立统一角色关联表。迁移与清理仅在本地验证，未向预发布执行。

认证整理时已通过 Codex 浏览器验证无验证码注册、Mailpit 激活和密码登录，以及配置密钥后启用验证码、移除后关闭。本轮原生启动改造已验证 `dev` 组合启动、Node 承载 Vite、页面与登录会话读取、`prd:web` 独立启动、本地重复迁移、Lint、`build:client`、完整 `build`，以及原 Dockerfile 的实际镜像构建。未启动连接远程服务的 `prd:api`，未发布镜像；本轮不涉及共享业务逻辑，未重复共享单元测试。
