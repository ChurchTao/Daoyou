# NestJS 脚手架与当前项目用法对比报告

> 后续工具链调整：API 已切换到 Nest CLI 默认 tsc 和 Oxlint，shared 独立编译并通过 dist 入口交付；开发命令使用 Turbo watch。下文的 Rspack／源码包描述保留为切换前审查记录，现行操作见 [本地开发](local-development.md)。

## 切换结果与验收（2026-10-04）

用户确认的前两项已完成：API 使用 Nest CLI 默认 tsc，移除 Rspack 配置及相关直接依赖；API 使用带类型检查的 Oxlint，Web、shared 与根工具继续使用 ESLint。ExpressAdapter 和直接 Express 依赖保留。

为使编译产物能由 Node 原生运行，API 与 shared 使用 NodeNext，内部 ESM 导入补齐 `.js` 路径，JSON 导入声明类型。shared 独立生成 JavaScript、声明文件和 JSON，通过 package exports 提供 `dist` 入口；提示词改为运行时读取，并由 Nest assets 复制到产物。依赖注入继续使用显式 `@Inject`，不启用隐式设计类型元数据。这些路径调整未改变游戏规则。

根开发命令由 Turbo watch 编排 shared 构建及应用重启；已验证 shared 修改后会重新编译、同步 pnpm 注入依赖并重启 API。现有开发、构建及 Docker 入口继续使用。

已通过以下验证：

- `pnpm install --frozen-lockfile`、`pnpm run lint`、`pnpm run typecheck`、`pnpm run build`。
- `pnpm run test`：237 个文件、2403 项测试全部通过。
- `pnpm --filter @daoyou/api deploy --prod` 产物检查，以及原 Dockerfile 的实际镜像构建；镜像内能加载 shared 的投影模块和全部 22 份提示词。
- 本地 API 健康检查、匿名资源请求返回 401、SIGTERM 有序停机；组合开发启动和 shared 修改后的重新加载。
- 复用本地测试账号浏览洞府与背包，页面资源显示正常，浏览器错误日志为空。

未启动连接远程服务的 `prd:api`，未推送镜像、执行数据库迁移或部署生产。特殊业务流程及生产发布验收仍按 [迁移进度](nestjs-migration.md) 跟踪。

## 切换前分析

分析日期：2026-10-03。

对照项目为 `/Users/churcht/Documents/GitHub/daoyou-nest`，分析对象为 Daoyou 当前工作区，包含尚未提交的架构整理改动。本文依据两边实际配置、源码、已安装 Nest CLI 实现及本轮静态检查，不把历史迁移记录当作本轮运行验证。

当前项目采用 NestJS 模块化单体，并使用 pnpm workspace 和 Turborepo 管理 API、React SPA 与共享源码包。主要框架机制已按 Nest 的 Module、Controller、Provider、Guard、Pipe、Filter、Interceptor 和生命周期组织。与脚手架的差异主要来自多应用仓库、业务迁移和构建选择。

需要继续改善的是部分业务依赖仍通过普通函数和单例直接导入，Nest 模块图不能完整表达它们；其次是 ESLint 的宿主划分和基于类型信息的异步检查。没有证据表明需要为了贴近脚手架而重建后端或更换整套工具链。

## 对照范围与版本

脚手架 `package.json` 声明 Nest 核心 `^12.0.1`、CLI `^12.0.0`；Daoyou 声明核心 `^12.1.2`、CLI `^12.0.8`。本地两边已安装的 CLI 均为 `12.0.8`，Daoyou 已安装的核心为 `12.1.2`、Rspack 为 `1.7.12`。

本次脚手架采用 Oxlint、Vitest、ESM 和 Nest Observe。分析应以这个 Nest 12 项目为基准，不能套用旧版脚手架的 ESLint、Jest、CommonJS 印象。脚手架呈现默认起步配置；它不能单独证明大型业务项目必须采用同样的目录深度、验证库或部署产品。

