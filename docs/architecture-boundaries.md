# 应用边界与迁移决策

日期：2026-10-04。目标：NestJS 模块化单体、React SPA，以及按职责拆分的内部编译包（tsc 输出 JavaScript 和声明文件）。

> 2026-10-04 配置简化：迁移已完成，包边界检查脚本及 ESLint/Oxlint 的迁移导入限制已退役，lint 改为推荐规则／原生 correctness 基线加必要的代码正确性约束。依赖图与公共 API 约定继续适用；下文脚本和 Quality CI 的执行记录属于历史验收，当前 GitHub Actions 仅在 tag 推送时构建并推送镜像。

## 当前迁移目标与验收

用户已授权按顺序推进六包拆分，直到移除旧 shared 并完成验收。下面的目标替代后文历史批次中“保留三个工作区”的决策；历史实施记录不作为本轮完成证据。

| 包 | 职责 | 允许的内部生产依赖 |
| --- | --- | --- |
| constants | 元素、境界、品质等稳定基础词汇 | 无 |
| game-domain | 按领域组织的模型、Schema 与不变量 | constants；combat-core 仅类型 |
| combat-core | 确定性战斗状态、命令、执行与扩展接口 | 无 |
| game-content | 游戏内容、定义与数值表 | constants、game-domain、combat-core |
| game-rules | 资格、费用、收益、生成、投影等纯玩法计算 | constants、game-domain、combat-core、game-content |
| contracts | HTTP、资源与实时消息的请求/响应协议 | constants、game-domain、combat-core |

旧 shared workspace 已删除，不保留兼容 barrel。所有类型与运行值导入都受包方向限制；测试依赖上层玩法时，应归入拥有该玩法的包，而不是让底层包反向依赖。应用之间不互相导入，各自消费包 exports，不通过源码别名绕过边界。

实际迁移细化：装备、功法、内容定义与人物投影的模型共同引用 `SkillDef`、`LineupUnit`、`CombatV6VersionStamp` 等内核类型。将这些中立模型归入 game-domain，并允许它单向 type-only 依赖 combat-core；架构约定禁止运行值导入。这样保留权威类型、保持内核零业务依赖，也避免为了初始图形复制类型或引入无业务价值的泛型。领域包仍不依赖游戏内容、规则、契约和应用。

执行顺序和完成条件：

- [x] 固定职责和依赖图，建立可执行包边界检查。
- [x] 提取 constants 与 game-domain；清理 Web 重复纳入 shared 源码和根 shared 源码别名。
- [x] 提取 combat-core，保持确定性和既有测试覆盖。
- [x] 提取 contracts，协议不依赖规则执行器或内容注册表。
- [x] 按领域提取 game-content / game-rules，保持数值、Schema 与行为一致。
- [x] 收紧 Nest 跨领域公开入口及仓储归属，核对 Web feature 的请求、适配和状态所有权。
- [x] 删除 shared 和过渡导出；更新技能、文档、测试发现、Turbo、CI、Docker 和维护工具入口。
- [x] 完成 frozen install、lint、全部类型检查、纯逻辑测试、双应用构建及包依赖审查。
- [x] 完成本地 Docker 产物、API 启停/readiness、浏览器关键流程和资源实时恢复验收（具体范围及未覆盖项见下）。

本次不改变游戏规则、HTTP 行为、数据库模型、锁/事务/幂等语义，不执行生产部署或数据迁移。维护发布策略仍适用。每批记录实际命令与结果；未执行的运行检查保持待验收，不用构建结果替代。

### 本轮进度

2026-10-04 开始。基线有 1637 个生产 TS/TSX 文件、237 个测试文件/2398 个测试；前次只读审查的 lint、typecheck、强制构建及共享测试通过。本轮需对修改后的工作树重新验证。开始时 `.gitignore` 与 `tsconfig.base.json` 已有暂存变更，保留原样。

### 六包拆分检查点（2026-10-04）

当前有 8 个 workspace：2 个应用、6 个目标库；shared 已删除。以下批次记录保留其当时的验证数据，最终证据见本节末尾。

| 包 | 当前已归入的实现 |
| --- | --- |
| constants | 元素、境界、品质及其顺序 |
| game-domain | 角色/宗门模型、装备/功法/灵兽 Schema、背包/交易/奖励事实、完整校验构造器、战斗快照、宗门组织接口与剧情/教学/演出模型 |
| combat-core | 29 个确定性内核实现文件，独立于游戏内容与应用 |
| game-content | 装备/功法/灵兽/宗门内容、物品注册表、经济/战斗/炼丹/修为/奖励调参、材料预设、地图、剧情与教学文本、宗门组织主题 |
| game-rules | 装备/灵兽/功法/背包/交易规则、人物投影与战斗、炼丹/恢复/修炼/灵田/奖励计算、市场抽样、剧情推进与通用宗门组织 |
| contracts | 已迁入账号、管理、战斗、市场、背包、玩家/宗门资源、闭关、日志、任务、灵田、物品库、领域事件信封、悟道与阵纹协议 |

内容相关的完整校验采用显式组合：领域包的 `createBeastSchema`、`createInventoryEquipmentSchema` 和 `createInventorySchemas` 接收内容查询或校验依赖，规则包绑定当前权威目录。模型类型从同一 Schema 推导，保留未知物品/技能、阵纹部位与等级、堆叠上限、实例身份和固定物品附带属性等校验，不通过降低 Schema 严格度消除依赖。

竞技/回放收口后，shared 实现和测试均已归位，未调用的旧 barrel、冻结文案、shuffle 与 Body.json 声明已删除。当前全仓 256 个测试文件、2,409 项测试；测试增加来自协议/玩法断言分离以及校验依赖传递回归检查。

已修正内容 JSON 迁移后测试替换仍指向旧路径的问题；灵兽配置用例保留原断言。宗门组织只需要装备部位名称，已改用领域定义；其架构守卫仅检查生产源文件，避免将使用真实内容的测试误当成生产依赖。18 份已迁移 JSON/Schema 与 HEAD 原文件逐字一致。完整校验结果在每批完成后补记；构建、类型检查不能替代最终运行验收。

本检查点验证：`pnpm run typecheck` 通过（16 项任务）；`pnpm run lint` 通过（9 个 workspace、11,058 个导入及类型/测试边界）；`pnpm run test` 通过（237 文件、2,398 项）；`pnpm exec turbo run build --force` 通过（9 项构建，双应用及全部库）。Vite 仍提示 Phaser chunk 大于 500 kB，此次未调整分包。`git diff --check` 与领域/数据技能校验通过。本轮尚未执行 Docker、API 启停或浏览器验收。

生产依赖目录检查：`pnpm --filter @daoyou/api deploy --prod /tmp/daoyou-monorepo-api-check-20261004` 成功；在该独立目录中用 Node 加载 470 个公开 package exports（含 JSON）全部成功。该检查验证包发布文件与运行时解析，不代替 Docker 容器和 API 启停检查。当前 46 份内容 JSON/Schema 均与 HEAD 原文件逐字一致。

