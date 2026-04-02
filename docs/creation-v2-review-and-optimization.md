# 造物系统 v2 — Full Review 与优化方案

> 文档用途：对 `engine/creation-v2` 当前代码进行全面 review，记录设计合理性分析、  
> 已发现问题清单，以及对应的优化建议。  
> 后续演进工作以本文档为起点，逐一追踪解决。

---

## 一、综合评价

造物系统 v2 的整体架构思路是正确的：

- EDA 事件驱动的工作流推进逻辑清晰，阶段守卫、优先级订阅设计合理；
- Rules Layer 已建立，基础设施（Rule / RuleSet / RuleContext / RuleDiagnostics）完整；
- 四个 RuleSet（Material / Recipe / AffixPool / AffixSelection / Composition）均已落地；
- 配置已基本收口到 `config/`，config 文件分工清晰；
- 产物模型 + Battle 投影 + Adapter 的单向依赖链基本成形。

系统已可以端到端运行并通过 CI 测试（29 suites / 145 tests）。  
P0 级全部架构边界问题，以及 P1-2（heal skill 标签错误）已修复完毕。

问题按严重程度分为三级：

| 级别 | 含义 |
|------|------|
| **P0** | 破坏架构边界、污染数据流、有运行时风险，必须优先修复 |
| **P1** | 实现不完整、硬编码、逻辑职责错位，需在下一演进阶段解决 |
| **P2** | 代码冗余、健壮性不足、测试覆盖缺口，可在后续迭代中跟进 |

---

## 二、P0 问题：架构边界与运行时风险

### ~~P0-1：`affixes/definitions/` 直接引用 `battle-v5` 的 `GameplayTags`~~ ✅ 已修复

**修复说明：**  
`artifactAffixes.ts` 和 `gongfaAffixes.ts` 中的 `GameplayTags` 直接引用已全部移除。  
`tags: [GameplayTags.ABILITY.TYPE_MAGIC]` → `tags: [CreationTags.BATTLE.ABILITY_TYPE_MAGIC]`  
`tags: [GameplayTags.BUFF.TYPE_CONTROL]` → `tags: [CreationTags.BATTLE.BUFF_TYPE_CONTROL]`  
所有词缀定义现已通过 `CreationTags.BATTLE.*` 访问战斗层标签常量。

---

### ~~P0-2：`CreationTags.BATTLE_EVENT` 和 `LISTENER_SCOPE` 缺少部分常量，词缀中存在裸字符串~~ ✅ 已修复

**修复说明：**  
`core/GameplayTags.ts` 中的 `BATTLE_EVENT` 和 `LISTENER_SCOPE` 常量块已补全：
```typescript
BATTLE_EVENT: {
  ACTION_PRE: 'ActionPreEvent',
  DAMAGE_TAKEN: 'DamageTakenEvent',
  DAMAGE_REQUEST: 'DamageRequestEvent',
  DAMAGE: 'DamageEvent',
  ROUND_PRE: 'RoundPreEvent',
  SKILL_CAST: 'SkillCastEvent',
  BUFF_ADD: 'BuffAddEvent',
},
LISTENER_SCOPE: {
  OWNER_AS_TARGET: 'owner_as_target',
  OWNER_AS_ACTOR: 'owner_as_actor',
  OWNER_AS_CASTER: 'owner_as_caster',
  GLOBAL: 'global',
},
```

**残留技术债：**  
这些常量值仍为硬编码字符串，仅在 creation-v2 内部提供保护；若 battle-v5 更改事件名，TypeScript 编译不会报警。待 battle-v5 将这些字符串通过类型约束导出后，可进一步改为 `satisfies` 约束的 const 形式。

---

### ~~P0-3：词缀定义中硬编码 battle-v5 事件名字符串~~ ✅ 已修复

**修复说明：**  
`artifactAffixes.ts`、`gongfaAffixes.ts`、`skillAffixes.ts` 中所有 `listenerSpec.eventType` / `scope` 裸字符串已替换为 `CreationTags.BATTLE_EVENT.*` / `CreationTags.LISTENER_SCOPE.*` 常量。测试文件中同步替换。

---

### ~~P0-4：`ArtifactProductModel` / `GongFaProductModel` 字段冗余~~ ✅ 已修复

**修复说明：**  
`models/types.ts` 中 `ArtifactProductModel` 的顶层 `slot/equipPolicy/persistencePolicy/progressionPolicy` 四个字段，以及 `GongFaProductModel` 的顶层 `equipPolicy/persistencePolicy/progressionPolicy` 三个字段已删除。所有 policy 字段统一通过 `artifactConfig` / `gongfaConfig` 嵌套访问，消除双写风险。

---

## 三、P1 问题：实现不完整与职责错位

### ~~P1-1：`DefaultIntentResolver.inferSlotBias()` — slot 推断逻辑不在规则层~~ ✅ 已部分修复

**修复说明（短期）：**  
移除了 `console.warn`，改为 `// TODO(P1-1): Move this heuristic to SlotBiasRule in the rules layer...` 注释。引擎层不再有运行时输出污染。

**残留 TODO：**  
规则层迁移（创建 `SlotBiasRule`，通过 `diagnostics.addTrace()` 记录推断原因）仍作为后续演进点。

---

### ~~P1-2：`OutcomeTagRules` 对 `skill` 产物的 `abilityTags` 硬编码 `ABILITY_TYPE_DAMAGE`~~ ✅ 已修复

**修复说明：**  
通过以下步骤修复了 heal/control skill 被错误标为 `Ability.Type.Damage` 的问题：

1. `config/CreationMappings.ts` 新增 `CORE_EFFECT_TYPE_TO_ABILITY_TAG` 映射：
   ```typescript
   export const CORE_EFFECT_TYPE_TO_ABILITY_TAG: Record<string, string> = {
     damage: CreationTags.BATTLE.ABILITY_TYPE_DAMAGE,
     heal: CreationTags.BATTLE.ABILITY_TYPE_HEAL,
     apply_buff: CreationTags.BATTLE.ABILITY_TYPE_CONTROL,
   };
   ```
2. `rules/contracts/CompositionFacts.ts` 新增 `coreEffectType?: string` 字段；
3. `composers/shared.ts` 的 `buildCompositionFacts()` 接受可选 `registry` 参数，并从 core 词缀定义中推断 `coreEffectType`；
4. 三个 Composer（SkillBlueprintComposer / ArtifactBlueprintComposer / GongFaBlueprintComposer）均存储并传入 registry；
5. `OutcomeTagRules.ts` skill case 使用 `CORE_EFFECT_TYPE_TO_ABILITY_TAG[facts.coreEffectType ?? 'damage']` 动态选择标签；
6. `ProjectionRules.ts` 中 `abilityTags` 同样替换为 `CORE_EFFECT_TYPE_TO_ABILITY_TAG[facts.coreEffectType ?? coreType]`。

---

### ~~P1-3：`ProjectionRules` 中 `coreType` 推断无 trace，`cooldown` 应归入 EnergyConversionRules~~ ✅ 已部分修复

**修复说明（短期）：**  
`buildSkillPolicy` 改为接收 `diagnostics` 参数。现在：
- 无 core 词缀时 fallback 到 `'damage'` 会输出 trace
- `cooldown` 换算结果也会输出 trace（`cooldown=N (coreType=X)`）

**残留 TODO：**  
中期演进方向（将 `cooldown` 换算和 `coreType` 推断统一转入 `EnergyConversionRules`，去除 `ProjectionRules` 对 `AffixRegistry` 的依赖）仍保留为后续工作。