主要来源：脚手架 [package.json](/Users/churcht/Documents/GitHub/daoyou-nest/package.json)、[nest-cli.json](/Users/churcht/Documents/GitHub/daoyou-nest/nest-cli.json)、[tsconfig.json](/Users/churcht/Documents/GitHub/daoyou-nest/tsconfig.json)，以及 Daoyou [根配置](../package.json)、[API 配置](../apps/api/package.json)。

## 差异概览

| 方面 | 脚手架 | 当前 Daoyou | 判断 |
| --- | --- | --- | --- |
| 仓库组织 | 单一 Nest 应用 | API、Web、shared 三个 workspace | 适应前后端共享规则的合理选择 |
| 任务编排 | package scripts 直接调用 Nest | 根目录 Turbo，API 内部仍调用 Nest | 各自职责清楚 |
| 包管理 | 当前目录有 bun.lock | 固定 pnpm 版本与 pnpm-lock.yaml | 包管理器选择不决定 Nest 架构 |
| API 构建 | 默认 tsc | 显式 Rspack，继承 CLI 默认配置 | 官方 CLI 支持的另一条构建路径 |
| 模块格式 | ESM | ESM | 一致 |
| TypeScript 解析 | NodeNext，源码相对导入写 .js | bundler，允许无扩展名和宿主别名 | 对应不同构建路径 |
| 注入 | 编译器生成类型元数据，隐式构造器注入 | 关闭类型元数据，显式 @Inject | 主动策略，需要生成代码适配 |
| 静态检查 | Oxlint，开启 type-aware | ESLint，TypeScript 推荐规则、React 规则、架构规则 | 工具选择合理，规则划分仍可改善 |
| 格式化 | Prettier，有 format 命令 | Prettier，加导入、包配置、Tailwind 插件 | 当前服务于整个仓库 |
| 测试 | Vitest、Nest TestingModule、Supertest | Vitest 仅发现 shared 测试；应用走真实浏览器验证 | 仓库政策差异，存在不同覆盖范围 |
| 业务分层 | AppController 与 AppService 示例 | 按 feature 分组，内部有 application 与基础设施 | 大规模业务可以保留这种分层 |
| 配置 | 示例直接读 PORT | ConfigModule、Zod 校验快照、AppConfigService | 当前配置管理更完整 |
| HTTP | 默认 Express 行为 | 显式 ExpressAdapter、原始请求体、自定义查询和错误契约 | 主要用于兼容既有协议 |
| 运行管理 | 创建应用并监听 | 调度、消息、WS、请求排空和资源关闭 | 属于真实业务运行需求 |
| 可观测与部署 | Observe 示例配置、nest deploy 命令 | 自有健康检查、日志、Docker 和 CI/CD | 可单独选型，不属于模块化必需条件 |

## Monorepo 的组织方式

当前目录结构为：

```text
Daoyou/
  apps/api/          Nest 应用
  apps/web/          React SPA，由 Vite 构建
  packages/shared/  契约、领域规则、引擎与共同计算
  package.json      仓库级工具与命令
  turbo.json        任务依赖、缓存与开发任务
```

它采用通用的 pnpm/Turbo monorepo。API 的 `nest-cli.json` 仍描述一个 Nest 应用，没有启用 Nest CLI 的 `monorepo: true` 或维护根级 `projects`。

Nest CLI 原生 monorepo 通常用根级 Nest 配置组织多个 Nest application/library。当前仓库同时包含 React 应用和不依赖 Nest 的共享领域代码，使用通用 workspace 可以分别管理构建与部署。`packages/shared` 也不需要成为 Nest library 或添加 `@Module`。

Turbo 调用 API 的 `nest build`，并没有取代 Nest 编译命令。API 构建由 Nest CLI/Rspack 负责，Web 构建由 Vite 负责。根目录统一安装 lint/test 工具也是仓库管理选择，并不要求把这些依赖重复安装到 API。

来源：[pnpm-workspace.yaml](../pnpm-workspace.yaml)、[turbo.json](../turbo.json)、[API Nest 配置](../apps/api/nest-cli.json)、[shared 包入口](../packages/shared/package.json)。

## Rspack 与 TypeScript 的差异

### 脚手架默认采用 tsc