宗门内容追加批次：五宗门数据、编译内容与注册表进入 `game-content/sects`，玩家构筑编译和经脉选择进入 `game-rules/sects`；注册表初始化继续执行原内容校验。30 个既有测试随所属包移动，测试总数未减少。该批再次通过 lint、16 项类型任务、237 文件/2,398 项测试及 9 项强制构建。剩余 shared 跨协议测试未通过放宽底层包依赖强行迁入。

战斗模型追加批次：自动策略、单位展示、回放时间线、遭遇快照及宗门动作模型进入 game-domain；训练/回放/Redis 运行协议进入 contracts；宗门进阶计算进入 game-rules。契约不再通过旧引擎实现取这些类型，依赖图没有增加反向边。该批通过 frozen install、lint（11,076 个导入）、16 项类型任务、237 文件/2,398 项测试及 9 项强制构建。重新生成独立生产依赖目录 `/tmp/daoyou-monorepo-api-combat-models-20261004`，474 个公开 package exports 全部可加载，产物不含 Web workspace 或 API 源码。Docker 容器、API 启停和浏览器流程仍待后续验收。

人物投影与自动战斗批次：52 个文件迁入所属包，包括炼体配置/规则、人物投影、训练/野外遭遇、自动策略与战斗展示。命令模型与 HTTP round/revision 请求信封分离，战斗日志不再依赖 HTTP 会话 DTO。7 份 JSON/Schema 资产与 HEAD 逐字一致。该批通过 lint（11,088 个导入）、16 项类型任务、237 文件/2,398 项测试及 9 项强制构建。

蜃楼与玩法战斗批次：蜃楼祝福/阵容/敌人目录归入 game-content，快照、策略、预览与奖励模型归入 game-domain，生成/完整内容校验/战斗执行归入 game-rules。管理协议使用显式 `CompiledTowerEncounter`，不再通过规则函数的 ReturnType 反向依赖实现。通用战斗输入与恢复状态、突破/宗门/秘境/天骄榜模型独立；对应玩法执行迁入规则包。资源参数规范化函数移入领域资源工具，不改变序列化行为。内容 ID 类型由领域拥有，数值表通过 satisfies 保证完整；没有放宽未知引用、关系循环、预算份额或领奖一致性校验。

本批 65 个既有纯逻辑测试随玩法移动，另两份跨协议/未迁移规则测试保留在 shared，不放宽底层包依赖以迁就测试。搬迁的 8 份 JSON 配置/人物投影基线与 HEAD 逐字一致。6 份配置 README 随内容归位，领域技能更新真实入口。本批通过 lint（11,161 个导入）、16 项类型任务、237 文件/2,398 项测试和 9 项强制构建；Vite 的大 chunk 提示仍存在。

蜃楼检查点的产物验证：frozen install 通过；删除 9 个 workspace 的旧 dist 后重新完成 9 项构建，生成独立生产目录 `/tmp/daoyou-monorepo-api-tower-20261004`。521 个公开 package exports 全部可加载，产物不含 Web 包或 workspace 源码。该目录早于后续讨伐与地图批次，不作为最终运行验收结果。

讨伐与地图批次：地图节点模型、组队模型、讨伐事件和奖励快照归入 game-domain；地图 JSON/查询、难度表、Boss 及技能配置归入 game-content；地图难度、讨伐日程/组队/战斗/结算、排名变化规则归入 game-rules。竞技及讨伐协议进入 contracts。NPC 行动只接收 BattleState，不再通过 Arena HTTP/Redis 协议取类型；奖励快照构造器继续绑定完整 ItemGrantSchema。地图 JSON 与 HEAD 逐字一致。本批通过 lint（11,209 个导入）、16 项类型任务、237 文件/2,398 项测试及 9 项强制构建。

贸易与野外协议批次：邮件附件、拍卖模型、灵兽转移预览、掉落池、野外状态与奖励选择模型归入 game-domain；完整内容校验继续由构造器接收权威依赖，game-rules 绑定当前物品/灵兽规则，contracts 只保留输入输出协议。管理商店、赞助和系统邮件的模型、内容默认值与计算分离。本批通过 lint（11,325 个导入）、16 项类型任务、237 文件/2,398 项测试及 9 项强制构建。

炼丹、背包、修炼与奖励批次：丹药品质/药蕴/修为表、材料价格/预设、灵田配置和奖励 JSON 归入 game-content；评分、堆叠、回收报价、状态恢复、修炼、市场抽样和各玩法发奖计算归入 game-rules。`d3-format` 的直接运行依赖随修炼计算移入规则包，并从 shared 删除。排序/回收测试按协议和玩法分开，保留全部断言。剧情/教学/演出模型与校验归入 game-domain，目录归入 game-content，推进与抽取归入 game-rules；章节 Schema 保留教学存在、链接匹配与奖励唯一性等完整校验。35 份迁移 JSON 与 HEAD 原文件逐字一致。本批 frozen install、lint（11,348 个导入）、16 项类型任务、239 文件/2,398 项测试及 9 项强制构建通过。

宗门组织批次：通用组织接口、展示模型、战斗目标快照归入 game-domain；五宗身份、主题、静态定义及标准展示归入 game-content；准入、任务、经营、奖励计算、注册及生产组合归入 game-rules/sect-organization。原宗门架构守卫跟随规则移动，继续禁止通用核心引用具体宗门，并检查独立内容目录。迁移脚本曾因重复路径分隔符漏写目标，已恢复 99 份源文件并对生产执行部分与上批通过验证的 JS 逐文件核对一致；脚本补充路径规范化、源文件/目标检查及迁移前备份后重新执行。该批通过 lint（11,388 个导入）、16 项类型任务、239 文件/2,398 项测试和 9 项强制构建。随后 frozen install、清空全部 workspace 旧 dist 后的 9 项构建通过；独立生产目录 `/tmp/daoyou-monorepo-api-sect-20261004` 的 588 个公开 exports 全部可由 Node 加载，产物不含 workspace 源码或 Web 包。Vite 仍提示大 chunk；本轮 Docker、API 启停和浏览器验收尚未执行。领域/数据技能校验与 `git diff --check` 通过。

资源协议批次：任务、宗门交付/奖励/战斗目标、闭关结果和人物展示模型归入 game-domain；灵气词汇、数值与恢复计算分别归入 domain、content 和 rules。玩家/宗门/任务/闭关/日志/灵田协议及资源 Schema、分页归并、版本游标和失效处理归入 contracts。`createResourceSchemas` 显式接收原完整 ItemGrant 与宗门交付校验，由 API/Web 各自在 `src/lib/resources/schemas.ts` 绑定，不增加 contracts→rules/content 依赖。背包协议继续使用原先的结构字段投影，领域写入仍保留完整 refinement；没有把背包 wire Schema 描述为完整物品校验。新回归检查确认配置的任务数量上下界和装备校验能够传到资源快照与变更事件。协议测试使用独立领域夹具，测试辅助文件从生产编译排除。该批 lint（11,454 个导入）、16 项类型任务、239 文件/2,400 项测试通过；清空全部九个 workspace 的 dist 后完成九项强制构建。Vite 的 Phaser 大 chunk 提示仍存在；Docker、API 启停和浏览器验收保持待办。

