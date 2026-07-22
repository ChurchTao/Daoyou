# battle-v5 与宗门机制解耦实施报告

> - 对应方案：[battle-v5-sect-decoupling-refactor-plan.md](./battle-v5-sect-decoupling-refactor-plan.md)
> - 实施与验收日期：2026-07-22
> - 结论：阶段 0～7 全部完成，最终测试、lint、build、格式和搜索门禁全部通过
> - 数据边界：无数据库迁移、无持久化模型变化、无稳定宗门/道途/节点/能力 ID 变化

## 1. 最终结论

本轮删除了五组由单宗门需求向 battle-v5 核心扩散的抽象，并用现有通用原语在宗门内容编译层重组：

1. `postDamageEffects` 被既有有序 `completionEffects` 替代。
2. 伤害 `display/tone` 透传被删除，计算层和 React 展示层不再理解“魂伤紫色”等宗门美术语义。
3. `buffLayerScalar` 被幽都四层/五层两个互斥固定 effect plan 替代。
4. `element_history` 专用 Effect 和 runtime state 被天衍隐藏 marker Buff 与通用 runtime counter 替代。
5. `buff_periodic_settlement/manualSettlementEffects` 被分层灼烧与固定反应追伤替代。

重构没有改写 BattleEngineV5 的 1v1、行动、事件、伤害、Buff 或胜负架构。battle-v5 非 Adapter 生产核心不含四个生产宗门 ID、名称或内容依赖，`sect/core` 也不依赖具体宗门内容。

## 2. 分阶段实施结果

### 2.1 阶段 0：冻结基线

- battle-v5 基线：32 个测试文件、280 项测试通过。
- 幽都基线：5 个测试文件、90 项测试通过。
- 天衍基线：9 个测试文件、131 项测试通过。
- 四宗门基线：35 个测试文件、478 项测试通过。

基线用于确认删除抽象前后的行为边界；本阶段没有数据或架构改动。

### 2.2 阶段 1：合并冗余执行阶段

- 从 `AbilityConfig`、分层主动技能、Factory、能力分析、宗门编写/成长/展示和幽都编译器删除 `postDamageEffects`。
- 幽都效果顺序统一为：计划 effects → 基础 completion → 层 completion → 资源消费。
- 未增加同义生命周期字段。
- 聚焦验证：7 个测试文件、128 项测试通过；删除项搜索为 0。

### 2.3 阶段 2：伤害展示中性化

- 删除 `DamageDisplayMetadata`、`DamageParams.display`、伤害事件与日志数据的 `display`、`PresentedLogPart.tone`。
- 删除 React 对 `violet` 的特殊样式分支。
- 幽都混合伤害仍发布法术/真实两个标准伤害请求，但玩家日志使用中性分段展示。
- 聚焦验证：10 个测试文件、147 项测试通过；双端 build 通过。

### 2.4 阶段 3：固定计划替代动态 Buff 读层

- 从伤害配置、DamageEffect、能力事实和测试删除 `buffLayerScalar`。
- 幽都编译器生成 `finish-four` 与 `finish-five` 两个固定层和互斥计划；五层优先级 20，四层优先级 10 且要求 `< 5`。
- 每个分支只发布一个真实伤害请求，之后再执行清层/保留两层与“不归”状态。
- 聚焦验证：7 个测试文件、110 项测试通过；删除项搜索为 0。

### 2.5 阶段 4：天衍元素历史下沉

- 删除 `ElementHistoryParams`、`element_history`、`ElementHistoryEffect`、`BattleRuntimeState.elementHistories` 及其读写 API。
- 每个不同反应元素由天衍内容层创建隐藏、受保护、`countsAsStatus=false` 的 marker Buff。
- 通用 runtime counter 负责计数；重复元素不增加，第三种不同元素触发后清理全部 marker 并重置 counter。
- `creation-v2` 的稳定词缀“万象归一”改为通用的每三次激活触发，不重新引入动态元素作者模型。
- 聚焦验证：天衍/核心 12 个测试文件、170 项测试；creation-v2 18 个测试文件、133 项测试；build 通过。

### 2.6 阶段 5：移除周期 Buff 反射式结算

- 删除 `BuffPeriodicSettlementParams`、`buff_periodic_settlement`、`BuffPeriodicSettlementEffect`、`BuffConfig.manualSettlementEffects` 及成长/词缀文本投影支持。
- 灼烧改为 2 层、上限 2 层；每次目标 `ActionPre` 结算一次 `0.16 × MAGIC_ATK` DOT 后减少一层，按 2→1→0 结束；重施恢复并封顶到 2 层且刷新持续时间。
- 燎原发布固定 `0.16 × MAGIC_ATK` 的 `FOLLOW_UP`，不消耗灼烧。
- 蒸发保留主伤害 80% 追伤；另按 1/2 层灼烧发布固定 `0.16/0.32 × MAGIC_ATK` 追伤，随后只清除灼烧。熔岩独立存在。
- 聚焦验证：11 个测试文件、167 项测试通过；build 通过。

### 2.7 阶段 6：架构守卫

`architectureGuard.test.ts` 现覆盖：