脚手架没有设置 `compilerOptions.builder`。已安装 CLI 的 `defaultConfiguration` 将 builder 设为 `tsc`，`getBuilder()` 的回退值也是 `tsc`。现有脚手架产物按文件输出，并保留 `design:paramtypes` 元数据，与其 TypeScript 配置一致。

因此，准确表述是：**本次脚手架默认用 tsc；Rspack 是 Nest CLI 支持的构建器，当前项目显式选择了它。** 不能将“官方支持 Rspack”等同于“脚手架默认使用 Rspack”。

CLI 实现来源：[默认配置](../apps/api/node_modules/@nestjs/cli/lib/configuration/defaults.js)、[builder 选择](../apps/api/node_modules/@nestjs/cli/lib/compiler/helpers/get-builder.js)、[Rspack 默认配置](../apps/api/node_modules/@nestjs/cli/lib/compiler/defaults/rspack-defaults.js)。这些路径用于本机核查，不是仓库内的长期文档依赖。

### 当前项目为什么需要额外构建配置

[rspack.config.mjs](../apps/api/rspack.config.mjs) 继承 Nest CLI 默认配置，并做了几项明确调整：

- 将 `@daoyou/shared/*` 对应的 TypeScript 源码打入 API 产物。
- 使用 `asset/source` 将 Markdown 提示词转换为可导入字符串，现有提示词入口使用 `.md?raw`。
- 将 Node 内置模块和 API 声明的运行依赖 externalize，产物运行时从部署目录的 node_modules 加载。
- 显式开启 source map，并关闭 SWC 的 `decoratorMetadata`。

shared 的 exports 直接指向 `.ts`，目前只有 typecheck 命令，没有独立的 JavaScript build。打包后端可以直接消费这套内部源码包，也避免运行时解析 `@server/*` 源码别名与 Markdown 导入。

若改用 tsc，需要同步解决 shared 的交付方式、Node 导入路径及 Markdown 加载。仅移除 Rspack 配置无法得到同等产物。这是构建取舍，不是 Nest 架构违规。

代价是需要维护自定义构建配置与依赖外置规则。当前代码直接修改 `options.module.rules[0].use[0]`，依赖 CLI 默认规则数组的结构；升级 CLI 后应重点复核这一处。它现在可以工作，不等于未来默认配置变化也必然兼容。

配置中出现 webpack、webpack-node-externals、tsconfig-paths-webpack-plugin、fork-ts-checker-webpack-plugin，也不意味着项目同时跑两套后端构建器。Rspack 使用兼容插件，Nest CLI 对部分工具声明 peer 依赖，当前实际执行的 builder 是 Rspack。

Nest 的 Rspack 默认配置会在条件满足时装入 ForkTsCheckerWebpackPlugin；当前已安装该插件且未配置编译插件钩子，自定义配置也保留了默认 plugins。因此当前 `nest build` 包含类型检查，并非只有快速转译。独立 API typecheck 仍可以提供直接的类型检查入口。

### 两套 TypeScript 配置各有适用条件

| 配置 | 脚手架 | Daoyou API |
| --- | --- | --- |
| module 与 moduleResolution | NodeNext | ESNext 与 bundler |
| target | ES2023 | 继承 ES2022 |
| emitDecoratorMetadata | true | 未开启，Rspack 也显式关闭 |
| strictPropertyInitialization | false | strict 下采用默认检查 |
| declaration | true | 未配置独立声明文件输出 |
| 常规类型检查 | tsc 同时参与编译 | tsc --noEmit，Rspack 负责产物 |

脚手架通过 `./app.service.js` 这类路径匹配 Node ESM 的运行解析；当前 API 交给 bundler 解析源码路径。两边都是 ESM，不应将当前项目解释为“为了 monorepo 从 CommonJS 改成 ESM”。

当前配置支持 bundler，并不代表源码可以不经构建直接按普通 Node ESM 运行。API 的 `rootDir: ../..` 也与工作区源码参与类型检查相适应，不能照搬脚手架的 `rootDir: ./src` 后假定输出仍然相同。