---

### P1-4：`NamingRules` 对功法产物命名缺乏 fallback 配置

**文件：** [engine/creation-v2/rules/composition/NamingRules.ts](../engine/creation-v2/rules/composition/NamingRules.ts)

**现象：**
```typescript
case 'gongfa': {
  return `${materialNames[0] ?? ''}${CREATION_GONGFA_NAMING.nameSuffix}`;
}
```

无材料时退化为 `'心法'`（只有后缀），不清晰。

**优化方案：**  
在 `config/CreationNamingPolicy.ts` 补充 `defaultName: '玄灵心法'`，`NamingRules` 在无材料名时使用该默认值，并加 trace 记录。

---

### ~~P1-5：`MaterialSemanticEnricher` 中 `process.env` 引用污染引擎层~~ ✅ 已修复

**修复说明：**  
`DeepSeekMaterialSemanticEnricher` 构造函数中 `this.enabled` 的 fallback 从 `process.env.ENABLE_CREATION_LLM_SEMANTIC_ENRICHMENT === 'true'` 改为 `false`。  
服务层在创建 enricher 时需显式传入 `{ enabled: boolean }`（例如读取 env 后注入），引擎层测试可直接用 `{ enabled: false }` 构建实例，无需设置环境变量。

---

### P1-6：`reconcileRolledAffixes()` 与 `applySelectionAudit()` 双重更新职责边界模糊

**文件：**  
- [engine/creation-v2/budgeting/DefaultEnergyBudgeter.ts](../engine/creation-v2/budgeting/DefaultEnergyBudgeter.ts)  
- [engine/creation-v2/CreationOrchestrator.ts](../engine/creation-v2/CreationOrchestrator.ts)

**现象：**  
`rollAffixesWithDefaults()` 先调用 `applySelectionAudit()` 更新预算，随后 `rollAffixes()` 又调用 `reconcileRolledAffixes()` 再次更新——两次更新逻辑不一致（前者含 `rejections/exhaustionReason`，后者重新按 affixes 计算），手动调用 `rollAffixes(session, customAffixes)` 时 `rejections` 信息将丢失。

**优化方案：**  
明确两方法分工：`applySelectionAudit` 携带完整 audit 信息，`reconcileRolledAffixes` 用于极简对账。文档化约定，或合并为一个方法并明确覆盖规则。

---

### P1-7：`CreationOrchestrator` 的 `xxxWithDefaults()` 方法 public 泄露

**文件：** [engine/creation-v2/CreationOrchestrator.ts](../engine/creation-v2/CreationOrchestrator.ts)

**现象：**  
`analyzeMaterialsWithDefaults`、`resolveIntentWithDefaults`、`validateRecipeWithDefaults` 等 7 个工作流内部步骤均为 public，可被外部绕过 EventBus 直接调用。

**问题：**  
这些方法是供 `PhaseActionRegistry` 注册的幕后方法，被外部调用时阶段事件不会发布，容易被误用。

**优化方案：**  
- 将 `xxxWithDefaults` 方法改为 `private` 或 `protected`；
- 对外提供 `runStep(key: WorkflowActionKey, session)` 固定入口；
- 或保持 public 并通过 JSDoc 明确标注"仅供测试/禁止在工作流外直接调用"。

---

### ~~P1-8：`CreationBlueprint` 与 `CraftedOutcome` 中存在字段冗余~~ ✅ 已修复

**修复说明：**  
`CraftedOutcome` 中的 `productType`、`outcomeKind`、`productModel`、`abilityConfig` 四个冗余字段已全部删除，现在只保留：
```typescript
export interface CraftedOutcome {
  blueprint: CreationBlueprint;
  ability: Ability;
}
```
所有消费方（`OutcomeSnapshot.ts`、所有测试文件）已更新为通过 `outcome.blueprint.*` 路径访问。`snapshotCraftedOutcome` 从 `outcome.blueprint.productModel.productType` 等路径提取快照字段，`CraftedOutcomeSnapshot` 结构保持不变（持久化兼容）。

**残留点：** `CreationBlueprint` 中 `name/description/tags/affixes` 仍与 `productModel.*` 重复。短期方案（getter 改造）保留为后续演进点。

---

### P1-9：`AffixCandidate.maxQuality` 声明但未实现

**文件：**  
- [engine/creation-v2/types.ts](../engine/creation-v2/types.ts)（`maxQuality` 有声明）
- [engine/creation-v2/rules/affix/AffixEligibilityRules.ts](../engine/creation-v2/rules/affix/AffixEligibilityRules.ts)（仅检查 `minQuality`）
- [engine/creation-v2/affixes/AffixPoolBuilder.ts](../engine/creation-v2/affixes/AffixPoolBuilder.ts)（`toCandidate()` 未传入 `maxQuality`）

**优化方案：**  
要么在 `AffixEligibilityRules` 中实现 `maxQuality` 过滤，要么删除该声明并清理类型定义。

---

### P1-10：词缀定义中 `MULTIPLY` modType 语义文档和测试缺失

**文件：**  
- [engine/creation-v2/affixes/definitions/artifactAffixes.ts](../engine/creation-v2/affixes/definitions/artifactAffixes.ts)：`artifact-signature-ice-armor`
- [engine/creation-v2/affixes/definitions/gongfaAffixes.ts](../engine/creation-v2/affixes/definitions/gongfaAffixes.ts)：`gongfa-signature-comprehension`

**问题：**  
`AffixEffectTranslator` 对 `MULTIPLY` modType（`value: 0.15` 意味着 +15%）无文档说明；`attribute_stat_buff` 分支从未有测试覆盖过 `MULTIPLY` 的缩放行为是否正确。

**优化方案：**  
在 `affixes/types.ts` 的 `attribute_stat_buff` 模板注释中明确 `MULTIPLY` 语义；为 `AffixEffectTranslator` 补充 `MULTIPLY` modType 的测试用例。

---

### ~~NEW-1：测试文件中存在硬编码 battle-v5 事件字符串（未随 P0-3 同步修复）~~ ✅ 已修复

**修复说明：**  
`tests/CreationOrchestrator.test.ts` 已补充 `CreationTags` import，`eventType: 'DamageTakenEvent'` 和 `scope: 'owner_as_target'` 两处裸字符串替换为 `CreationTags.BATTLE_EVENT.DAMAGE_TAKEN` 和 `CreationTags.LISTENER_SCOPE.OWNER_AS_TARGET`，与词缀定义保持一致。

---

## 四、P2 问题：冗余代码、健壮性不足与测试缺口

### P2-1：`AffixPoolBuilder.toCandidate()` 未传入 `maxQuality`

**文件：** [engine/creation-v2/affixes/AffixPoolBuilder.ts](../engine/creation-v2/affixes/AffixPoolBuilder.ts)

即使后续实现 `maxQuality` 过滤，构造 `AffixCandidate` 时也需要同步补充 `maxQuality: def.maxQuality`，现在是静默遗漏。

---

### P2-2：`CreationOrchestrator.createSession()` 不防止重复 sessionId

**现象：**  
若调用方传入重复 `sessionId`，旧 session 被静默覆盖，关联的 workflow completion promise 可能孤立。

**优化方案：**  
增加重复 sessionId 检查，重复时抛错或提供可选的 `overwrite` 标志。

---

### P2-3：`CreationEventBus.reset()` 清空订阅者，handler 需重新注册

**文件：** [engine/creation-v2/core/EventBus.ts](../engine/creation-v2/core/EventBus.ts)