- battle-v5 非 Adapter 生产核心不得包含四宗门 ID、名称或中文内容语义；
- battle-v5 核心不得导入宗门内容层或 React；
- `sect/core` 不得依赖生产宗门内容或稳定宗门 ID；
- 通用战斗 React UI 不得包含生产宗门 ID/名称；
- 五组已删除扩展不得回到生产源码；
- 守卫正则通过代表性非法输入自检。

正常验证为 1 个测试文件、11 项测试通过。另执行了一次未提交的故障注入：临时向 battle-v5 核心加入 `sect.youdu`，测试按预期失败，随后删除探针文件并再次验证通过。

### 2.8 阶段 7：文档与准入规则

已同步：

- `docs/sect-authoring-guide.md`
- `docs/youdu-battle-v5-implementation-plan.md`
- `docs/youdu-sect-design.md`
- `docs/tianyan-sacred-land-design.md`
- `src/shared/engine/sect/README.md`

作者指南新增八问准入模板，并明确优先使用固定 plan、marker、counter 和内容组合。只有第二个独立生产消费者或明确全局不变量才能支持新增 battle-v5 原语；单宗门生命周期、动态 Buff 反射和展示字段不得进入核心。

## 3. 允许的行为差异

| 范围 | 最终差异 | 接受理由 |
| --- | --- | --- |
| 幽都日志 | 删除魂伤紫色、术伤/魂伤分量前缀，改用标准中性日志 | 展示颜色不应穿透伤害核心、事件和 React 通用组件 |
| 幽都终结 | 四/五层总系数作为一个固定 coefficient 统一取整；一项既有用例出现 1 点气血差 | 固定计划的数学语义稳定，避免 DamageEffect 读取任意 Buff 层数 |
| 天衍元素记录 | `creation-v2` 的“万象归一”由三种不同元素近似为每三次激活 | 通用造物内容无法在不恢复元素专用核心 API 的情况下动态生成每元素 marker 配置 |
| 天衍燎原/蒸发 | 不再读取并重放灼烧 Buff；改为固定 `0.16` 与按层 `0.16/0.32` 追伤 | 保留额外一跳、按剩余灼烧强弱兑现和清除灼烧的战术用途，同时消除反射式 Buff 耦合 |

没有发现超出以上批准范围的非预期差异。

## 4. 最终验证记录

| 命令 | 结果 | 明细 |
| --- | --- | --- |
| `bunx vitest run src/shared/engine/sect/testing/architecture/architectureGuard.test.ts` | 通过 | 1 文件，11 测试 |
| `bunx vitest run src/shared/engine/battle-v5/tests` | 通过 | 32 文件，277 测试 |
| `bunx vitest run src/shared/engine/sect` | 通过 | 35 文件，484 测试 |
| `bunx vitest run src/shared/engine/creation-v2` | 通过 | 18 文件，133 测试 |
| `bun run lint` | 通过 | ESLint 无错误 |
| `bun run test` | 通过 | 245 文件，1795 测试 |
| `bun run build` | 通过 | client 与 server TypeScript/Vite 构建均通过 |
| `bunx prettier --check <七个同步文档>` | 通过 | 全部符合 Prettier |
| `git diff --check` | 通过 | 无空白错误 |

### 4.1 删除项搜索门禁

架构守卫测试必须保留历史符号作为禁止项正则和自检样本，因此下列生产源码搜索排除该测试文件：

```bash
rg -n --glob '!src/shared/engine/sect/testing/architecture/architectureGuard.test.ts' "postDamageEffects|DamageDisplayMetadata|buffLayerScalar" src
rg -n --glob '!src/shared/engine/sect/testing/architecture/architectureGuard.test.ts' "ElementHistory|element_history|elementHistories" src
rg -n --glob '!src/shared/engine/sect/testing/architecture/architectureGuard.test.ts' "BuffPeriodicSettlement|buff_periodic_settlement|manualSettlementEffects" src
rg -n "tone.*violet|display: \{ label: '(魂伤|术伤)'" src
```

四项结果均为 0。代码审计也未发现同用途改名替代：没有新的宗门专用生命周期阶段、动态 Buff 配置执行器、元素专用 runtime state、伤害展示字段或单宗门 Effect 类型。

## 5. 完成审计

1. 五组删除项已从生产源码消失：是。
2. 是否新增同义替代抽象：否。
3. battle-v5 非 Adapter 生产核心是否含具体宗门 ID、状态 ID、节点 ID 或中文宗门术语：否，由架构测试约束。
4. 是否新增仅单宗门使用的 EffectConfig、runtime state 或事件字段：否。
5. 幽都和天衍差异是否仅限批准范围：是，见第 3 节。
6. 红尘剑宗、无相宗、creation-v2 和双端 build 是否完成回归：是。
7. 是否有跳过命令：否。
8. 是否存在数据迁移、持久化兼容或稳定 ID 风险：否。

本轮重构达到方案完成定义。后续宗门若需要类似复杂机制，应先依据作者指南的八问模板证明其通用性；无法证明时，继续优先采用内容层固定计划、隐藏 marker、通用 counter 或可接受的近似语义。
