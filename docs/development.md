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
| `BETTER_AUTH_ALLOWED_HOSTS` | 可选；多 API 域名时填逗号分隔的 host（不含协议），Better Auth 按请求 Host 生成 baseURL |
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

AI 相关功能统一通过原生 `@nestjs/ai` 的 `AiService` 调用，全部使用服务端配置的模型与凭据。业务服务直接注入，普通应用函数显式接收依赖；不使用全局 service locator 或生成兼容门面。旧 `aiClient.ts`、加权路由、`LLM_PROVIDER`、`LLM_ADVANCED_PROVIDER`、`LLM_DEBUG` 和 LLM 观测页/API 已退役。

供应商凭据：`ALIBABA_API_KEY`、可选 `ALIBABA_BASE_URL`（默认北京 `https://dashscope.aliyuncs.com/compatible-mode/v1`）、`DEEPSEEK_API_KEY`。环境中遗留的旧路由变量不再生效，应从部署配置移除。

#### @nestjs/ai 命名模型

`apps/api/src/llm/llm.module.ts` 通过原生 `AiModule.forRootAsync()` 注册并导出模型。业务必须显式指定模型别名，没有 `default` 别名。每家供应商可以注册多个别名，模型配置可以继续在该模块中扩展：

| 模型别名 | 模型 ID 配置 | 未配置时 |
| --- | --- | --- |
| `alibaba.fast` | `ALIBABA_FAST_MODEL` | 使用 `LLM_PROVIDER_DEFAULT_MODELS.alibaba` |
| `alibaba.advanced` | `ALIBABA_ADVANCED_MODEL` | 不注册该别名 |
| `deepseek.fast` | `DEEPSEEK_FAST_MODEL` | 使用 `LLM_PROVIDER_DEFAULT_MODELS.deepseek` |
| `deepseek.advanced` | `DEEPSEEK_ADVANCED_MODEL` | 不注册该别名 |

`LLM_PROVIDER_FACTORIES` 只负责供应商客户端、端点和凭据，模型设置集中在 `LlmModule`。别名由业务代码显式选择，不存在权重分流、用户哈希选路或高级模型自动降级。普通场景使用 `alibaba.fast`；云游剧本的大纲、正文和审校使用 `alibaba.advanced`，执行这些任务前必须配置 `ALIBABA_ADVANCED_MODEL`。切换供应商或档位时修改该业务调用的 `model` 别名。

共享原生 `BulkheadPolicy` 限制最多 64 个并发模型步骤，不排队；各模型组合原生 `RetryPolicy` 和 `TimeoutPolicy`。只有供应商标记可重试的请求错误及尝试超时会重试，最多 3 次；使用指数退避并遵守供应商 Retry-After（超过 30 秒不再重试），不对格式错误重试。快速别名每次尝试上限 120 秒，高级别名 15 分钟。命名模型已配置组合 `resilience`，调用级普通 `timeout/retry` 不再参与策略组装；需要更短的业务总限时，使用 `abortSignal`。`llm/call-options.ts` 的 `aiDeadlineSignal` 只合并原生取消信号与整次调用期限，不包装生成；各业务沿用更短期限，同一业务重试复用总期限。流式消费在 `finally` 调用原生 `abort()`。

默认通过 `providerOptions` 关闭思考；剧本大纲和审校显式开启，Alibaba 思考预算为 4096。长耗时请求使用 provider 层的 `undici` fetch，避免 Node 默认 300 秒响应头等待提前结束，实际期限由取消信号与原生策略负责。

结构化输出直接使用 `generateObject`；材料和灵种使用 `{ elements: [...] }` schema 后读取数组。严格业务校验、确定性保底及剧本自身审校/有限重试保留；旧通用的格式纠错提示与截断后扩增输出上限已删除。模型成功但业务校验不通过的步骤仍可能被采集为已完成用量。