`reset()` 清空 `subscribers` Map，但 `CreationPhaseHandlerRegistry` 只 register 一次。复用同一 eventBus 实例调用 `reset()` 后，workflow 订阅被清掉，静默失效无报错。

**优化方案：**  
文档化 `reset()` 使用限制（重置后需重新 register），或将 `reset()` 拆为清历史和清订阅两个独立方法。

---

### P2-4：`WorkflowDecisionBoundary.test.ts` 的断言可能依赖 session 内部字段

如果断言目标是 `session.state.affixPoolDecision` 等内部字段，当 session 状态结构调整时会脆断。应优化为通过 `buildDecision()` 等方法的返回值断言。

---

### P2-5：`CreationSessionState` 字段混杂，缺乏分层

输入数据、运行时数据、决策审计数据（`affixPoolDecision/affixSelectionDecision`）和产出数据共存于一个扁平结构，随演进会越来越臃肿。

**优化方案（长期）：**  
将审计数据独立为 `CreationSessionDiagnostics` 结构，与主状态解耦。

---

### P2-6：测试中 `MaterialFingerprint` 手动构造大量重复样板

多个测试文件中独立拼装 `materialFingerprints` 数组，容易字段不完整且难以维护。

**优化方案：**  
在 `tests/fixtures/` 或 `tests/helpers/` 下提供 `makeFireMaterialFingerprint()` 等 builder 函数，跨测试文件复用。

---

### P2-7：`publishMaterialSemanticEnrichment` 参数为 inline 局部类型

**文件：** [engine/creation-v2/CreationOrchestrator.ts](../engine/creation-v2/CreationOrchestrator.ts)

参数类型是 `MaterialSemanticEnrichmentReport` 的不完整子集，应直接使用该类型而非重复定义 inline 结构。

---

### P2-8：`contracts/battle-testkit.ts` 缺少 `BuffAddEvent` 导出

词缀定义中有 `eventType: CreationTags.BATTLE_EVENT.BUFF_ADD`（即 `'BuffAddEvent'`），如果测试需要监听该事件，须从 battle-v5 内部直接引入。应在 `battle-testkit.ts` 补充 `BuffAddEvent` 导出，保持测试代码一致通过 contracts 层访问。

---

### P2-9：词缀池规模偏小，随机策略缺乏统计性测试

当前 `gongfa` 的 suffix 只有 1 条，难以观察 `pool_exhausted` 以外的停机原因。

**优化方案：**  
补充基于 mock registry（较大词缀池）的统计性测试，增强 AffixSelector 随机策略的可观测性。此属游戏内容工作，非架构缺陷。

---

## 五、已完成收口（可作为演进基准）

以下模块已经按照目标架构完成，无需改动：

| 模块 | 状态 |
|------|------|
| `core/EventBus.ts` | 优先级订阅、循环防护、历史记录 — 完整 |
| `core/GameplayTags.ts` (`CreationTagContainer`) | 层级标签系统 — 完整 |
| `rules/core/` | Rule / RuleSet / RuleContext / RuleDiagnostics — 完整 |
| `rules/contracts/` | 全部 Facts / Decision 类型 — 完整 |
| `rules/material/MaterialConflictRules.ts` | 三类冲突检测 — 完整 |
| `rules/recipe/` | ProductSupportRules / AffixUnlockRules / ReservedEnergyRules — 完整 |
| `rules/affix/` | Eligibility / Weight / ExclusiveGroup / Budget / Fallback 规则 — 完整 |
| `rules/composition/OutcomeTagRules.ts` | 动态 abilityType 标签（heal/control/damage 分类）— 完整 |
| `rules/composition/ProjectionRules.ts` | 使用 `CORE_EFFECT_TYPE_TO_ABILITY_TAG` 动态映射 — 完整（P1-3 待改进） |
| `rules/composition/` 其余规则 | NamingRules / EnergyConversionRules / FallbackOutcomeRules — 完整 |
| `affixes/AffixEffectTranslator.ts` | 品质缩放 + 全效果类型覆盖 — 完整 |
| `affixes/AffixPicker.ts` | 加权随机 — 完整 |
| `affixes/definitions/*.ts` | 所有 `eventType/scope` 改为 `CreationTags.*` 常量 — 完整 |
| `config/CreationMappings.ts` | `ELEMENT_TO_ABILITY_TAG` + `CORE_EFFECT_TYPE_TO_ABILITY_TAG` — 完整 |
| `models/types.ts` | `ArtifactProductModel`/`GongFaProductModel` 字段冗余已清除 — 完整 |
| `persistence/OutcomeSnapshot.ts` | 快照序列化 + 恢复 — 完整 |
| `handlers/WorkflowVariantPolicy.ts` | Variant 策略分离 — 完整 |
| `handlers/PhaseActionRegistry.ts` | 可替换 action 映射 — 完整 |
| `analysis/SemanticTagAllowlist.ts` | 别名归一化白名单 — 完整 |
| `contracts/battle.ts` + `battle-testkit.ts` | 单向边界 — 基本完整（P2-8 待补充） |

---

## 六、问题优先级汇总

| ID | 描述摘要 | 状态 | 优先级 |
|----|---------|------|--------|
| P0-1 | 词缀定义直接引用 `battle-v5.GameplayTags` | ✅ 已修复 | — |
| P0-2 | `BATTLE_EVENT/LISTENER_SCOPE` 缺少常量/裸字符串 | ✅ 已修复 | — |
| P0-3 | 词缀 `listenerSpec.eventType` 全为裸字符串 | ✅ 已修复 | — |
| P0-4 | `ArtifactProductModel`/`GongFaProductModel` 字段冗余 | ✅ 已修复 | — |
| P1-2 | 全类 skill 被打上 `Ability.Type.Damage`（heal skill 语义错误） | ✅ 已修复 | — |
| NEW-1 | 测试文件中存在硬编码 battle-v5 事件字符串 | ✅ 已修复 | — |
| P1-1 | `inferSlotBias()` 中的 `console.warn` 污染引擎层 | ✅ 已修复（短期） | — |
| P1-3 | `ProjectionRules` coreType fallback 无 trace，cooldown 职责分裂 | ✅ 已修复（短期 trace） | — |
| P1-5 | `process.env` 出现在引擎层 | ✅ 已修复 | — |
| P1-8 | `CraftedOutcome` 冗余字段（productType/outcomeKind/productModel/abilityConfig） | ✅ 已修复 | — |
| **P1-1 规则层迁移** | inferSlotBias 迁移为 SlotBiasRule（TODO 保留） | ❌ 未修复 | P1 |
| **P1-3 中期** | cooldown/coreType 迁移到 EnergyConversionRules | ❌ 未修复 | P1 |
| **P1-4** | 功法命名无 fallback 配置项 | ✅ 已修复 | — |
| **P1-6** | `reconcileRolledAffixes` vs `applySelectionAudit` 职责边界模糊 | ✅ 已修复 | — |
| **P1-7** | `xxxWithDefaults` 方法 public 泄露 | ✅ 已修复（JSDoc @internal） | — |
| **P1-8 残留** | `CreationBlueprint.name/description/tags/affixes` getter 改造 | ❌ 未修复（TODO 保留） | P2 |
| **P1-9** | `AffixCandidate.maxQuality` 声明但未实现 | ✅ 已修复（AffixEligibilityRules + 测试） | — |
| **P1-10** | `MULTIPLY` modType 语义文档和测试缺失 | ✅ 已修复（JSDoc + 测试） | — |
| P2-1 | `toCandidate()` 未传入 `maxQuality` | ❌ 未修复 | P2 |
| P2-2 | `createSession()` 不防重复 sessionId | ❌ 未修复 | P2 |
| P2-3 | `EventBus.reset()` 清空订阅者无重注册保护 | ❌ 未修复 | P2 |
| P2-4 | 测试断言依赖 session 内部字段（脆断风险） | ❌ 未修复 | P2 |
| P2-5 | `CreationSessionState` 字段混杂缺分层 | ❌ 未修复 | P2 |
| P2-6 | 测试 `MaterialFingerprint` 构造大量重复样板 | ✅ 已修复 | P2 |
| P2-7 | `publishMaterialSemanticEnrichment` 参数为 inline 局部类型 | ✅ 已修复 | P2 |
| P2-8 | `battle-testkit.ts` 缺少 `BuffAddEvent` 导出 | ⏳ 延期（battle-v5 依赖） | P2 |
| P2-9 | 词缀池过小，随机策略缺少统计性测试 | ✅ 已修复 | P2 |