资源批次产物检查：`pnpm install --frozen-lockfile` 与 `pnpm --filter @daoyou/api deploy --prod /tmp/daoyou-monorepo-api-resources-20261004` 通过。在该独立生产目录内，Node 成功按包名加载 599 个公开 exports，并初始化 API 的 21 个资源主题校验；目录中没有 workspace 源码、Web 包或新增协议测试夹具。领域/后端技能校验及 `git diff --check` 通过。独立包解析不替代 API 启动、Docker 或浏览器验收。

领域事件与物品展示批次：历史物品库、邮件附件、事件数据与物品展示模型进入 game-domain；实际附件/事件内容校验、物品库奖励投影和炼丹/铸造展示进入 game-rules；物品库管理输入、NATS subject/version/信封、世界聊天与实时协议进入 contracts。API 在 `lib/mq/domainEventSchema.ts` 组合信封解析与完整规则校验。八份已无过渡依赖的测试随所属包移动，混合测试分离且保留断言；新增事件 refinement 传递回归检查。本批 lint、16 项类型任务及 241 文件/2,401 项测试通过。

功法与秘境批次：功法命令、悟道/阵纹预览、旧功法/道装补偿模型归入 game-domain；悟道、阵纹和补偿数值表归入 game-content；执行规则归入 game-rules，悟道/阵纹请求归入 contracts。秘境材料选择、奖励与运行状态模型归入 game-domain；费用/结算配置和计算分别进入 content/rules。结算 Schema 构造器继续接收完整 ItemGrantSchema；原协议不额外校验奖励 definitionId 的目录存在性，物品入库校验仍由既有规则负责。对照 HEAD 的 41 个规则函数编译后函数体一致。原混合协议断言单独归位，新秘境回归检查覆盖数量、嵌套事实及注入 refinement；首轮新测试误把目录校验视作 ItemGrantSchema 职责，核实并修正测试后全量通过。当前通过 frozen install、lint（11,550 个导入）、16 项类型任务、246 文件/2,404 项测试。干净构建及独立产物验证另行记录。

功法与秘境批次产物检查：清空九个 workspace 的 dist 后完成九项强制构建，生成独立生产目录 `/tmp/daoyou-monorepo-api-domain-tail-20261004`。Node 按包名成功加载 620 个公开 exports，并初始化 API 的 21 个资源主题与领域事件解析绑定；产物不含 workspace 源码、Web 包或协议测试夹具。领域/后端技能校验和 `git diff --check` 通过。Vite 的 Phaser 大 chunk 提示仍存在；Docker、API 启停与浏览器验收尚未执行。

配置与协议收口批次：符箓/社交/市场数值、身份题库、卦象与签文归入 game-content；文本过滤、求签模型、日志变化和讨伐事件 ID 归入 game-domain；选题、求签奖励、签文抽取和日志归并进入 game-rules。求签模型以稳定 ID 和独立展示字段表示，不通过内容文案的字面量类型反向引用内容包。LLM BYOK/路由配置解析、爱发电协议、管理设置输入及开发工具请求进入 contracts；网络调用仍属于 API。纯本地开发工具开放策略在 contracts/dev-tools-access，实际环境读取和执行检查继续由 API 负责。数据库设置键与服务端 QQ 默认值归入 API 私有配置，没有放进全局 constants。contracts 编译环境补充跨 Node/浏览器的 WHATWG URL 类型，不引入 Node 运行依赖。

开发工具 Schema 构造器由 API 的 `dev-tools/dev-tools-input.ts` 绑定当前感悟/灵根上限及奖励/邮件完整校验。类型抽取不降低请求严格度；新增纯校验用例验证上限与灵根总强度依赖传递。其余混合测试拆成协议和玩法两部分；规则包不为测试反向依赖 contracts。34 个本批迁移函数的编译函数体与 HEAD 一致，LLM 路由语法、默认模型、BYOK 校验与粘性选择均保持。该批 frozen install、lint（11,592 个导入）、16 项类型任务、255 文件/2,407 项测试通过。

配置与协议批次产物检查：再次清空九个 workspace 的 dist 并完成九项强制构建；独立生产目录 `/tmp/daoyou-monorepo-api-protocol-tail-20261004` 的 628 个公开 exports 均可按包名加载。API 的 21 个资源主题、领域事件解析器和两份开发工具请求校验成功初始化；目录不含 workspace 源码、Web 包或协议测试夹具。Vite 仍有 Phaser 大 chunk 提示。技能校验和 `git diff --check` 通过；Docker、API 启停与浏览器验收保持开放。

### 八工作区收口与最终静态验收

竞技快照、运行模型与持久回放归档进入 game-domain；竞技模拟、可见性过滤与回放投影进入 game-rules；HTTP/WS/MQ 元数据保留在 contracts。API 的 `combat/arena-view.ts` 为快照和缓存回合结果补回原版本字段。全部原断言保留，协议断言迁入 contracts，竞技/回放针对性 3 文件/30 项检查通过。

删除 shared 后，`pnpm install --frozen-lockfile`、`pnpm run typecheck`（14 项任务）、`pnpm run lint`、`pnpm run test`（256 文件/2,409 项）通过。清除八个 workspace 的旧 dist 后，`pnpm exec turbo run build --force` 完成 8 项构建。独立目录 `/tmp/daoyou-monorepo-api-six-packages-20261004` 中 630 个公开导出均可按包名加载，21 个资源主题、领域事件解析、开发工具 Schema 和竞技 API 适配均可初始化；产物不含 shared、Web、workspace 源码或资源协议测试辅助文件。

应用边界核对：Market 使用角色查询 Provider 和背包回收入口；Auction/Mail 在 Module 中组合依赖，跨领域邮件投递要求显式事务；Player 协调器复用同一实例；Runtime 管理任务与消息启停。仓储没有反向导入 application，数据库/Redis 客户端保持单一入口。并未将每个 Nest feature 拆成 workspace，也未为无状态函数新增包装 Provider。

Web 的请求入口为 apiFetch，资源定义/缓存/订阅归属 lib/resources，路由负责装配页面与布局。发现秘境公共 Hook 从页面私有组件取回调类型，已将类型移入 `lib/hooks/dungeon/types.ts`，三个调用方改为向内依赖；ESLint 新增公共 lib/components/providers 不导入 routes 的限制。该收口后 lint（8 个 workspace、11,609 个导入）与 Web 类型编译/构建再次通过。

Docker 本地镜像 `daoyou-monorepo-review:local` 构建通过，以非 root 用户 1000 运行；容器内六个库、竞技规则和 API 适配可正常解析，没有 shared/Web/API 源码。镜像使用本地专用数据库、Redis、NATS 启动后，健康检查四项均 up。未推送镜像或执行数据迁移。构建仍提示 Phaser 单 chunk 约 1.37 MB（gzip 约 358 kB），属于后续性能优化项。