来源：[脚手架 TypeScript 配置](/Users/churcht/Documents/GitHub/daoyou-nest/tsconfig.json)、[公共 TS 配置](../tsconfig.base.json)、[API TS 配置](../apps/api/tsconfig.json)、[提示词入口](../apps/api/src/lib/prompts/registry.ts)。

## ESLint 与 Oxlint 的差异

脚手架的 lint 命令是 `oxlint --type-aware src/ test/`，`.oxlintrc.json` 将 `typescript/no-floating-promises` 设为 error。它能够借助类型信息识别未处理的 Promise。

Daoyou 使用 ESLint 10 和 typescript-eslint 8，启用普通 recommended 配置，没有配置 projectService、project 或 type-checked recommended。本轮读取 API 的实际 ESLint 配置，确认未启用 `@typescript-eslint/no-floating-promises`。`tsc --noEmit` 不能替代该规则，因为忽略 Promise 通常不是 TypeScript 类型错误。

保留 ESLint 有实际收益：当前配置包含 React Hooks、React Refresh，以及 shared、API/Web、combat core、repository 和部分领域之间的依赖限制。这些约束已经属于项目架构的一部分。更换 Oxlint 之前需要确认规则等价性，不能仅以脚手架使用它为依据删除现有规则。

当前可以改善两处：

1. **按宿主划分规则。** 首个 TS/TSX 配置把 browser globals、React Hooks 与 React Refresh 应用于所有 TS 文件，API 后续配置主要追加 import 边界，没有覆盖这些规则。本轮实际配置确认 API 的 main.ts 也继承 React 规则和浏览器 globals。建议 React/browser 配置只作用于 Web，API 使用 Node 配置。此问题主要是规则适用范围和维护清晰度，不能据此声称当前 tsc 已允许后端随意访问 DOM。
2. **为 API 增加基于类型信息的异步检查。** 优先评估 `no-floating-promises` 和 `no-misused-promises`，关注 HTTP、消息和关闭流程。先确认检查耗时与既有合法用法，再逐步启用。也可以评估 API 用 Oxlint，但需要保留现有 ESLint 架构边界。

本轮没有测量 Oxlint 和 ESLint 的速度，也没有证据支持将检查器切换列为性能优化的最高优先级。

来源：[脚手架 lint 配置](/Users/churcht/Documents/GitHub/daoyou-nest/.oxlintrc.json)、[当前 ESLint 配置](../eslint.config.js)、[当前工具依赖](../package.json)。

## Nest 模块与业务依赖

### 功能目录符合 Nest 模块化方向

当前 API 按 market、inventory、combat、sects 等 feature 分组，每个 feature 拥有 Module、Controller、Service。根 AppModule 负责组合，而不是将所有业务实现集中在根 AppService。

feature 内继续划分 `application/`，基础技术能力位于 `lib/`，是当前业务规模下的分层方式。Nest 没有要求每个业务对象都必须使用装饰器。`useFactory`、`useValue` 和 token 注入本身也都是标准 Provider 用法。

例如 MarketModule 用 `useFactory` 创建不依赖 Nest 装饰器的 MarketPurchaseService，并声明角色查询、玩家命令协调器和数据库依赖。这可以保留框架无关的业务代码，同时让 Nest 管理组合关系。

来源：[AppModule](../apps/api/src/app.module.ts)、[MarketModule](../apps/api/src/market/market.module.ts)、[MarketPurchaseService](../apps/api/src/market/application/MarketApplicationService.ts)。

### 显式注入是项目策略

脚手架构造器只写 `private readonly appService: AppService`，由编译器生成的 `design:paramtypes` 告诉 Nest 注入什么。

当前项目关闭类型元数据，所以服务依赖写成 `@Inject(MarketService)`，接口形状的数据库依赖使用 `@Inject(DRIZZLE_DATABASE)`。这仍然是 Nest 构造器注入。**关闭类型元数据不是 Rspack 的强制要求**：CLI 的默认 SWC 配置实际上设置 `decoratorMetadata: true`，关闭它的是项目配置。

这套策略减少对隐式类型反射的依赖，代价是代码更显式，并需要适配 CLI 生成代码。今后用 `nest g controller/service` 后，应检查构造器依赖并补齐 @Inject；自动生成的 spec 文件也需符合仓库现有测试政策。恢复元数据应作为独立构建和注入调整验证，不能只删掉 @Inject。