---

## 七、推荐演进顺序

### 阶段 A：已完成 ✅

- P0-1/P0-2/P0-3：battle-v5 字符串边界收口
- P0-4：ProductModel 字段冗余清除
- P1-2：heal/control skill 标签修复

### 阶段 B：规则层完善（当前阶段）

**高优先级（推荐先做）：**
1. **NEW-1**：测试文件中遗漏的 battle-v5 事件字符串替换（30 分钟）
2. **P1-5**：移除 `process.env` 出引擎层（1 小时）
3. **P1-1**：把 `inferSlotBias()` 迁移为 `SlotBiasRule`，移除 `console.warn`（2 小时）
4. **P1-3**：短期加 trace；中期将 `cooldown` 换算转入 `EnergyConversionRules`（1~3 小时）

**低优先级（可后续跟进）：**
5. **P1-8**：`CreationBlueprint` 字段冗余（3 小时）
6. **P1-7**：`xxxWithDefaults` 可见性（2 小时）
7. **P1-9**：实现或删除 `maxQuality`（30 分钟）
8. **P1-10**：补充 `MULTIPLY` 文档和测试（1.5 小时）
9. **P1-4**：补充命名 fallback 配置（30 分钟）
10. **P1-6**：明确 budgeting 职责约定（1 小时）

### 阶段 C：架构健壮性（后续迭代）

1. **P2-8**：`battle-testkit.ts` 补充 `BuffAddEvent` 导出
2. **P2-2**：`createSession()` 防重复 sessionId
3. **P2-3**：`EventBus.reset()` 文档化或拆分
4. **P2-5**：`CreationSessionState` 分层（长期重构）
5. **P2-6**：补充 `tests/fixtures/` builder helpers
6. **P2-4/P2-7**：测试断言和类型对齐

---

*最后更新：2026-04-05（对照蓝图重新审查：P0 全部完成，P1-2 完成，记录所有残留问题）*


---

## 一、综合评价

造物系统 v2 的整体架构思路是正确的：

- EDA 事件驱动的工作流推进逻辑清晰，阶段守卫、优先级订阅设计合理；
- Rules Layer 已建立，基础设施（Rule / RuleSet / RuleContext / RuleDiagnostics）完整；
- 四个 RuleSet（Material / Recipe / AffixPool / AffixSelection / Composition）均已落地；
- 配置已基本收口到 `config/`，config 文件分工清晰；
- 产物模型 + Battle 投影 + Adapter 的单向依赖链基本成形。

系统已可以端到端运行并通过 CI 测试。  
但目前仍处于**架构初稿阶段**，存在若干未收口的边界问题、实现不完整的模块，以及少量硬编码和架构污染点。

问题按严重程度分为三级：

| 级别 | 含义 |
|------|------|
| **P0** | 破坏架构边界、污染数据流、有运行时风险，必须优先修复 |
| **P1** | 实现不完整、硬编码、逻辑职责错位，需在下一演进阶段解决 |
| **P2** | 代码冗余、健壮性不足、测试覆盖缺口，可在后续迭代中跟进 |

---

## 二、P0 问题：架构边界与运行时风险

### P0-1：`affixes/definitions/` 直接引用 `battle-v5` 的 `GameplayTags`

**文件：**
- [engine/creation-v2/affixes/definitions/artifactAffixes.ts](../engine/creation-v2/affixes/definitions/artifactAffixes.ts)（第 1 行）
- [engine/creation-v2/affixes/definitions/gongfaAffixes.ts](../engine/creation-v2/affixes/definitions/gongfaAffixes.ts)（第 1 行）

**现象：**
```typescript
// artifactAffixes.ts / gongfaAffixes.ts
import { GameplayTags } from '../../contracts/battle';
// 用法举例：
tags: [GameplayTags.ABILITY.TYPE_MAGIC],
tags: [GameplayTags.BUFF.TYPE_CONTROL],
```

**问题：**  
词缀定义是造物域的**数据声明**，理论上不应感知 battle-v5 运行时的 `GameplayTags` 命名空间。  
当前直接引用 `contracts/battle.ts` → battle-v5 `GameplayTags`，使词缀数据定义与战斗层内部标签字符串产生了**隐式耦合**——只要 battle-v5 的 `ABILITY.TYPE_MAGIC` 或 `BUFF.TYPE_CONTROL` 字符串值变动，词缀定义就会悄悄失效。

**优化方案：**  
将这两个 buff tag 字符串常量迁移到 `config/CreationMappings.ts` 或 `core/GameplayTags.ts`（作为 `CreationTags.BATTLE.*` 已有的扩展），或声明为 `contracts/battle.ts` 中的公开常量重导出。总之，在 `affixes/definitions/` 与 `battle-v5` 之间加一层映射，不在词缀数据中直接写 `GameplayTags.ABILITY.TYPE_MAGIC`。

---

### P0-2：`CreationTags.BATTLE_EVENT` 和 `LISTENER_SCOPE` 中存在魔法字符串，与 battle-v5 实现耦合

**文件：** [engine/creation-v2/core/GameplayTags.ts](../engine/creation-v2/core/GameplayTags.ts)

**现象：**
```typescript
BATTLE_EVENT: {
  DAMAGE_TAKEN: 'DamageTakenEvent',
  ACTION_PRE: 'ActionPreEvent',
},
LISTENER_SCOPE: {
  OWNER_AS_TARGET: 'owner_as_target',
  OWNER_AS_ACTOR: 'owner_as_actor',
},
```

**问题：**  
这些字符串直接镜像了 battle-v5 的事件名称和 `ListenerScope` 类型值。当 battle-v5 更改这些值时，creation-v2 的 `CreationTags.BATTLE_EVENT.*` 不会收到 TypeScript 编译报错，属于无感知的隐式耦合。

**优化方案：**  
将这些字符串常量改为从 `contracts/battle.ts` 中重导出的**类型约束常量**。例如，将 `OWNER_AS_TARGET` 改为用 `ListenerScope` 类型做约束：

```typescript
// contracts/battle.ts 新增
export const BATTLE_EVENT_TYPES = { DAMAGE_TAKEN: 'DamageTakenEvent', ... } as const satisfies Record<string, string>;
```

或者在 `contracts/battle.ts` 中重导出 battle-v5 的 `ListenerScope` 类型，用类型系统强制约束词缀的 `listenerSpec.scope` 字段。

---

### P0-3：词缀定义中硬编码 battle-v5 事件名字符串