### 本轮本地运行验收（2026-10-04）

| 验收范围 | 实际结果 |
| --- | --- |
| API 与认证边界 | 编译产物启动成功；无 Cookie 的 `/api/player/resources?keys=session` 返回 401；浏览器既有本地道友 2 会话可读取资源 |
| 启停与交付 | 宿主 API 的 SIGTERM 日志依次显示停止调度、排空请求、停止消息、关闭数据库/Redis及 shutdown complete；随后 Docker 镜像接替同一本地端口，四项健康检查全 up；容器 SIGTERM 正常退出 0 |
| 生产配置保护 | 使用本地镜像且 `--network none` 检查缺失 Redis 的 production 配置，明确在启动前拒绝；没有连接外部环境 |
| SPA 与懒加载 | 洞府、角色、背包、宗门舆图、灵田及 HUD 炼体详情正常显示；背包直接刷新后恢复 34/40 格及原物品 |
| 实时恢复 | 主动停 API 时出现预期代理 502 / WS 重连；Docker API 启动后请求恢复 200、WS 握手恢复 101，页面显示“实时功能连接已恢复” |
| 回放 | 真实历史竞技战绩 `13094a0b-34fd-443b-9cfb-e11c50b9b926` 正常加载；逐行动从 0/69 到 1/69，跳转第 18 回合后推进至 69/69，终局与敌方百分比展示正常 |
| 训练 | 通过真实页面开启单体木桩训练，人物/灵兽防御指令推进到第 2 回合；随后正式放弃并返回准备页。训练后的角色仍为气血 996、法力 900、灵石 42870、背包 34/40，没有遗留活动训练 |
| 响应式 | 360×800 背包视口下 document/body 宽均为 360，截图确认 HUD、物品网格及底部导航正常；已恢复默认视口 |
| 错误观察 | 最终刷新后的浏览器 error 日志为空；服务端未观察到启动或请求异常。停机期间的预期 502 不计作迁移失败 |

本次使用已有本地账号/角色，没有发放物资、修改角色准备数据、执行迁移或对外发消息。临时 API、Web 与验收容器已关闭，本地 PostgreSQL/Redis/NATS/Mailpit 保持原状。截图保存在 `/tmp/daoyou-monorepo-mobile-acceptance.jpg`；构建、测试、部署目录和容器日志分别为 `/tmp/daoyou-six-packages-*.log`，前端收口检查为 `/tmp/daoyou-final-app-*.log`。七份修改技能的 quick_validate 与 `git diff --check` 通过，原有两份暂存文件保持原样。

六包结构迁移及上述本地回归已完成。没有将本次抽样回归描述为所有玩法验收：新登录/自然续期、多玩家新竞技胜利结算、真实目标环境的维护发布与回滚未在本轮重跑；历史道装迁移仍在已排除范围。它们继续属于业务/发布验收，不能由本地结构通过替代。

### 结构迁移后的废弃代码下线（2026-10-04）

本批从干净的 `c6f68d33`（结构优化）开始，按用户追加要求审查并下线过时代码。六包迁移的历史验收数据保留在上文；本节记录清理后的实际结果。唯一删除的 HTTP 路由是 `/api/dungeon/limit`，其余改动为无消费者代码退役、兼容调用迁移和测试辅助产物隔离。

审查以 API/Web 启动入口和维护脚本为根，解析静态导入、再导出、字面量动态导入及内联类型导入，并按 workspace exports 还原到源码；随后核对全仓符号引用、Nest 模块/路由及当前业务替代路径。初次扫描 2,047 个 TS/TSX 文件，生产入口不可达候选 33 个；不可达或名称含 legacy 本身均不作为删除依据。清理后扫描 2,016 个文件，生产入口可达 1,755 个，剩余 5 个非测试文件候选均为被测试使用的辅助文件。该静态检查不证明所有导出成员、外部消费者或历史数据都已没有用途。

| 下线范围 | 依据与当前路径 |
| --- | --- |
| 秘境每日次数接口、Redis limiter、Web Hook | Web Hook 没有消费者，次数扣除函数没有调用；现有开始流程由 `QiService` 的 `dungeon_start` 灵气预留控制。删除接口后返回 404，不再提供失效的每日两次信息；没有清空 Redis 数据 |
| 旧秘境奖励表、结算 policy、LLM 奖励 Schema/上下文及修为工具 | 当前奖励由 `dungeon/application/flow/rewards.ts` 与 `game-rules/rewards/dungeon` 确定性计算，结尾生成器只提供叙事与评级；旧实现没有生产消费者 |
| Web 孤立组件与过渡层 | 删除旧 StatusCard、PersistentStatusesCard、秘境进度/费用卡、TypewriterText、InkPageShell、gameShellRegistry、旧 inventory 资源入口；实际路由嵌套与现有资源存储保持。InkCard 唯一旧 `highlighted` 调用改为等价的 `variant="highlighted"` |
| 领域/规则兼容入口 | 删除无消费者的 dictionaries、tags 及若干 barrel/别名；角色生成从旧包装器直接调用 `CharacterGenerator.generate`，参数和返回值保持 |
| API 无调用成员 | 删除 7 个旧资产仓储包装/扣除函数、Market/在线状态旧测试钩子、废弃 SectPermission 别名及恒为 false 的秘境刷新辅助函数；仍被调用的事务入口保留 |
| 测试辅助产物 | 保留 5 份被测试引用的夹具/辅助源码，撤销其中 3 个包导出，并从生产编译排除。结算完整校验回归测试保留，在测试内组合 Schema |

共删除 31 个文件及 13 个公开子路径导出；13 个导出中有 3 个属于仍保留源码的测试辅助文件。删除的 `settlementPolicy.test.ts` 仅覆盖同期退役的旧策略，因此测试从 256 文件/2,409 项降为 255 文件/2,401 项，现行奖励与校验测试仍保留。

明确保留：洞府旧储藏室、功法/道装兑换及其读写链路、仍被调用的旧资产事务函数和数据库表；历史物品 `quality_hint`、炼丹 `yieldQuantity` / `secondaryEffectMultiplierBonus`、待处理消息兼容分支及历史资源文件。这些仍涉及在线入口或存量事实，不能随目录改造删除。表级退役继续参照 [旧表退役记录](combat-v6-legacy-table-retirement.md)，本批没有执行数据库迁移、删表或资产数据清理。

本批验证：