用户自备模型凭据（BYOK）已退役：游戏设置不再提供供应商、模型或 Key 配置，客户端不再添加 `x-llm-*` 请求头，HTTP/WS 入口不再解析或应用这些旧头，CORS 也不再放行它们。浏览器启动时删除旧 `daoyou_llm_config` 存储项。服务端供应商、API Key、baseURL 与前端部署使用的 `VITE_API_BASE_URL` 配置继续保留；客户端输入不能改变上游模型端点或凭据。

#### AI 用量与费用

`LlmModule` 的全局 `onUsage` 将原生 `AiService` 事件交给 `AiUsageService`，存入 `wanjiedaoyou_ai_usage_events`。新场景通过该模块注入 `AiService`，并设置稳定的 `label` 即可按场景采集，不需要业务调用包裹；缺失或空白标签归入 `unlabeled`。后台页 `/admin/ai-usage` 按场景查看所有原生服务端模型用量。已有 `credential_source` 历史列及 `byok` 枚举约束和数据保留，新采集与后台查询仅使用 `server`；不修改原迁移，也不清理历史记录。

统计单位是**已采集的模型完成步骤**，不是业务请求数：一次 Agent 调用可以包含多个步骤。原生 `onUsage` 不提供完整的失败事件；失败、取消、流中断和结构化输出校验失败可能已有消耗却没有用量记录，因此本页不能用于计算业务失败率，也不能作为供应商真实账单。供应商未提供的 token 分项会被原生库归为 `0`，无法与真实的零用量区分。事件不保存提示词、生成正文或 API Key。旧观测的提示词/Schema 字符数、失败率和错误分类不再采集；旧 Redis `admin:llm-metrics:events:v1` 没有 TTL，部署后可单独清理该 key，不迁入费用表，也不删除共享 Redis 配置。

价格规则保存在 `wanjiedaoyou_app_settings` 的 `ai_model_pricing_v1` JSON 配置中，可在 `/admin/ai-usage` 的“模型价格”中添加、修改和删除，无需数据库迁移。规则按原生事件的精确 `provider + modelId` 匹配，例如 `alibaba.chat` 与 `qwen3.7-flash`，不是 `alibaba.fast` 这样的调用别名。同一个组合只允许一条规则；同一个实际模型用于多个别名时共用该价格。

所有单价单位均为**每百万 tokens**。未配置或未命中规则时使用人民币默认估算：输入 `CNY 1 / M`、输出 `CNY 2 / M`；缓存输入未单独填写时按普通输入价计算，显式填写 `0` 则保留零价。默认价只用于运营估算，不代表供应商报价。原生定价使用每模型固定单价，不按输入长度自动切换阶梯价；配置价格时应自行确认适用范围。

配置格式示例（单价仅演示格式）：

```json
{
  "models": [
    {
      "provider": "alibaba.chat",
      "modelId": "qwen3.7-flash",
      "currency": "CNY",
      "input": 1,
      "output": 2,
      "cachedInput": 0.2
    }
  ]
}
```

保存配置后需**重启 API 实例**生效；多实例部署需全部重启。`LlmModule` 启动时读取并校验配置，通过 `llm/model-pricing.ts` 配置原生 `AiModelDefinition.pricing`，`onUsage` 继续保存原生事件已计算的 `cost`，不另造计价公式。费用与价格快照来自同一次启动读取的配置，记录使用配置价还是默认估算价；运行中的实例不会因后台保存而换价。历史费用和快照不重算，历史未计价记录继续保留 `null`；费用按币种分别汇总。旧代码中限定模型和网关的报价规则已移除，不会自动沿用，需在后台显式配置。

#### 炼丹推演收费与模型输入优化