**文件：**
- [engine/creation-v2/affixes/definitions/artifactAffixes.ts](../engine/creation-v2/affixes/definitions/artifactAffixes.ts)（多处 `eventType: 'ActionPreEvent'`, `'DamageTakenEvent'`, `'RoundPreEvent'`, `'DamageRequestEvent'` 等）
- [engine/creation-v2/affixes/definitions/gongfaAffixes.ts](../engine/creation-v2/affixes/definitions/gongfaAffixes.ts)
- [engine/creation-v2/affixes/definitions/skillAffixes.ts](../engine/creation-v2/affixes/definitions/skillAffixes.ts)
- [engine/creation-v2/rules/composition/FallbackOutcomeRules.ts](../engine/creation-v2/rules/composition/FallbackOutcomeRules.ts)

**现象：**
```typescript
listenerSpec: { eventType: 'ActionPreEvent', scope: 'owner_as_actor', ... }
listenerSpec: { eventType: 'DamageTakenEvent', ... }
```

**问题：**  
事件类型字符串（如 `'ActionPreEvent'`）和 `'DamageEvent'` 等均已被收录进 `CreationTags.BATTLE_EVENT.*`，但词缀定义和部分规则仍使用裸字符串，与 P0-2 的问题共同构成批量性耦合风险。

**优化方案：**  
统一使用 `CreationTags.BATTLE_EVENT.*` 常量（待 P0-2 完善后）。词缀定义中的 `eventType` 字段替换为对应常量，彻底消灭裸 battle-v5 事件名字符串。

---

### P0-4：`ArtifactProductModel` 在 `models/types.ts` 中存在字段冗余

**文件：** [engine/creation-v2/models/types.ts](../engine/creation-v2/models/types.ts)

**现象：**
```typescript
export interface ArtifactProductModel extends BaseProductModel<'artifact', 'artifact'> {
  slot?: EquipmentSlot;
  equipPolicy: 'single_slot';
  persistencePolicy: 'inventory_bound';
  progressionPolicy: 'reforgeable';
  artifactConfig: ArtifactDomainConfig;       // ← 含上述 3 个 policy
  battleProjection: ArtifactBattleProjection;
}
```

`ArtifactProductModel` 中 `slot/equipPolicy/persistencePolicy/progressionPolicy` 四个字段与 `artifactConfig` 中的同名字段完全重复。同样地，`GongFaProductModel` 的三个 policy 字段与 `gongfaConfig` 重复。

**问题：** 两个字段中可以出现不一致的数据。`ArtifactBlueprintComposer` 中目前是同时赋值的，但这是维护者需要记住的双写约定，存在数据一致性风险。

**优化方案：** 删除 `ArtifactProductModel` 顶层的 `slot/equipPolicy/persistencePolicy/progressionPolicy` 字段，统一通过 `artifactConfig` 访问。在 `AbilityProjection.ts` 等消费方改为 `model.artifactConfig.slot` 等访问路径。

---

## 三、P1 问题：实现不完整与职责错位

### P1-1：`DefaultIntentResolver.inferSlotBias()` — slot 推断逻辑不在规则层

**文件：** [engine/creation-v2/resolvers/DefaultIntentResolver.ts](../engine/creation-v2/resolvers/DefaultIntentResolver.ts)（第 54 行 TODO 注释）

**现象：**  
基于材料名称关键词推断 `artifact` 装备槽位的启发式规则写在 `DefaultIntentResolver` 中，随机降级到 `'weapon'`（带 `console.warn`）。  
代码自身有 `TODO(P1-4)` 注释标记需迁移到规则层。

**问题：**
1. 推断逻辑无法被规则层审计（无 RuleTrace）；
2. 找不到关键词时的降级行为（默认 `'weapon'`）是一个隐藏的业务决策，缺乏显式声明；
3. `console.warn` 不应出现在引擎层（无框架日志体系时会污染非浏览器环境）。

**优化方案：**  
在 `rules/composition/` 或 `rules/recipe/` 中新增 `SlotBiasRule`，统一处理槽位推断，通过 `diagnostics.addTrace()` 记录推断原因，移除 `console.warn`。

---

### P1-2：`OutcomeTagRules` 对 `skill` 产物的 `abilityTags` 硬编码

**文件：** [engine/creation-v2/rules/composition/OutcomeTagRules.ts](../engine/creation-v2/rules/composition/OutcomeTagRules.ts)

**现象：**
```typescript
case 'skill':
  decision.tags = [
    CreationTags.OUTCOME.ACTIVE_SKILL,
    CreationTags.BATTLE.ABILITY_TYPE_DAMAGE,  // ← 所有技能都带 Damage 标签
    ...(elementTag ? [elementTag] : []),
    ...intent.dominantTags,
  ];
```

**问题：**  
`OutcomeTagRules` 对所有技能统一加 `Ability.Type.Damage` 标签，但如果词缀核心是治疗类（`skill-core-heal`），产物标签中包含 `Damage` 是语义错误。`ProjectionRules` 中也有同样的问题：

```typescript
// ProjectionRules.ts
const abilityTags = [
  CreationTags.BATTLE.ABILITY_TYPE_DAMAGE,  // ← heal 技能也会被打上 Damage 标签
  ...(elementTag ? [elementTag] : []),
];
```

**优化方案：**  
根据 `coreType`（从 `CompositionFacts.affixes` 推断或 `EnergyConversionRules` 产出）动态决定 ability 标签（`Damage` vs `Heal` vs `Control`）。可新增 `CREATION_SKILL_ABILITY_TAGS` 映射配置到 `config/CreationMappings.ts`。

---

### P1-3：`ProjectionRules` 中 `coreType` 的 fallback 判断是业务决策但没有规则审计

**文件：** [engine/creation-v2/rules/composition/ProjectionRules.ts](../engine/creation-v2/rules/composition/ProjectionRules.ts)

**现象：**
```typescript
const coreAffix = affixes.find((r) => r.category === AFFIX_CATEGORIES.CORE);
const coreDef = coreAffix ? this.registry.queryById(coreAffix.id) : undefined;
const coreType = coreDef?.effectTemplate.type ?? 'damage';  // fallback: 'damage'
```

**问题：**  
1. 没有 core 词缀时默认 `coreType = 'damage'` 是一个业务决策，但没有任何 `diagnostics.addTrace()` 记录；
2. 依赖 `AffixRegistry` 在 `ProjectionRules`（规则层）中做运行时查询，使规则层持有 registry 引用，增加测试负担；
3. `cooldown` 的计算逻辑依赖 `coreType`，应通过 `EnergyConversionRules` 统一产出，而非在 `ProjectionRules` 中重复计算（目前 `EnergyConversionRules` 只产出 `mpCost / priority`，`cooldown` 的计算还在 `ProjectionRules` 中手动进行）。

**优化方案：**  
1. 将 `coreType` 的推断和 `cooldown` 换算一并转入 `EnergyConversionRules`，通过 `decision.energyConversion` 一并传递给 `ProjectionRules`；
2. 在 `EnergyConversionRules` 中加 trace 记录；
3. `ProjectionRules` 应仅消费已换算好的 policy 参数，不再独立推断 `coreType`。

---

### P1-4：`NamingRules` 对功法产物的命名逻辑依赖 `materialNames[0]`，可能产生空字符串

**文件：** [engine/creation-v2/rules/composition/NamingRules.ts](../engine/creation-v2/rules/composition/NamingRules.ts)

**现象：**
```typescript
case 'gongfa': {
  return `${materialNames[0] ?? ''}${CREATION_GONGFA_NAMING.nameSuffix}`;
}
```