### 部分有副作用的依赖仍绕过 Provider 图

目前并非所有业务依赖都由 Nest 管理。例如：

- AuctionService 直接导入 repository 和应用函数，本身没有声明这些依赖的构造器。
- AuctionApplicationService 直接导入 `playerCommandExecutor` 单例及 Redis 锁工具。
- PlayerStateModule 用 `useValue` 将同一组既有命令协调器暴露给 Nest。
- DatabaseModule 用 `useValue` 暴露既有 Drizzle 客户端，Pool 在基础库加载时创建。

这些路径可以正常运行，并且当前复用既有实例，没有证据表明因此产生了第二个数据库池。但只看 Module imports/providers，无法完整获知业务依赖、外部副作用和资源创建时机；Provider 替换或生命周期管理也只能覆盖接入容器的部分。

建议以坊市现有方式为样板，在实际修改业务时逐步把需要管理的数据库、命令协调、锁与消息依赖接入明确的 Provider 或生产组合入口。确定性的共享规则和纯函数继续保留普通导入。不要为了文件形式统一而给每个无状态函数增加 Service。

Nest 外层 Service 与内层应用实现有时名称相近，例如 `market.service.ts` 与 `application/MarketService.ts`。这种双层方式可用于传输适配与业务编排；若外层只有机械转发，就会增加阅读成本。后续应根据实际职责判断是否保留，不需要全仓一次性合并。

来源：[AuctionService](../apps/api/src/auction/auction.service.ts)、[拍卖应用实现](../apps/api/src/auction/application/AuctionApplicationService.ts)、[PlayerStateModule](../apps/api/src/player/player-state.module.ts)、[DatabaseModule](../apps/api/src/database/database.module.ts)、[数据库客户端](../apps/api/src/lib/drizzle/db.ts)。

## HTTP 验证与运行管理

脚手架仅展示 Hello World，没有业务请求验证。Nest 常见文档用法包括 DTO class 与 ValidationPipe；当前项目使用 shared Zod 契约和 ZodPipe，使前后端共享同一输入定义。这属于 Nest 自定义 Pipe 的正常使用，没有必要只为接近常见示例再增加一套 class-validator 契约。

关闭类型元数据后，依赖运行时 DTO 类型反射的 ValidationPipe、序列化或 Swagger 能力不能假定直接可用；接入时需要明确 schema 或额外元数据。这是当前策略的兼容条件，目前未接入这些能力不能单独认定为缺陷。

当前 HTTP 行为比脚手架复杂：显式创建 ExpressAdapter、关闭默认 body parser，Better Auth 先处理原始认证请求，业务 JsonBody 在 Guard 后读取请求体，FirstQuery 保留既有查询语义，局部 Filter 保留错误响应，WS adapter 处理握手与会话 Cookie。

它们主要服务于既有协议迁移。部分实现仍用标准 Web Response 表示错误，再由 Nest Filter 转成 Express 响应，这增加适配代码，但已经进入 Nest Filter 机制。后续可以随业务修改减少无必要的转换，不宜在结构整理时顺带统一状态码、请求体顺序或错误 JSON。

RuntimeService 使用 Nest 生命周期钩子管理调度、消息及停机，main.ts 处理启动失败和启动期间的退出信号。该复杂度来自活动请求、SSE、WS、数据库、Redis 和消息任务需要有序关闭。源码表明已经采用 Nest 生命周期机制；本轮仅验证静态质量与构建，没有重新验证完整停机时序。

当前 ConfigurationModule 使用 ConfigModule，并提供校验后的不可变环境快照；相较脚手架只读 PORT 的示例更适合现有业务。保留统一配置来源与单一连接池比复制示例代码更有价值。

来源：[HTTP 配置](../apps/api/src/http/configure-http.ts)、[ZodPipe](../apps/api/src/http/zod.pipe.ts)、[错误 Filter](../apps/api/src/http/error-filter.ts)、[启动入口](../apps/api/src/main.ts)、[RuntimeService](../apps/api/src/runtime/runtime.service.ts)、[配置模块](../apps/api/src/config/configuration.module.ts)。