依方炼丹的灵气拆分为推演首付款和成丹尾款。两种炼丹模式的总费用统一使用 `calculateAlchemyQiCost`：`max(1, ceil(N / 6 + sqrt(E / 800)))`，其中 N 为投入材料总份数，E 为按品阶和材料类型折算、四舍五入后的原始药蕴；两项相加后统一向上取整，不再封顶 20 点。六格玄品灵草各 30 份（N=180、E=7200）消耗 33 点，六格神品天材地宝各 30 份（E=2340000）消耗 85 点。`POST /api/alchemy/formulas/:formulaId/analyze` 必须携带 UUID `requestId` 及原有材料、份数、版本字段；先校验并预扣总灵气的 30%（向上取整），再调用模型，技术失败退还首款，静态无效分析不收费。成功返回标准资源 mutation 的 `success/data/state`，`data.qiCostPaid` 是实际预扣额；成丹时在材料、灵石、产物的同一事务内扣除尾款 `max(0, 总额 - qiCostPaid)`，失败整体回滚，保留推演凭据供重试。总计 33 点时首付 10、尾款 23；总计 1 点时首付 1、尾款 0。仍有效的旧全款凭据不重复收费，缺省实付额的旧凭据成丹收全款。随心炼制仍在开炉时收全款。

未消费且仍匹配完整丹方内容、熟练度、材料语义/份数/版本的分析可在原有 10 分钟有效期内复用。同一 `requestId` 重放或新 `requestId` 请求相同输入都返回原 `analysisId`，不再次调用模型、扣费或续期；Redis 指针缺失可从 PostgreSQL 的有效记录恢复。预扣、分析结果和消费凭据分别使用现有 `playerMutationRequests` 的 `alchemy_formula_analysis_reserve`、`alchemy_formula_analysis`、`alchemy_formula_analysis_consumed` source，无需迁移。消费、过期或相关输入变化后须重新推演，旧凭据不能跨请求再次开炉；同一开炉 `requestId` 仍可幂等重放。

前端再次查看当前有效结果直接进入预览，不受推演冷却阻止。推演响应先应用资源状态；网络结果不确定时保留原请求 ID，只有成功结果或明确的 `analysisFinal: true` 失败终态才结束该次重试。这样既可重试退款后的失败，也不会因网络重试重复预扣。

模型端将逐味药性向量与配伍判断合并为一组输出，服务端还原原业务结构，保留完整覆盖、引用唯一、跨字段及药性规则校验。灵田阶段判断仍使用 AI，保留全部生态信息和必要阶段历史，仅精简提示词及重复字段；同进程相同输入合并在途判断，单个订阅者取消不影响其他等待者，全部取消时中止共享请求，完成后不保留长期结果缓存。静态字符测算中，炼丹 system 为 1468 字符、紧凑 Schema 为 1227 字符，灵田提示词约 795 字符；这些不是实际 token 数或节省费用的保证。炼丹优化应以每次成功业务预览的模型消耗衡量，不能只比较每条原生 usage 的平均值。