**问题：**  
`materialNames[0]` 没有材料时退化为 `'心法'`（只有后缀），与无材料的场景预期不一致。  
更重要的是：名称生成是业务规则，理想状态是可以通过配置 fallback 名称（如 `CREATION_GONGFA_NAMING.defaultName`）控制行为，而当前缺少这个配置项。

**优化方案：**  
在 `CreationNamingPolicy.ts` 补充 `defaultName: '玄灵心法'`，`NamingRules` 在无材料名时使用该默认值。同时补充 trace 记录。

---

### P1-5：`MaterialSemanticEnricher` 中 `process.env` 引用不符合引擎层纯逻辑原则

**文件：** [engine/creation-v2/analysis/MaterialSemanticEnricher.ts](../engine/creation-v2/analysis/MaterialSemanticEnricher.ts)（第 69 行）

**现象：**
```typescript
this.enabled = options.enabled ?? process.env.ENABLE_CREATION_LLM_SEMANTIC_ENRICHMENT === 'true';
```

**问题：**  
引擎层直接读取 `process.env`，与"引擎层独立于框架"的原则冲突。单元测试中需要设置环境变量才能控制行为。

**优化方案：**  
`DeepSeekMaterialSemanticEnricher` 的 `enabled` 应当通过构造函数注入（已有 `options.enabled` 入口），`process.env` 的读取移到 `lib/services/` 层（服务创建 enricher 实例时传入配置值）。引擎层单元测试可直接用 `{ enabled: false }` 构建实例，无需环境变量。

---

### P1-6：`DefaultEnergyBudgeter.reconcileRolledAffixes()` 与 `applySelectionAudit()` 都在外部被调用，职责边界模糊

**文件：** [engine/creation-v2/budgeting/DefaultEnergyBudgeter.ts](../engine/creation-v2/budgeting/DefaultEnergyBudgeter.ts)  
[engine/creation-v2/CreationOrchestrator.ts](../engine/creation-v2/CreationOrchestrator.ts)

**现象：**
```typescript
// rollAffixesWithDefaults() 中
session.state.energyBudget = this.energyBudgeter.applySelectionAudit(...);
this.rollAffixes(session, selection.affixes, lastDecision);

// rollAffixes() 中
session.state.energyBudget = this.energyBudgeter.reconcileRolledAffixes(
  session.state.energyBudget,
  affixes,
);
```

**问题：**  
`rollAffixesWithDefaults()` 调用 `applySelectionAudit()` 更新预算，随后 `rollAffixes()` 又调用 `reconcileRolledAffixes()` 再次更新——两次更新逻辑不一致（前者含 `rejections`/`exhaustionReason`，后者重新按 affixes 计算），可能造成 `rejections` 数组被覆盖。实测 `ClosedLoopEnergyFlow.test.ts` 验证了 `total = reserved + spent + remaining`，但单独调用 `rollAffixes(session, customAffixes)` 绕过 `applySelectionAudit()` 时，`rejections` 将丢失。

**优化方案：**  
明确两个方法的分工（`applySelectionAudit` 用于携带完整 audit 信息，`reconcileRolledAffixes` 用于手动传入词缀时的极简对账）。文档化约定：手动调用 `rollAffixes()` 时不能期望 rejection 信息；或合并为一个方法并明确覆盖规则。

---

### P1-7：`CreationOrchestrator` 的 `xxxWithDefaults()` 方法泄露为 public

**文件：** [engine/creation-v2/CreationOrchestrator.ts](../engine/creation-v2/CreationOrchestrator.ts)

**现象：**  
`analyzeMaterialsWithDefaults`, `resolveIntentWithDefaults`, `validateRecipeWithDefaults`, `budgetEnergyWithDefaults`, `buildAffixPoolWithDefaults`, `rollAffixesWithDefaults`, `composeBlueprintWithDefaults` 均为 public 方法。

**问题：**  
`xxxWithDefaults()` 方法是 Orchestrator 内部工作流执行步骤，是供 `PhaseActionRegistry` 注册的幕后方法。对外 public 后，服务层可以直接绕过事件总线驱动流程，导致阶段事件不发布（例如 `BattleContractBoundary.test.ts` 中直接调用这些方法，phase 确实被推进但事件链路跳过了）。

这在测试场景中是可接受的（为了便于分步测试），但增加了被误用的风险。

**优化方案：**  
- 将 `xxxWithDefaults` 方法改为 `private` 或 `protected`，仅通过 `PhaseActionRegistry` 调用；
- 对外提供 `runStep(key: WorkflowActionKey, session)` 风格的固定入口；
- 或保持 public 但通过 JSDoc 明确标注"仅供测试、禁止在工作流外直接调用"。

---

### P1-8：`CreationBlueprint` 与 `CraftedOutcome` 中存在字段冗余

**文件：** [engine/creation-v2/types.ts](../engine/creation-v2/types.ts)

**现象：**
```typescript
export interface CreationBlueprint {
  outcomeKind: CreationOutcomeKind;
  productModel: CreationProductModel;
  abilityConfig: AbilityConfig;   // ← 可由 projectAbilityConfig(productModel) 派生
  name: string;                   // ← 与 productModel.name 相同
  description?: string;           // ← 与 productModel.description 相同
  tags: string[];                 // ← 与 productModel.tags 相同
  affixes: RolledAffix[];         // ← 与 productModel.affixes 相同
}
```

`CraftedOutcome` 也存在同样的冗余：同时包含 `blueprint`, `productModel`, `abilityConfig`, `ability`。

**问题：**  
多个字段需要保持同步，任何一处没有同步就会造成外部消费者读到不一致的数据。当前在 Composer 中通过构造时同步赋值解决，但这是一个需要维护者记住的约定。

**优化方案（渐进式）：**  
1. 短期：`CreationBlueprint.name/description/tags/affixes` 改为 computed getter（从 `productModel` 读取），或通过工厂函数构建保证一致；
2. 长期：`CraftedOutcome` 考虑仅保留 `productModel` 和 `ability`，移除与前者重复的字段。

---

### P1-9：`rules/affix/AffixEligibilityRules.ts` 中 `maxQuality` 字段未实现

**文件：**  
- [engine/creation-v2/types.ts](../engine/creation-v2/types.ts)（`AffixCandidate.maxQuality` 有声明）
- [engine/creation-v2/rules/affix/AffixEligibilityRules.ts](../engine/creation-v2/rules/affix/AffixEligibilityRules.ts)（仅检查 `minQuality`，未处理 `maxQuality`）
- [engine/creation-v2/affixes/AffixPoolBuilder.ts](../engine/creation-v2/affixes/AffixPoolBuilder.ts)（`toCandidate()` 中传入 `minQuality` 但未传入 `maxQuality`）

**现象：**
```typescript
// types.ts
export interface AffixCandidate {
  minQuality?: Quality;
  maxQuality?: Quality; // ← 定义了但没有任何地方使用或检查
}
```

**问题：**  
`maxQuality` 是死代码（功能已声明但实现层未使用），会误导使用者认为可以限制词缀的最高材料品质条件。

**优化方案：**  
要么在 `AffixEligibilityRules` 中实现 `maxQuality` 过滤，要么删除该字段并清理类型定义。

---

### P1-10：词缀定义中存在 battle-v5 内部字段的隐式使用 — `MULTIPLY` 类型