- `pnpm install --frozen-lockfile`、`pnpm run lint`（8 个 workspace、11,505 个导入）、`pnpm run typecheck`（14 个 Turbo 任务及根工具类型检查）全部通过。
- `pnpm run test`：255 个文件、2,401 项全部通过。清除八个 workspace 的旧 dist 后，`pnpm exec turbo run build --force` 完成 8 项构建；Phaser 大 chunk 提示仍存在。
- `pnpm --filter @daoyou/api deploy --prod /tmp/daoyou-retirement-api-20261004` 成功；独立生产目录内 617 个公开 exports（含 JSON）均可加载，21 个资源主题、领域事件、开发工具 Schema 和竞技 API 适配可初始化。删除文件对应的 JS/声明/映射以及 5 份测试辅助文件均未进入产物；没有 shared、Web 包或 workspace 源码。
- 本地编译 API 启动成功，health-check 的数据库、Redis、NATS 和消息状态全 up；已移除的 `/api/dungeon/limit` 返回 404。浏览器既有本地道友 2 会话下，秘境准备页正常显示，背包保留 34/40 格及既有物品，未观察到浏览器 error 日志。
- 寄魂庐页面显示既有身份权限门槛，未进入内部卡片；`highlighted` 调用迁移只完成静态等价核对及编译检查，不记作该卡片的视觉验收。没有执行新角色 LLM 生成、新秘境结算、兑换写入、完整玩法回归或生产/预发布验收；本轮未重建 Docker 镜像，独立生产目录验证不替代容器验收。
- 游戏 UI 技能 quick_validate 与 `git diff --check` 通过；同步修正 AGENTS、UI 技能及布局所有权文档中的已删除入口。

本批未提交、推送或部署。临时浏览器、API 和 Web 已关闭；API SIGTERM 日志确认请求排空、消息停止、数据库/Redis 关闭及 shutdown complete，本地基础服务保持原状。构建、测试和运行日志保存在 `/tmp/daoyou-retirement-*.log`；静态审查工具只用于本地检查，未新增仓库测试脚本。

### 后续演进的边界

当前目标稳定在两应用、六库。constants 只收稳定词汇；数值和目录继续进入 game-content，领域事实进入 game-domain，执行计算进入 game-rules，HTTP/实时信封进入 contracts。服务端环境、数据库设置键及供应商连接配置由 API 自己拥有。禁止重新建立聚合 shared/utils 来回收这些职责。

继续改进的顺序为：先完成配套发布验收；再根据实际加载分析优化 Phaser 入口和体积；日常按具体业务收窄公开子路径和跨 feature 入口。仅当出现第二个真实 UI 消费者或独立 worker 部署单元时，再讨论 ui/api-client/server-infra 包。单纯增加目录或把所有常量搬到同一处不作为进一步拆包的依据。

## 依赖与所有权

- 保留 `apps/api`、`apps/web` 及本页列出的六个库，共八个工作区。两个应用独立构建，在停机维护窗口内配套发布；应用之间通过 HTTP/SSE/WS 通信，不相互导入。
- Controller 处理身份、输入与响应；应用层组织业务流程；repository 负责存储和映射；六个内部库分别承担词汇、模型、内核、内容、计算和协议。
- 跨领域使用职责明确的公开入口，不建立导出整个 feature 的聚合 barrel。需要长期存在或组合外部依赖的应用对象由 Module/Provider 或明确的生产组合入口管理；无状态计算保留普通函数。
- 玩家状态协调属于 `player/application/state`，负责命令、事务、幂等、资源版本与提交响应。角色、战斗等领域仍拥有各自规则，通过窄入口供协调器调用。
- `lib` 保留数据库、Redis、NATS、认证、LLM 等共享技术设施。具体秘境/蜃楼玩法归属对应 feature；业务消息处理器注册归属 Runtime 组合层。
- repository 不调用应用服务；写路径必须传递同一个 `DbExecutor`/`DbTransaction`，不在事务中回退到全局客户端。

## 提交顺序

1. 解析身份与请求，执行角色/玩法锁和权限校验。
2. 在原有事务内执行必要资格检查、资产写入、角色资源刷新、日志及资源版本提交。
3. 需要可靠交付的事件在事务内写入现有 outbox，发布/消费沿用原有恢复与去重机制。
4. 提交后通知浏览器；失败通过资源补读或已有消息恢复路径处理。

不把同步一致性规则改成异步事件，不改变锁、CAS、幂等键、消息确认或停机排空顺序。

## 前轮应用迁移批次与验收（历史）

| 批次 | 范围 | 验收 |
| --- | --- | --- |
| 1 | 固定边界与基线 | 当前 lint/typecheck/build/shared 测试结果明确 |
| 2 | 坊市购买与回收样板 | Provider 依赖可见；正常/失败/重复请求保持原协议与资源提交 |
| 3 | 玩家状态协调层归位 | 全部调用方迁移；事务与同步刷新顺序保持 |
| 4 | 秘境/蜃楼归位、应用对象与消息组合 | 无旧导入；启动、readiness、停机及受影响流程验证 |
| 5 | shared 公开入口与 SPA 路由/HUD | 包解析通过；路由路径/顺序/布局/场景 metadata 保持，360px 与桌面核对 |
| 6 | 发布质量与版本追溯 | tag 发布依赖同 revision 的质量检查；镜像 revision/digest 可追溯，记录前端 build ID |

每批仅改变结构和依赖，协议、游戏规则、数据库模型的变化另列任务。Lint、类型检查、构建、静态依赖审查是共同基线；运行验证使用 `docs/testing.md` 的真实本地流程，不新增服务 mock 或临时测试脚本。

## 公共包与前端

契约、领域规则、展示计算和历史迁移辅助按本页依赖图归属对应包；新增公开能力需声明 exports，宿主不绕过包入口。核心引擎保持确定性，历史便捷函数的默认随机/时钟行为不代表战斗核心协议。

前端 router 统一组装领域路由定义；定义保留 lazy 导入、稳定 route id、scene/title 和原始嵌套顺序。HUD 展示与详情交互分别拥有职责，继续复用 ResourceStore/apiFetch。

## 停机维护与配套发布

2026-10-04 用户确认：发布时停机维护，SPA 与 API 配套更新。旧 SPA 与新 API 的交叉版本兼容不作为设计或验收要求，契约变更可在同一发布中同步修改两端。

维护窗口内先停止新请求和后台任务，按现有顺序排空 HTTP 与消息处理，再更新配套 API、SPA 和必要的数据变更。记录 API revision、不可变镜像 tag/digest 和 SPA build ID；在恢复入口前验证健康检查、认证、实时连接及资源协议。恢复后要求页面重新加载当前 SPA，避免继续使用维护前已打开的页面。

回滚以配套 API 与 SPA 为单位；若涉及数据变更，须同时确认旧版本可读取更新后的数据，或准备相应数据恢复方案。镜像回滚不能撤销数据迁移，停机也不会自动清空 Redis 活动状态或 NATS 待处理消息，需在有相关协议变更时单独检查。

历史道装数据迁移按用户要求从后续改造范围排除。本地自然会话续期与双账号胜利结算的新增证据见下方“迁移后审计与发布前验证”；真实目标环境的维护发布／回滚仍待验收，本地结果不替代这些证据。

## 实施状态