## 测试与交付差异

两边都使用 Vitest。脚手架提供 `@nestjs/testing` 的 TestingModule 与 Supertest 示例；当前仓库按 [testing.md](testing.md) 限制单元测试只覆盖 shared 的纯领域逻辑，应用流程通过真实浏览器模拟验证，不在 API/Web 添加单元测试或服务 mock。

这是一项明确的项目政策，不是 Nest 或 monorepo 的限制。shared 测试不能直接证明 Provider 注册、Guard 顺序、Cookie、SSE、WS 或消息关闭正确；应用运行验证需要继续针对这些行为收集证据。本轮没有复制脚手架测试或修改该政策。

脚手架的 Observe 配置与 `nest deploy` 命令属于可观测和部署能力。当前通过自有健康检查、日志、Docker、CI/CD 交付，也可以正常运行 Nest。是否接入 Observe 应根据遥测需求单独评估，脚手架中的占位 key 不应直接复制。

API Docker 构建使用同一 pnpm 锁文件，执行后端构建后通过 `pnpm deploy --prod` 生成部署目录，运行时执行 `node dist/main.js`。因此 Nest CLI、Rspack 和 Turbo 属于构建工具，无需进入运行镜像。Rspack 将依赖外置也意味着 dist 不是完全自包含文件，仍需对应的运行 node_modules。

当前 `prd` 命令实际使用 staging 环境和开发 watch，不是生产启动命令。它是既有命令约定，容易让新维护者误解；文档应明确生产使用部署产物入口。

来源：[Vitest 配置](../vitest.config.ts)、[脚手架测试](/Users/churcht/Documents/GitHub/daoyou-nest/test/app.e2e-spec.ts)、[Dockerfile](../docker/Dockerfile.app)、[API scripts](../apps/api/package.json)。

## 建议与验证记录

| 优先级 | 建议 | 目的 |
| --- | --- | --- |
| 优先 | 按 Web、API、shared 拆分 ESLint 适用规则 | 避免 React/browser 配置覆盖后端 |
| 优先 | 为 API 评估并启用基于类型信息的 Promise 检查 | 补足当前 lint 与脚手架异步检查的差距 |
| 逐步实施 | 有副作用的业务依赖采用明确 Provider 或组合入口 | 让模块图更接近实际运行依赖，保留单例与事务语义 |
| 日常维护 | CLI 升级核查 Rspack loader、依赖外置、源码与提示词打包 | 降低自定义构建配置对默认结构的依赖风险 |
| 文档约定 | 说明生成代码的 @Inject/spec 适配，以及 prd 的 staging 含义 | 减少与脚手架习惯之间的误解 |
| 保留 | pnpm/Turbo、Rspack、shared Zod、显式注入及生命周期管理 | 这些选择已有项目用途，不必为目录一致而替换 |

本轮执行结果：

- `pnpm run lint`：通过，检查当前整个工作区。
- `pnpm --filter @daoyou/api run typecheck`：通过。
- `pnpm run build:server`：成功，但命中 Turbo 缓存；该结果不作为本轮重新编译证据。
- `pnpm --filter @daoyou/api run build`：直接执行 `nest build`，绕过 Turbo 缓存，Rspack 1.7.12 编译通过。
- `node --check apps/api/dist/main.js`：新生成的入口产物语法检查通过，未执行应用。
- `pnpm exec prettier docs/nestjs-scaffold-comparison.md --check`：报告格式检查通过。
- 读取 API 的 ESLint 最终配置：确认继承 React/browser 配置，未启用 no-floating-promises。
- 检查报告结构、源码引用和文档 diff，39 个本地来源链接均存在；未修改应用源码、构建配置或两边的依赖。

未运行 shared 单元测试、Web 构建、完整仓库 typecheck、脚手架重新构建、浏览器流程、容器或生产环境验证。本次仅生成架构对比报告，并用后端静态检查与实际编译验证当前构建路径；以上检查不等同于运行行为或生产迁移验收。