固定 system/Schema 和稳定 JSON 顺序继续作为共同前缀，动态材料后置；不为达到供应商缓存阈值填充提示词。供应商隐式缓存与业务结果复用是两层机制，前者命中受公共前缀、模型和服务端调度影响，不能保证命中率，见[阿里云上下文缓存说明](https://help.aliyun.com/zh/model-studio/context-cache)。业务复用不发模型请求，也不伪造零费用 usage 记录。

灵田收获命名显式选择种子的外观、观察线索、品质与生态特征，保留三阶段的方法、契合度、完整反馈及投入物名称，结算仅传类别、品质和升降品状态；不再发送内部 ID、计时、评分、产量及隐藏用途规则。云游解谜结算明确案型，保留已结案的真相、作答正误与实际答案、已达成支线、抉择和对决事实，过滤最近十二条记录中的场景、提示与预兆；未结案仍保留线索、对话和行动后果全文，不向模型传隐藏真相，也不从退出状态推断发生过战斗。其他云游分支的事实输入保持原样。两处继续使用 AI 生成并沿用输出校验和回退，玩法、评级、奖励与产量规则不变。

2026-11-10 输入精简验收：只读比较原有 47 条解谜归档（五类模板、31 条已结案及 16 条未结案），含 system 的字符数由 80267 降至 61640（减少 23.2%）；43 条非解谜归档的事实 JSON 不变，共享 system 由 705 减至 700 字符。灵田五株尚未成熟的本地样本 JSON 字符减少 49.2%～55.9%，完整阶段反馈与视觉生态字段保留；这些均不是实际 token 或费用降幅保证。真实本地页面以 `local1` 完成原有凡品青藤籽的后两阶段，收获前规则计算为凡品灵草 6 份，AI 命名后实际入储藏室“青藤凝叶”6 份，收获计数 3→4、田块清空。三次探秘撤离均已结束，最终版本覆盖未调查即撤离，无通关物品、评级 C；本轮共 7 个模型完成步骤（阶段判断 2、收获命名 2、结算 3），其中一次收获与撤离并发触发角色锁返回 429，单独重试成功，仅提交一次收获。后台模型任务显式关闭，无临时物资或角色属性调整，保留正常玩法消耗和产物。lint、typecheck、完整 build、最终 API build、相关 Markdown/新增代码格式检查及 `git diff --check` 通过；未运行单测（未修改共享纯逻辑），未重新实测完整结案及非解谜游玩，相关输入通过既有归档核对。尚未部署生产。

2026-11-09 本地验收：首次推演灵气 `333 → 332`，有效复看为零请求、零扣费；同输入请求及 Redis 指针缺失恢复均复用原 ID。两味材料各 4 份的新推演再扣 1 点至 `331`，开炉扣 3680 灵石、材料各 4 份并产出 3 枚丹药，灵气保持 `331`；原开炉请求重放返回 200 且不再收费，异请求使用旧凭据返回 409。灵气为 0 时发起新推演返回 409、`required: 1`，未调用模型；临时灵气准备已返还，恢复至 `331`。这些是本地验证记录，不代表已部署生产。

补充验收：以仅本地进程的临时无效模型配置验证真实提供方错误，推演返回 503、`analysisFinal/qiRefunded = true`，余额 `331 → 331`，同请求重放仍为退款终态；配置随后恢复。灵田同一阶段/方法的两条并发请求返回 200/429，仅新增 1 个模型完成步骤、1 条阶段历史，灵气 `331 → 326`；重放原请求返回 200，复用 requestId 更换方法返回 409，无额外消耗。背包临时腾挪已恢复，两味临时补充材料也已在验收炼制中用完；产出的丹药留在本地测试角色储藏室。

2026-11-09 新计费公式本地验收：`local1` 随心炼制投入已有凡品灵草 7 份，预览 2 点灵气，完整客户端载荷开炉成功，余额 `326 → 324`，消耗 1840 灵石并产出 2 枚丹药；请求重放返回 `state.replayed=true`。依方投入玉髓参 2 份、金雷竹心 1 份，预览与推演实际预扣均为 2 点，余额 `324 → 322`，该配伍预测产量为 0，未开炉；随后冰魄玉髓芝、风吟七星草各 1 份的预览与推演也均为 2 点，余额 `322 → 320`，开炉产出 1 枚地品丹药、消耗 29440 灵石，灵气保持 320，重放未重复扣费。只读数据库及后续 `currency` 资源读取均确认最终灵气 320、灵石 277442；数量 31 返回 400，失效材料版本返回 409且无扣费。页面另验证六格混合灵草各 1 份显示 2 点灵气，未提交。未准备临时物资，保留正常炼制产物与记录；本轮未重新实测灵气不足及技术失败退款场景。

2026-11-10 分期收费本地验收：API 使用 `APP_ENV=local`、`NODE_ENV=development` 和 `env/local.env`，后台模型任务保持关闭。`local1` 先投入已有万载空青灵液、金线灵藤各 1 份，总费用 1 点，推演首付 1 点（`320 → 319`）、尾款 0，预测无成丹而未开炉。再投入储藏室已有自测灵丝、自测兽骨各 9 份，总费用 5 点，真实推演首付 2 点（`319 → 317`），完整客户端载荷成丹补付 3 点（`317 → 314`），扣除 29440 灵石并产出地品 11 枚、真品 1 枚。数据库两条 committed 灵气流水分别为 2 和 3，后续 `currency` 读取确认灵气 314、灵石 248002；推演与开炉请求重放均不重复收费，开炉返回 `state.replayed=true`，失效材料版本返回 409，数量 31 返回 400。桌面已核对首款、已付款与尾款，360px 确认弹窗无横向溢出；额外小屏预览未提交模型请求。无临时物资或角色配置需要恢复，正常炼制产物和记录保留。`pnpm run lint`、`pnpm run typecheck`、`pnpm run build`、定向 `vitest run`（alchemyCost/alchemyYield，30 用例）和 `git diff --check` 通过；未运行全量单测，未重新实测灵气不足、技术失败退款和旧全款凭据运行时兼容（后者有纯规则用例）。尚未部署生产。

2026-11-10 分期收费异常分支补测：继续使用上述纯本地环境、`local1` 及真实页面/完整客户端载荷，后台模型任务显式关闭。投入储藏室已有自测灵玉、自测玄铁各 4 份，总灵气 4 点，首款/尾款各 2 点；初始灵气 314、灵石 248002。未改应用代码、环境文件或数据库结构。

| 场景 | 实际结果与提交检查 |
| --- | --- |
| 推演首款不足 | 通过原生 `QiService.reserveQi` 临时预留 313 点，余额 1；请求 `1ddc99cc-0ddf-4853-b6f7-48e0771f8bb0` 返回 409、`QI_INSUFFICIENT`、`required: 2/current: 1`。余额与灵石不变，无该请求的预扣凭据，整个库存 176 行的完整内容哈希保持 `6962623e3cbb21e0cab27624a455516b`。 |
| 推演技术失败退款 | 仅在本地 API 进程临时设置不存在的 `ALIBABA_FAST_MODEL`，真实提供方调用产生 `AiModelError`；请求 `dbba1ce1-152d-4771-8798-cee8b24c0598` 返回 503、`analysisFinal/qiRefunded: true`。首款 2 点预扣后全额退回，灵气仍为 314；唯一流水为 `refunded`、`qi_cost=2/qi_gain=2`。重放仍返回失败终态，没有再次退款；灵石及整个库存哈希不变。随后重启恢复原模型配置。 |
| 成丹尾款不足 | 第一笔临时预留已退还，再临时预留 311 点，余额 3；正常推演 `a5db8ad7-8ca3-42bc-8186-6436c8553cff` 扣首款 2 点至 1。页面确认开炉请求 `79916ac4-84b2-4c5c-87a2-6914e13dabe3` 返回 409、`required: 2/current: 1`；同请求重试仍为 409。灵气保持 1、灵石保持 248002，两份材料数量/版本分别保持 `8/8`、`5/12`，整个库存哈希不变；丹方熟练度仍为 Lv.1/exp9，无推演消费凭据、无该开炉请求的灵气流水。 |

退还第二笔临时预留后灵气为 312，页面保留原推演，使用完全相同的开炉 `requestId` 重试成功，补扣尾款 2 点至 310、扣 29440 灵石至 218562；材料各消耗 4 份、版本各递增 1，产出地品丹药 11 枚，熟练度升为 Lv.2。成功请求再次重放返回 `state.replayed=true`，后续 `currency` 资源读取与数据库余额一致。两笔准备性预留均已 `refunded`，没有遗留预留；正常玩法产物、消耗、进度和历史记录保留。本轮额外的成功模型完成步骤仅 1 条（`alchemy-formula-analysis`），没有后台模型生成。临时启动的 API/Web 已停止，日志分别保留于 `/tmp/daoyou-alchemy-refund-api.log`、`/tmp/daoyou-alchemy-payment-api.log` 和 `/tmp/daoyou-alchemy-web.log`。本轮执行真实本地浏览器/API 流程、只读数据库核验和 `git diff --check`；因无代码变更，未重复运行 lint、typecheck、build 或单测。旧全款凭据的运行时兼容仍未补测。

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