六个批次的代码与配置已于 2026-10-03 落地。完整检查、真实本地流程、失败/重放与目标环境的未验证项见 [架构记录第 7 节](monorepo-architecture.md#7-后续六阶段实施与验收记录)。代码完成和生产发布验收分别记录：本轮没有提交、推送、数据库迁移或生产部署。

2026-10-04 追加完成拍卖／邮件应用对象 DI、邮件事务投递入口、秘境存储与结尾生成拆分，以及 Runtime 注入任务映射。公开背包操作保留显式事务的函数入口，Redis 与 Player Provider 复用既有单例。新增拍卖／邮件私有实现导入约束。本轮实测、结构完成条件与停机发布清单见 [架构记录第 11 节](monorepo-architecture.md#11-拍卖邮件秘境与-runtime-依赖收口)。生产发布和未覆盖业务验收单独保持开放。

## 迁移后审计与发布前验证（2026-10-04，基线 4c91ab07）

### 1. 迁移差异审计

对比六包迁移前的 `5df044ad` 与当前代码。静态审查按唯一声明名匹配编译后的初始化表达式/函数体，忽略导入路径和类型：3,379 项主体一致，其余候选逐类核对。此数字包含局部声明，不是全部函数的覆盖率；主体一致也不能单独证明导入绑定和初始化顺序一致。

| 问题或审查点 | 结论与处理 |
| --- | --- |
| P2：边界检查把空命名导入/导出视为纯类型 | `every` 对空数组返回 true，导致 `import {}` / `export {}` 的运行时模块执行绕过 game-domain→combat-core 仅类型限制。增加非空检查；临时静态探针确认两者退出 1，真正的 import type 退出 0，探针已删除 |
| P2：公开子路径暴露内部实现 | 收回四个 private 包共 38 个无仓库消费者的 exports：contracts 1、domain 1、content 14、rules 22。源码与包内相对引用保留；收窄后公开入口由 617 减到 579；加载优化另增加一个轻量宗门定义入口，最终为 580。没有把无外部引用等同于无运行用途 |
| 资源协议组合 | API/Web 的 lib/resources/schemas.ts 都向 contracts 构造器注入完整 ItemGrant 与宗门交付 Schema；广播、数据库事件读取及 Web Store 均使用宿主绑定。bag 原本即使用 shape 投影，未把它误认成完整写入校验 |
| 领域事件、开发工具与灵兽输入 | 事件 envelope 保留 subject/version/strict 校验，payload 由规则包绑定；开发工具保留真实数值上限、奖励/邮件校验，灵兽分配绑定当前点数公式 |
| 默认值与内容校验 | 背包格位/数量/个体身份、装备属性/阵纹、灵兽技能/物种/容量和交付数量上下界保留。原有 unknown/any 历史字段没有被本轮扩宽；资源变更 superRefine 只校验不回写内部默认值的行为也沿用旧实现 |
| 导入副作用 | 五宗注册表迁至 game-content 后仍执行技能学习内容校验；API/Web 通过包 exports 加载，未添加全包 sideEffects:false。规则层仅类型依赖与实际绑定分开审查 |
| 竞技协议、事务与锁 | arena-view 宿主装饰器补齐 API/protocol 版本，包含缓存回合结果；竞技 service/store、占用检查、Player 状态提交、事务及消息结算主体对比一致，调用转向对应包/宿主绑定。未改 CAS、请求幂等或消息确认语义 |
| 秘境重复定义 | API 的轮次 Schema 比领域模型多 10 项奖励上限及 0–100 危险值限制，结算多 10 项标签上限；差异在拆包前已存在。本轮不直接替换为较宽领域 Schema。仍需单独按输入/持久状态职责合并，不能做文本式去重 |
| 历史兼容 | 旧储藏室/兑换仍有入口，炼丹旧字段与待处理消息属于存量兼容；保持上一轮明确的保留边界，不清数据或删表 |

建议提交划分（本轮不自动提交）：① 边界判定修复；② 四包 exports 收窄；③ 实测后确定的 Web 加载优化；④ 本节验收记录。每组可独立审阅，未用格式化掩盖迁移差异。

### 2. 高风险业务验收

环境：本地编译 API + Vite production preview，页面为 `127.0.0.1:5174`，数据库/Redis/NATS 均为 local 配置。两个独立浏览器会话分别为 IAB 的本地道友 2、Chrome 的本地道友 1；权限检查再通过正常退出/密码登录切换至本地道友 3。未修改认证时间、直接写数据库或注入角色配置。

| 路径 | 本轮结果与证据 |
| --- | --- |
| 自然会话续期 | Chrome 旧会话创建于 2026-09-19，本轮读取后数据库 updatedAt=2026-10-04T07:40:13.287Z、expiresAt=2026-10-11T07:40:13.287Z，页面正常进入洞府。未捕获续期前数据库值与 Set-Cookie，因此这是数据库时间和页面联合证据，不是完整 Cookie trace |
| 新登录 | 道友 1 正式退出后由用户完成浏览器登录，本轮确认新 session 创建于 2026-10-04T07:59:14.232Z 并进入洞府；道友 3 由自动化完整执行密码登录，直接进入本人洞府，无旧账号资源残留 |
| 双账号完整结算 | 房间 457804、战局 `1961a671-e428-4668-a819-5aa8abbb0f27`，双方准备开战，自动指令正常推进，25 回合自然终局：道友 1 胜利，道友 2 及灵兽落败。双方点击结束后退出战斗，页面恢复原有资源；没有用逃跑代替胜负验收 |
| 战斗中断线恢复 | 第 1 回合 SIGTERM 停止本次 API，页面显示“连接恢复中”并禁用指令；重启后 WebSocket 重新握手 101，两端自动恢复同一战局，后续正常终局。覆盖实际服务重启，不等同于所有网络分区/超时场景 |
| 重复请求与冲突 | 重放已观察到的第 3 回合 AUTO 指令及同一 requestId，两次串行和终局后两次并发请求均返回相同 200 accepted。保持 requestId、改 round 为 4 返回 409“请求 ID 已用于其他指令”。终局前后重放不增加回合；终局 revision 保持 120 |
| 归档与占用释放 | PostgreSQL 仅一份 archive、两条 participant，source=arena-sparring、outcome=side-0、roundCount=25；Redis 双方 active/arena occupancy 四键均为空。战斗中读取与退出后读取的持久 condition、灵石、声望一致；此比较从战斗中采样，不宣称覆盖开战前全部持久字段 |
| 私有回放权限 | 双方可打开新回放，各自看到本人精确资源和敌方百分比；未登录 API 返回 401；非参战道友 3 打开私有页显示“战斗回放不存在”，read 与 share API 都返回 404 |
| 公开回放权限 | 由参战道友 1 点击“复制公开链接”，道友 3 可读取固定的道友 1 视角；公开 API credentials:omit 返回 200。生成公开链接后，道友 3 的私有 read 仍返回 404。未发送世界聊天消息 |

本场归档与公开链接作为本地测试记录保留，所有活动战斗已正常结束。本轮没有覆盖新注册/邮箱验证、GitHub OAuth、多人观战席、生产代理/Cookie 域配置、故障矩阵及真实维护发布/回滚；这些不能由当前本地结果推定通过。

截图：`/tmp/daoyou-priority-arena-terminal.jpg`（胜利）、`/tmp/daoyou-priority-replay-denied.jpg`（非参战者拒绝）、`/tmp/daoyou-priority-replay-public.jpg`（公开视角）。后端恢复日志为 `/tmp/daoyou-priority-api-recovery.log`。
### 3. 增量工程链

已实测同一工作树的 Turbo build：首次 8 项执行 15.667 秒，立即重跑 8/8 缓存命中 1.115 秒。只在 game-rules/qi/actions.ts 临时追加注释后，rules/API/Web 三项 hash 改变并重建，其余五项 hash 不变且命中缓存（12.234 秒）。注释仅为本地静态构建探针，已经恢复，未改变游戏数值。

同时运行 pnpm dev：修改公共包后 game-rules/dist 包含新注释，API 监听 PID 从 29782 变为 29969、Web 从 29709 变为 29936，证明两个持久任务均被重启。CI 的 PR/master 和 tag 发布共用 quality-check.yml，调用与本地相同的 pnpm run lint→check:boundaries，tag 镜像任务依赖 quality 成功。

恢复探针后再次构建，8/8 缓存命中，0.789 秒。原始证据：`/tmp/daoyou-priority-build-{baseline,warm,rules-change,restored}.log`、`/tmp/daoyou-priority-watch.log`，及 `.turbo/runs` 对应四份 summary（包含任务 hash/cache 状态）。

### 4. SPA 加载测量

使用 production preview、同一 IAB/本地道友 2 的洞府页面、禁用 HTTP 缓存，各完成三次全页刷新，等待“洞府各处”及 networkidle。通过 PerformanceResourceTiming 记录同源资源，资源计数/体积不含 HTML 文档；JS 使用 encodedBodySize，全部资源使用 transferSize（含浏览器计入的响应开销）。未限速，地址为回环网络；FCP 包含启动画面，不代表全部玩法可交互时间。

| 指标 | 优化前 | 最终构建 | 变化 |
| --- | ---: | ---: | --- |
| 同源资源请求 | 84 | 78 | -6 |
| JS 请求 | 63 | 57 | -6 |
| 同源资源传输字节 | 669,932 | 558,755 | -16.6% |
| JS 响应体传输字节 | 430,032 | 320,675 | -25.4% |
| DOMContentLoaded 中位数 | 43.1 ms | 36.6 ms | 本地小样本，仅记录 |
| load 中位数 | 45.5 ms | 39.3 ms | 本地小样本，仅记录 |
| FCP 中位数 | 52 ms | 60 ms | 有波动，不能宣称整体加载加速 |

三轮请求数与传输字节各自相同。优化前 DCL 为 47.5/43.1/34.9 ms、load 为 50.9/45.5/37.3 ms、FCP 为 64/48/52 ms；最终 DCL 为 44.2/36.6/34.4 ms、load 为 49.4/39.3/37.1 ms、FCP 为 64/52/60 ms。最终测量时近期战绩增加本轮切磋，API 内容有少量变化；JS 响应体不受此影响。证据为 `/tmp/daoyou-spa-before.json` 和 `/tmp/daoyou-spa-after-final.json`。

具体调整：

- 新增 game-content 的轻量宗门定义目录，复用五宗原始 definition 对象；HUD 的身份/版本校验和成员状态从 sectContext 获取，不初始化完整玩法模块。纯测试核对目录与生产模块 ID 一致、对象完全相同及未知 ID 拒绝。
- 宗门玉牒详情按打开动作懒加载，保留加载反馈、版本错误和既有前往宗门操作；组件与 hook 分文件以维持 Fast Refresh 边界。
- 洞府 route、HomeView、HomeAside 改用 GameSceneFrame/GameSceneSection 的直接入口，解除 game-shell 聚合入口经 CultivatorOverviewPanel 拉入的完整宗门和战斗内容注册表。
- 优化前后首屏都没有 Phaser 请求，因此没有依据再调整 Phaser 拆包。原先首屏加载的 sectPresentation（55,025 字节）与 battle 注册表（54,601 字节）现已移出首屏。保留真实内容校验副作用，没有全包声明 sideEffects:false。

实际打开宗门玉牒、关闭并进入宗门地图均正常；本轮两账号战斗和新回放也在此构建链上运行。Vite 仍提示大型 Phaser chunk，此提示代表延迟路由产物体积，不再等同于首屏成本。

### 5. 交付检查与提交边界

- `pnpm install --frozen-lockfile`、`pnpm run lint`（8 workspace、11,525 imports，零 warning）、`pnpm run typecheck`（14 Turbo 任务及根工具）、`pnpm run test`（256 文件/2,402 项）、`pnpm run build`（8 任务）全部通过。
- `pnpm --filter @daoyou/api deploy --prod /tmp/daoyou-priority-api-deploy-20261004` 成功；在独立生产目录内逐一加载六库全部 580 个公开 exports（含 JSON）成功。
- 日志保存在 `/tmp/daoyou-priority-{install,lint,typecheck,tests,build,deploy}-final.log`。本轮没有新增 API/Web 单元测试、一次性集成测试脚本或故障服务。
- 建议四个提交：`fix(tooling): 拒绝空命名运行时导入绕过包边界`；`refactor(packages): 收窄未使用的公开子路径`；`perf(web): 延迟宗门详情并移除洞府的重型聚合依赖`（含新 definitions export 与纯测试）；`docs: 记录迁移审计和本地发布前验收`。第二和第三组同改 content manifest，审阅/暂存时按 hunk 划分。
- 未执行 Docker 镜像重建、预发布/生产部署、数据迁移及真实发布/回滚演练；独立 deploy 验证不代替容器或目标环境验收。没有自动 commit/push。

本轮收尾：IAB 已恢复本地道友 2 登录，第三账号临时会话已退出；浏览器禁用缓存设置已恢复，两个临时页面与本次 API/preview 服务已关闭。本地数据库、Redis、NATS 等基础服务保持原状。`git diff --check` 通过。

## 公共导出收敛（2026-10-04）

本批从干净的 `89f7575b` 开始，按用户确认的方案将文件级公开入口收敛为业务 API。以下数据是本批结果；上文 580 个导出为本批基线，不再代表当前数量。

| 包 | 改造前子路径数 | 改造后子路径数 |
| --- | ---: | ---: |
| constants | 3 | 3 |
| combat-core | 9 | 9 |
| game-domain | 153 | 57 |
| game-content | 182 | 81 |
| game-rules | 168 | 92 |
| contracts | 65 | 62 |
| 合计 | 580 | 304 |

减少 276 个公开子路径（47.6%）。数量统计的是 package.json 的 exports 键，不是导出符号数。新增 92 个显式公共入口文件，原实现继续留在各领域目录；API、Web、跨包引用和测试同步迁移，不保留旧路径兼容别名。

### 当前公共 API 约定

- 调用方按业务能力导入，例如 `@daoyou/game-domain/equipment`、`@daoyou/game-rules/inventory`、`@daoyou/contracts/combat/arena`，无需知道内部 types、pack 或 config 的文件布局。一个已有小模块可以直接作为公开入口，不强制套一层转发文件。
- `src/public/**` 使用具名导出，运行值与 `export type` 分开；禁止 `export *` 和 namespace 再导出。package.json 继续逐项声明 exports，禁止通配符，也不增加整包根 barrel。
- 领域模型、Schema 构造器、内容目录和绑定完整校验的规则仍由各自的包负责。入口合并不改变 `contracts ↔ game-domain ↔ game-rules` 的依赖方向；API 原有组合位置保留。
- 类型入口保留被合并模块的类型声明，包括没有被直接 import、但可能被推导出的公开函数签名引用的类型。仅按直接调用统计删除类型会使消费者的声明生成失败（本批曾发现 TalismanSpec 的 TS2883，并已修正）。
- 轻量入口与重型内容初始化保持分开：content 的 `equipment/base`、`equipment/forging`、`equipment/special`；domain 的 `character/generation`、`equipment/authoring/*`、`sects/commands`；rules 的 `inventory/stacking`、`sect-organization/tasks`、`combat/log`、`combat/appearance`、`combat/presentation`、炼体进度/训练及两类消耗品规则。它们是加载与职责边界，不应仅为减少行数继续合并。
- `game-content/authoring/**` 面向内容校验测试和维护工具；应用和库的非测试源码不得消费它。包内校验仍通过相对路径访问自身实现。五个原始 JSON 入口 `authoring/equipment/{base,forging}`、`authoring/beasts/{species,skills,progression}` 单独保留，以维持既有内容替换测试的 mock 边界。
- 没有添加全包 `sideEffects: false`，原注册表与 Schema 初始化校验仍执行。导出数量下降不等于所有加载成本下降；新增入口必须同时考虑消费关系和首屏依赖。

上述规则进入 `AGENTS.md`；技能中的实际包导入路径同步更新。`check-package-boundaries.ts` 新增 runtime/authoring 和 public 具名导出检查，随现有 `pnpm run lint` 进入 CI。临时违规探针验证两条规则均能拒绝对应导入/再导出，探针已删除。

### 迁移范围与行为核对

合并了迁移后 340 处重复 import；两个纯内容测试按所有权移动：`game-rules/src/equipment/special-pack.test.ts` → `game-content/src/equipment/special-pack.test.ts`，`game-rules/src/combat/encounter/pack.test.ts` → `game-content/src/combat/training/pack.test.ts`。断言保留，依赖规则的跨层测试仍留在 rules。

对 930 个已修改的既有源码文件，排除 import/export 声明并规范化测试 mock 中的包路径后，编译词法流的非导入部分与基线一致。本检查确认业务语句没有随路径迁移重写，不能单独证明模块求值顺序和副作用等价，因此另做全量纯测试、干净构建、逐导出加载和页面回归。Schema、默认值、协议、事务与锁没有新增实现变更。

### 同模式生产首屏对比

从 `89f7575b` 的隔离 Git 快照重建 production Web，与当前干净 production 构建在同一 preview 地址、同一 IAB/本地道友 2 会话、禁用 HTTP 缓存条件下各刷新三次；等待洞府内容和 networkidle。临时 development-mode 构建数据已排除。以下资源不含 HTML，JS 字节为 encodedBodySize，同源总字节为 transferSize。

| 指标 | 基线 production | 当前 production |
| --- | ---: | ---: |
| 同源资源请求 | 78 | 79 |
| JS 请求 | 57 | 58 |
| JS 响应体字节 | 320,670 | 326,283 |
| 同源资源传输字节 | 558,750 | 564,663 |
| DOMContentLoaded 中位数 | 56.8 ms | 54.1 ms |
| load 中位数 | 59.4 ms | 57.5 ms |
| FCP 中位数 | 68 ms | 60 ms |

三轮请求数和字节数分别稳定；当前 JS 增加 5,613 字节（1.75%），是本次业务入口聚合后的实测代价。没有把本次重构表述为性能优化。回环网络未限速、样本小，时间只供记录，不能宣称加载加速。基线 DCL 为 59.1/56.8/35.6 ms、load 为 65/59.4/38 ms、FCP 为 72/68/40 ms；当前分别为 66.1/54.1/34.5 ms、71.7/57.5/36.8 ms、60/64/56 ms。

初次较宽的聚合使首页日志经战斗展示引入重型注册表，已拆回上述轻量入口。最终首屏没有 Phaser 请求，宗门玉牒仍点击后加载。Vite 的 Phaser 大 chunk 提示保留。原始记录：`/tmp/daoyou-exports-browser-{before,after}-production.json`。

### 本批验收与审阅方式

- `pnpm install --frozen-lockfile`、`pnpm run lint`（8 workspace、11,649 imports）、`pnpm run typecheck`（14 Turbo 任务及根工具）通过。
- `pnpm run test`：256 文件、2,402 项全部通过；没有新增 API/Web 单元测试。
- 删除八个 workspace 的生成 dist 后，`pnpm exec turbo run build --force`：8 项构建通过。
- `pnpm --filter @daoyou/api deploy --prod /tmp/daoyou-exports-api-deploy-20261004` 通过。该独立目录内 304 个导出（含 JSON）全部可由 Node 解析并加载；三个已移除路径探针得到 `ERR_PACKAGE_PATH_NOT_EXPORTED`；不含 Web 包或 API 源码。
- 最终 API 编译产物启动成功。浏览器核对洞府、宗门玉牒、背包 34/40 格、育兽室和灵兽属性、炼器室及当前图纸空列表。既有 25 回合竞技回放可逐行动推进、跳转并到达 99/99 终局；最终页面 error 日志为空。本批未发起新战斗或资源操作。
- 日志：`/tmp/daoyou-exports-{install,lint,typecheck,tests-final,build-final,deploy}.log`；回放截图：`/tmp/daoyou-exports-replay-verified.png`。临时迁移工具未加入仓库。
- 审阅可分为：① domain/content 公共入口及对应消费者；② rules/contracts 公共入口及对应消费者；③ 边界检查、项目指南与验收记录。同一消费者可能同时使用多包，前两组需按 import hunk 联动审阅；旧入口已删除，不能假定任意拆开的中间提交都可独立构建。
- 本批没有重跑新登录/自然续期、双账号完整结算、Docker 镜像、Turbo watch/缓存探针或生产部署/回滚。前文记录属于先前批次，不能替代本批未执行项。没有执行 commit/push 或数据库迁移。

收尾：`git diff --check` 通过。浏览器 HTTP 缓存设置已恢复，临时验收页及本批 API/preview 已关闭；API 日志确认请求排空、消息停止和数据库/Redis 连接关闭，最终为 shutdown complete。基础数据库、Redis、NATS 服务保持原状。