**文件：**
- [engine/creation-v2/affixes/definitions/artifactAffixes.ts](../engine/creation-v2/affixes/definitions/artifactAffixes.ts)：`artifact-signature-ice-armor` 中 `modType: ModifierType.MULTIPLY`
- [engine/creation-v2/affixes/definitions/gongfaAffixes.ts](../engine/creation-v2/affixes/definitions/gongfaAffixes.ts)：`gongfa-signature-comprehension` 中 `modType: ModifierType.MULTIPLY`

**问题：**  
`AffixEffectTranslator` 中 `attribute_stat_buff` 分支生成的 `BuffConfig.modifiers` 使用 `{ type: modType as ModifierType, value: resolvedValue }`，直接将 `creation-v2` 的 `modType` 字段透传给 battle-v5 的 `AttributeModifier.type`。  
`ModifierType.MULTIPLY` 存在于 battle-v5，meaning 是**百分比乘法**，`value = 0.15` 意味着提升 15%——这是数值设计者的预期，但：
1. `AffixEffectTranslator` 对 `MULTIPLY` 没有任何文档说明，数值含义不透明；
2. `attribute_stat_buff` 分支从未有测试覆盖过 `MULTIPLY` 类型的缩放行为是否正确。

**优化方案：**  
在 `affixes/types.ts` 的 `attribute_stat_buff` 模板注释中明确说明 `MULTIPLY` 类型的语义（倍数 modifier，value 范围约定）；为 `AffixEffectTranslator` 补充 `MULTIPLY` modType 的测试用例。

---

## 四、P2 问题：冗余代码、健壮性不足与测试缺口

### P2-1：`RolledAffix.maxQuality` 字段未传入 `toCandidate()`

**文件：** [engine/creation-v2/affixes/AffixPoolBuilder.ts](../engine/creation-v2/affixes/AffixPoolBuilder.ts)

```typescript
private toCandidate(def: AffixDefinition): AffixCandidate {
  return {
    id: def.id,
    name: def.displayName,
    ...
    minQuality: def.minQuality,
    // maxQuality: def.maxQuality  ← 遗漏
  };
}
```

即使增加 `maxQuality` 支持，这里也需要同步补充，目前是静默遗漏。

---

### P2-2：`CreationOrchestrator.createSession()` 不防止重复 sessionId

**现象：**
```typescript
createSession(input: CreationSessionInput): CreationSession {
  const session = new CreationSession(input);
  this.sessions.set(session.id, session);  // 若 input.sessionId 重复，静默覆盖旧 session
  return session;
}
```

**问题：**  
如果调用方传入重复的 `sessionId`，旧 session 被静默覆盖，相关 workflow completion promise 也可能孤立。在并发场景下可能导致意外的 session 替换。

**优化方案：**  
增加重复 sessionId 检查，重复时抛错或提供可选的 `overwrite` 标志。

---

### P2-3：`CreationEventBus.reset()` 会清空所有订阅者，但 handler 仍存有对旧订阅的引用

**文件：** [engine/creation-v2/core/EventBus.ts](../engine/creation-v2/core/EventBus.ts)

**现象：**  
`reset()` 清空 `subscribers` Map，但 `CreationPhaseHandlerRegistry.register()` 只调用一次，handler 闭包引用仍活跃。下次向同一 `eventBus` 实例 `reset()` 后，handler 需要重新 `register()`，否则 workflow 不再响应。

**问题：**  
当前测试中每次创建新 Orchestrator，此问题不会出现。但如果复用同一个 eventBus 实例调用 `reset()`（如 `batch clear sessions`），则 handler 订阅会被清掉，workflow 静默失效，无错误提示。

**优化方案：**  
文档化 `reset()` 的使用限制（重置后需重新 register handler），或让 `reset()` 只清空历史和排队队列，暴露单独的 `clearHistory()` / `drain()` 方法。

---

### P2-4：`WorkflowDecisionBoundary.test.ts` 的测试使用冗余的内部契约

**文件：** [engine/creation-v2/tests/contracts/WorkflowDecisionBoundary.test.ts](../engine/creation-v2/tests/contracts/WorkflowDecisionBoundary.test.ts)（未直接阅读，但从目录可见其存在）

**建议：** 需确认该测试是否依赖了 `session.state.affixPoolDecision` 或 `affixSelectionDecision` 等 session 内部字段作为断言目标。若是，则该测试的断言依赖于私有实现细节，当 session 状态结构调整时会脆断。应优化为通过 Decision 对象（由 `buildDecision` / `selectWithDecision` 返回）而非 session 内部字段进行断言。

---

### P2-5：`CreationSessionState` 字段过多，缺乏分层

**文件：** [engine/creation-v2/types.ts](../engine/creation-v2/types.ts)

```typescript
export interface CreationSessionState {
  id, phase, input, tags, materialFingerprints,
  intent?, recipeMatch?, energyBudget?,
  affixPool, affixPoolDecision?, affixSelectionDecision?,
  rolledAffixes, blueprint?, outcome?,
  failureReason?
}
```

`CreationSessionState` 混合了**输入数据**、**运行时阶段数据**、**决策审计数据**（`affixPoolDecision`/`affixSelectionDecision`）和**产出数据**，随着系统演进会越来越臃肿。

**优化方案（长期）：**  
将审计数据（`affixPoolDecision`, `affixSelectionDecision`）独立为 `CreationSessionDiagnostics` 结构，与主状态解耦。诊断数据对 workflow 主链路无影响，可以懒加载或可选引用。

---

### P2-6：测试中材料指纹（`MaterialFingerprint`）的手动构造存在大量重复样板代码

**文件：**
- [engine/creation-v2/tests/CreationOrchestrator.test.ts](../engine/creation-v2/tests/CreationOrchestrator.test.ts)
- [engine/creation-v2/tests/integration/CreationV2BattleIntegration.test.ts](../engine/creation-v2/tests/integration/CreationV2BattleIntegration.test.ts)

每个测试用例都在手动拼装 `materialFingerprints` 数组，字段多且容易不完整。

**优化方案：**  
在 `tests/` 下增加 `fixtures/` 或 `helpers/` 目录，提供 `makeFireMaterialFingerprint()`, `makeOreMaterialFingerprint()` 等测试 builder 函数，复用于多个测试。

---

### P2-7：`AsyncMaterialAnalyzer` 的 `enrichment` 类型仅有部分字段，与 `MaterialSemanticEnrichmentReport` 不完全对齐

**文件：** [engine/creation-v2/CreationOrchestrator.ts](../engine/creation-v2/CreationOrchestrator.ts)— `publishMaterialSemanticEnrichment()` 参数类型

**现象：**
```typescript
private publishMaterialSemanticEnrichment(
  ...
  enrichment: {
    status: 'disabled' | 'success' | 'fallback';
    fallbackReason?: string;
    failureDisposition?: 'retryable' | 'non_retryable';
  },
)
```

这是 `MaterialSemanticEnrichmentReport` 的部分子集，造成两处类型定义描述同一结构。

**优化方案：**  
直接使用 `MaterialSemanticEnrichmentReport` 类型（或从 `analysis/` 中导出），不重复定义局部 inline 类型。

---

### P2-8：`contracts/battle-testkit.ts` 中 `RoundPreEvent` 未被导出

**文件：** [engine/creation-v2/contracts/battle-testkit.ts](../engine/creation-v2/contracts/battle-testkit.ts)

```typescript
export type {
  DamageEvent,
  DamageRequestEvent,
  DamageTakenEvent,
  RoundPreEvent,    // ← 已导出
  SkillCastEvent,
} from '@/engine/battle-v5/core/events';
```

已导出，无问题。但 `BuffAddEvent` 未在 `battle-testkit.ts` 中导出，而词缀定义中有 `eventType: 'BuffAddEvent'` 用于 `gongfa-signature-unbound-mind`。  
如果测试需要监听或验证该事件，会因导入路径不统一而直接引用 battle-v5 内部。

**优化方案：**  
在 `battle-testkit.ts` 补充 `BuffAddEvent` 的导出，保持测试代码一致通过 contracts 层访问 battle 类型。

---

### P2-9：词缀池尺寸偏小，缺乏测试可观测性

**文件：** `affixes/definitions/*.ts`

当前词缀池：
- `skillAffixes.ts`：core×4，prefix×3，suffix×3（附件约10条）
- `artifactAffixes.ts`：core×3，prefix×3，suffix×2，signature×3
- `gongfaAffixes.ts`：core×3，prefix×2，suffix×1，signature×2

**问题：**  
词缀池规模偏小，部分产物类型（特别是 `gongfa`）的 suffix 只有 1 条，AffixSelector 测试在真实词缀池上很难观察到 `pool_exhausted` 以外的停机原因。

**优化方案（数值阶段）：**  
这本身是游戏内容工作，不属于架构缺陷。但建议在 `tests/affixes/` 中补充基于 mock registry（较大词缀池）的统计性测试（多次抽样分布），增强随机策略的可观测性。

---

## 五、已完成收口（可作为演进基准）

以下模块已经按照目标架构完成，无需改动：

| 模块 | 状态 |
|------|------|
| `core/EventBus.ts` | 优先级订阅、循环防护、历史记录 — 完整 |
| `core/GameplayTags.ts` (`CreationTagContainer`) | 层级标签系统 — 完整 |
| `rules/core/` | Rule / RuleSet / RuleContext / RuleDiagnostics — 完整 |
| `rules/contracts/` | 全部 Facts / Decision 类型 — 完整 |
| `rules/material/MaterialConflictRules.ts` | 三类冲突检测 — 完整 |
| `rules/recipe/` | ProductSupportRules / AffixUnlockRules / ReservedEnergyRules — 完整 |
| `rules/affix/` | Eligibility / Weight / ExclusiveGroup / Budget / Fallback 规则 — 完整 |
| `rules/composition/` | OutcomeTagRules / NamingRules / EnergyConversionRules / ProjectionRules / FallbackOutcomeRules — 完整（有 P1 待改进） |
| `affixes/AffixEffectTranslator.ts` | 品质缩放 + 全效果类型覆盖 — 完整 |
| `affixes/AffixPicker.ts` | 加权随机 — 完整 |
| `persistence/OutcomeSnapshot.ts` | 快照序列化 + 恢复 — 完整 |
| `handlers/WorkflowVariantPolicy.ts` | Variant 策略分离 — 完整 |
| `handlers/PhaseActionRegistry.ts` | 可替换 action 映射 — 完整 |
| `analysis/SemanticTagAllowlist.ts` | 别名归一化白名单 — 完整 |
| `config/` 所有文件 | 配置与代码分离 — 基本完整（P1-1/P1-2 有补充点） |
| `contracts/battle.ts` + `battle-testkit.ts` | 单向边界 — 基本完整 |

---

## 六、问题优先级汇总

| ID | 描述摘要 | 优先级 |
|----|---------|--------|
| P0-1 | 词缀定义直接引用 `battle-v5.GameplayTags` | **P0** |
| P0-2 | `CreationTags.BATTLE_EVENT/LISTENER_SCOPE` 为裸字符串，与 battle-v5 隐式耦合 | **P0** |
| P0-3 | 词缀 `listenerSpec.eventType` 全为裸字符串 | **P0** |
| P0-4 | `ArtifactProductModel` / `GongFaProductModel` 字段冗余 | **P0** |
| P1-1 | `inferSlotBias()` 推断逻辑不在规则层，有 `console.warn` | P1 |
| P1-2 | 全类 skill 被打上 `Ability.Type.Damage` 标签（heal skill 语义错误） | P1 |
| P1-3 | `ProjectionRules` 中 `coreType` 推断无 trace，`cooldown` 应归入 energyConversion | P1 |
| P1-4 | 功法命名无 fallback 配置项 | P1 |
| P1-5 | `process.env` 出现在引擎层 | P1 |
| P1-6 | `reconcileRolledAffixes` 与 `applySelectionAudit` 双重更新边界不清晰 | P1 |
| P1-7 | `xxxWithDefaults` 方法 public 泄露，可绕过 EDA 链路 | P1 |
| P1-8 | `CreationBlueprint` / `CraftedOutcome` 字段冗余 | P1 |
| P1-9 | `AffixCandidate.maxQuality` 声明但未实现 | P1 |
| P1-10 | `MULTIPLY` modType 使用的语义文档和测试缺失 | P1 |
| P2-1 | `toCandidate()` 未传入 `maxQuality` | P2 |
| P2-2 | `createSession()` 不防重复 sessionId | P2 |
| P2-3 | `EventBus.reset()` 清空订阅者，handler 需重新注册 | P2 |
| P2-5 | `CreationSessionState` 字段混杂，缺乏分层 | P2 |
| P2-6 | 测试指纹构造大量重复样板 | P2 |
| P2-7 | `publishMaterialSemanticEnrichment` 参数类型是 inline 子集 | P2 |
| P2-8 | `battle-testkit.ts` 缺少 `BuffAddEvent` 导出 | P2 |
| P2-9 | 词缀池过小，随机策略缺少统计性测试 | P2 |

---

## 七、推荐演进顺序

### 阶段 A：边界收口（对应 P0 问题）

1. **扩充 `CreationTags.BATTLE_EVENT`**，加入 `ROUND_PRE`, `SKILL_CAST`, `DAMAGE_REQUEST`, `BUFF_ADD`, `DAMAGE` 等事件名，均从 `contracts/battle.ts` 导入的类型约束下声明；
2. **更新所有词缀定义和规则文件**，将 `eventType: 'ActionPreEvent'` 等裸字符串替换为 `CreationTags.BATTLE_EVENT.ACTION_PRE`；
3. **替换 `GameplayTags` 直接引用**，将 `tags: [GameplayTags.ABILITY.TYPE_MAGIC]` 等迁移到 `CreationTags.BATTLE.*` 或从 contracts 导出的字面量常量；
4. **清理 `ArtifactProductModel`** 顶层的 policy 字段冗余（P0-4）。

### 阶段 B：规则层完善（对应 P1 高优问题）

1. 把 `inferSlotBias()` 迁移为 `SlotBiasRule`；
2. 修复 `OutcomeTagRules` 对 skill ability 标签的过度统一；
3. 将 `coreType` 推断和 `cooldown` 换算统一到 `EnergyConversionRules`；
4. 实现或删除 `maxQuality` 字段（P1-9）；
5. 将 `process.env` 移出引擎层（P1-5）。

### 阶段 C：架构健壮性（对应 P1 低优和 P2 问题）

1. 明确 `reconcileRolledAffixes` vs `applySelectionAudit` 的使用约定；
2. 决策 `xxxWithDefaults` 的可见性（P1-7）；
3. 补充 `battle-testkit.ts` 缺失导出（P2-8）；
4. 补充 `gongfa` 命名 fallback 配置（P1-4）；
5. 补充测试 fixtures helpers，减少样板（P2-6）；
6. 增加 `MULTIPLY` modType 的测试覆盖（P1-10）。

---

*最后更新：2026-04-02*
