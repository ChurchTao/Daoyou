# 造物系统 v2 — 整体架构蓝图

> 文档用途：描述造物系统 v2（`engine/creation-v2`）的**理想目标架构**，  
> 作为所有后续演进工作的设计基准。  
> 本文档仅描述 creation-v2 内部设计，不涉及业务层（lib/services）与 UI 层接入方式。

---

## 一、设计原则

| 原则 | 含义 |
|------|------|
| **引擎层纯逻辑** | engine/creation-v2 不依赖 Next.js / DB / Redis，可在 Node 纯环境运行和测试 |
| **EDA 事件驱动** | 工作流通过发布领域事件推进，各阶段松耦合，支持插入观察者 |
| **规则层收口** | 所有业务判断集中在 `rules/`，以 Facts → Decision 的结构化方式返回，可审计、可测试 |
| **单向依赖** | `adapters/` 是 creation-v2 与 battle-v5 的唯一边界，上游不直接引用 battle-v5 内部实现 |
| **产物模型优先** | `CreationProductModel`（领域模型）是真相源，battle 层投影（`AbilityConfig`）由产物模型派生 |
| **配置真相源集中** | 数值、阈值、命名、fallback 策略均在 `config/` 中声明，禁止在规则/Composer 内硬编码 |
| **可扩展 workflow** | 不同造物变体（quick craft / expert craft / bulk craft）通过 `WorkflowVariantPolicy` + `PhaseActionRegistry` 扩展，不改主流程 |

---

## 二、整体分层架构

```
┌───────────────────────────────────────────────────────────────┐
│  Presentation / Service Layer（业务服务层，在 lib/ 目录）        │
│  调用 CreationOrchestrator，写入 DB / Redis                     │
└─────────────────────────┬─────────────────────────────────────┘
                          │  CreationSessionInput
                          ▼
┌─────────────────────────────────────────────────────────────  ┐
│  Orchestration Layer（编排层）                                  │
│  CreationOrchestrator + CreationSession                        │
│  职责：Session 生命周期 + 工作流驱动 + 事件发布                 │
└──────────────────────────┬────────────────────────────────────┘
                           │  CreationDomainEvent
                           ▼
┌─────────────────────────────────────────────────────────────  ┐
│  Event Layer（事件层）                                          │
│  CreationEventBus + CreationDomainEvent（events.ts）            │
│  CreationPhaseHandlerRegistry（handlers/）                      │
│  WorkflowVariantPolicy + PhaseActionRegistry                   │
│  职责：事件路由 + 工作流阶段分发 + variant 策略决策             │
└──────────────────────────┬────────────────────────────────────┘
                           │  触发各阶段服务调用
             ┌─────────────┼──────────────────────────┐
             ▼             ▼                          ▼
┌────────────────┐  ┌─────────────────┐  ┌───────────────────┐
│ Analysis Layer │  │  Rules Layer    │  │ Composition Layer  │
│ (analysis/)    │  │  (rules/)       │  │ (composers/)       │
│                │  │                │  │                   │
│ DOM分析：       │  │ Facts→Decision  │  │ Decision→Blueprint │
│ 材料指纹提取    │  │ 材料/配方/词缀   │  │ Blueprint→Product  │
│ LLM 语义增强   │  │ 组合规则执行     │  │ Model              │
└────────────────┘  └─────────────────┘  └───────────────────┘
             │             │                          │
             └─────────────┴──────────────────────────┘
                           │  通过 Adapter 落地
                           ▼
┌─────────────────────────────────────────────────────────────  ┐
│  Adapter Layer（适配层）                                        │
│  contracts/battle.ts（接口墙）                                  │
│  BattleAbilityBuilder + CreationAbilityAdapter                 │
│  职责：ProductModel → AbilityConfig → Ability 实例化            │
└─────────────────────────────────────────────────────────────  ┘
```

---

## 三、核心工作流（EDA 主链路）

### 3.1 阶段序列

```
INIT
  → [submitMaterials] → MATERIAL_SUBMITTED
  → [MaterialSubmittedEvent → analyzeMaterials] → MATERIAL_ANALYZED
  → [MaterialAnalyzedEvent → resolveIntent] → INTENT_RESOLVED
  → [IntentResolvedEvent → validateRecipe] → RECIPE_VALIDATED
  → [RecipeValidatedEvent → budgetEnergy] → ENERGY_BUDGETED
  → [EnergyBudgetedEvent → buildAffixPool] → AFFIX_POOL_BUILT
  → [AffixPoolBuiltEvent → rollAffixes] → AFFIX_ROLLED
  → [AffixRolledEvent → composeBlueprint] → BLUEPRINT_COMPOSED
  → [BlueprintComposedEvent → materialize(optional)] → OUTCOME_MATERIALIZED
  → [OutcomeMaterializedEvent → complete] ✓
  ⊗ [任意阶段失败 → CraftFailedEvent] → FAILED
```

### 3.2 Workflow Variant 矩阵

| 选项 | 值 | 效果 |
|------|----|------|
| `materialAnalysisMode` | `'sync'`（默认） | 同步材料分析，跳过 LLM 语义增强 |
| `materialAnalysisMode` | `'async'` | 异步 LLM 语义增强，增加材料语义标签 |
| `autoMaterialize` | `true`（默认） | 蓝图组合后自动实体化，最终 phase = `OUTCOME_MATERIALIZED` |
| `autoMaterialize` | `false` | 工作流在 `BLUEPRINT_COMPOSED` 停止，由调用方手动触发实体化 |

未来扩展：`quick_craft`（跳过词缀选择）、`expert_craft`（调用方干预词缀选择）等变体通过 `WorkflowVariantPolicy` 新增配置项实现，不改主流程代码。

---

## 四、各模块职责边界

### 4.1 Orchestration Layer

**文件：** `CreationOrchestrator.ts`, `CreationSession.ts`

**职责：**
- 管理 Session 生命周期（创建、存储、完成）
- 驱动事件链起始（`submitMaterials` 发布 `MaterialSubmittedEvent`）
- 为每个阶段提供 `xxxWithDefaults()` 执行方法（内部方法，供 `PhaseActionRegistry` 注册）
- 提供 `waitForWorkflowCompletion()` 的异步等待接口

**不负责：**
- 业务规则判断
- 数值换算策略选择
- Fallback 逻辑

**理想状态：** Orchestrator 的 public API 应仅暴露以下几类：
1. Session 管理：`createSession`, `getSession`
2. 工作流入口：`runEventDrivenWorkflow`, `waitForWorkflowCompletion`
3. 手动触发步骤（供 `autoMaterialize=false` 场景）：`materializeOutcome`, `materializeOutcomeWith`, `markPersisted`
4. 事件总线：`eventBus`（供外部订阅观察性事件）
5. 词缀注册表：`affixRegistry`（供外部查询）

### 4.2 Event Layer

**文件：** `core/EventBus.ts`, `core/events.ts`, `handlers/CreationPhaseHandlers.ts`,  
`handlers/PhaseActionRegistry.ts`, `handlers/WorkflowVariantPolicy.ts`

**职责：**
- `CreationEventBus`：同步消息总线，支持优先级订阅，带循环保护（`isPublishing` flag）
- `CreationPhaseHandlerRegistry`：将事件类型映射到工作流阶段转换，统一管理阶段守卫逻辑
- `PhaseActionRegistry`：`WorkflowActionKey → PhaseAction` 的可替换动作映射表
- `WorkflowVariantPolicy`：从 `CreationWorkflowOptions` 派生材料分析策略和实体化策略

**事件分类：**

| 类别 | 事件 | 说明 |
|------|------|------|
| 主链路 | MaterialSubmitted → ... → OutcomeMaterialized | 每个事件触发下一阶段 |
| 错误路 | CraftFailedEvent | 任意阶段失败，终止工作流 |
| 观察性 | MaterialSemanticEnrichedEvent, MaterialSemanticEnrichmentFallbackEvent 等 | 不推进阶段，供外部消费 |

### 4.3 Analysis Layer

**文件：** `analysis/DefaultMaterialAnalyzer.ts`, `analysis/AsyncMaterialAnalyzer.ts`,  
`analysis/MaterialTagNormalizer.ts`, `analysis/MaterialFactsBuilder.ts`,  
`analysis/MaterialSemanticEnricher.ts`, `analysis/SemanticTagAllowlist.ts`

**职责：**
- `MaterialTagNormalizer`：从 `Material` 对象提取显式标签、语义标签（基于关键词规则）、配方标签
- `DefaultMaterialAnalyzer`：同步模式，生成 `MaterialFingerprint[]`
- `AsyncMaterialAnalyzer`：异步模式，调用 `MaterialSemanticEnricher` 进行 LLM 增强，合并至指纹
- `MaterialSemanticEnricher`：LLM 接口层，调用 AI 生成额外语义标签，结果通过白名单过滤
- `SemanticTagAllowlist`：语义标签白名单 + 别名归一化（防止 LLM 生成噪声标签）
- `MaterialFactsBuilder`：从多个指纹聚合为 `MaterialFacts`，计算 dominantTags、totalEnergy 等

**不负责：**
- 材料冲突检测（归 `rules/material/MaterialConflictRules`）
- Recipe bias 最终裁决（归 `rules/recipe/`）
- 词缀可用性判断

### 4.4 Rules Layer

**文件：** `rules/core/`, `rules/contracts/`, `rules/material/`, `rules/recipe/`,  
`rules/affix/`, `rules/composition/`

**核心模式：**
```typescript
RuleSet<TFacts, TDecision>.evaluate(facts) → TDecision
```
- `TFacts`：只读输入，代表当前造物的已知事实
- `TDecision`：可变输出，Rule 逐步填充决策字段
- `RuleDiagnostics`：规则执行过程中的 reasons / warnings / trace，合并到 TDecision

**规则分组：**

| 分组 | Facts 类型 | Decision 类型 | 职责 |
|------|-----------|--------------|------|
| `material/` | `MaterialFacts` | `MaterialDecision` | 材料合法性、冲突检测 |
| `recipe/` | `RecipeFacts` | `RecipeDecision` | 产物支持、词缀解锁、预留能量 |
| `affix/ (pool)` | `AffixEligibilityFacts` | `AffixPoolDecision` | 词缀候选资格过滤、权重合法性 |
| `affix/ (selection)` | `AffixSelectionFacts` | `AffixSelectionDecision` | 独占组过滤、预算过滤、停机原因 |
| `composition/` | `CompositionFacts` | `CompositionDecision` | 命名、标签、能量换算、投影策略生成 |

**组合关系：**
- `DefaultRecipeValidator` = `MaterialFactsBuilder` → `MaterialRuleSet` → `RecipeValidationRuleSet`（门面模式）
- `AffixPoolBuilder.buildDecision()` = 查询 `AffixRegistry` → `AffixPoolRuleSet`
- `AffixSelector.selectWithDecision()` = 迭代调用 `AffixSelectionRuleSet` + `AffixPicker`
- `CompositionRuleSet` = `OutcomeTagRules` → `NamingRules` → `EnergyConversionRules` → `ProjectionRules` → `FallbackOutcomeRules`

### 4.5 Composition Layer

**文件：** `composers/`, `models/`

**职责：**
- 接收已执行的 `CompositionDecision` 中的 `projectionPolicy`，组装 `CreationProductModel`
- 从 `ProductModel` 投影出 `AbilityConfig`（`models/AbilityProjection.ts`）
- 三类产物（skill / artifact / gongfa）各有专属 Composer，由 `ProductComposerRegistry` 路由

**产物模型层级：**
```
CreationBlueprint
├── outcomeKind
├── name / description / tags / affixes（汇总字段，与 productModel 同步）
├── productModel: CreationProductModel（领域真相源）
│   ├── battleProjection: ActiveSkillBattleProjection / ArtifactBattleProjection / GongFaBattleProjection
│   └── ...domain policy fields
└── abilityConfig: AbilityConfig（battle 投影，由 projectAbilityConfig 派生）
```

### 4.6 Affix Layer

**文件：** `affixes/`

**职责：**
- `AffixRegistry`：词缀定义存储，支持按 tag/类别/产物类型查询
- `AffixDefinition`（`affixes/types.ts`）：词缀完整定义，含 `effectTemplate`（品质缩放参数）和 `listenerSpec`（被动监听器规格）
- `AffixEffectTranslator`：将 `AffixDefinition + Quality` 翻译为 `EffectConfig`（creation-v2 与 battle-v5 的数值换算边界）
- `AffixPoolBuilder`：调用 `AffixRegistry.queryByTags` + `AffixPoolRuleSet`，产出候选词缀列表
- `AffixSelector`：迭代调用 `AffixSelectionRuleSet` + `AffixPicker`，在预算约束下随机抽取词缀
- `AffixPicker`：加权随机抽签（纯策略，不含规则判断）
- `DEFAULT_AFFIX_REGISTRY`：预填了 SKILL / ARTIFACT / GONGFA 三个词缀池

**词缀分类解锁阈值：**

| 类别 | 解锁能量 | 说明 |
|------|---------|------|
| `core` | 0（默认解锁） | 核心效果词缀，每个 exclusiveGroup 只能选一个 |
| `prefix` | ≥ 12 | 前置增益词缀 |
| `suffix` | ≥ 20 | 后置效果词缀 |
| `signature` | ≥ 32 | 签名特性词缀 |

### 4.7 Adapter Layer

**文件：** `adapters/`, `contracts/battle.ts`, `contracts/battle-testkit.ts`

**职责：**
- `contracts/battle.ts`：接口墙，从 battle-v5 重导出 creation-v2 需要的类型和工厂（运行时）
- `contracts/battle-testkit.ts`：测试专用再导出，暴露 Unit / EventBus / Buff 等测试所需运行时对象
- `BattleAbilityBuilder`：调用 `AbilityFactory.create(config)` 构建 `Ability` 实例
- `CreationAbilityAdapter`：实现 `CreationOutcomeMaterializer`，将 blueprint 物化为 `CraftedOutcome`

**数据流方向（单向）：**
```
creation-v2 → contracts/battle.ts → battle-v5
              （只允许此方向的类型和工厂引用）
```

### 4.8 Config Layer

**文件：** `config/`

| 文件 | 职责 |
|------|------|
| `CreationBalance.ts` | 数值平衡常量（词缀解锁阈值、预留能量、技能默认值、投影平衡系数） |
| `CreationEventPriorities.ts` | 被动监听器优先级常量（供 affix 定义和 rules 引用） |
| `CreationMappings.ts` | 元素 → 标签 / 元素 → 命名前缀 的映射表 |
| `CreationSlugConfig.ts` | Ability slug 和 buff id 前缀配置 |
| `CreationNamingPolicy.ts` | 命名模板配置（前缀、后缀、UI 显示名） |
| `CreationFallbackPolicy.ts` | Fallback 产物的固定 buff 参数（id/name/attrType 等） |
| `CreationRulePolicy.ts` | 规则执行顺序声明、trace outcome 常量 |

### 4.9 Persistence Layer

**文件：** `persistence/OutcomeSnapshot.ts`

**职责：** 提供 `CraftedOutcome` ↔ 序列化快照的转换工具，用于写入数据库。  
通过快照恢复时重新运行 `materializer.materialize()`，保证 `Ability` 实例始终由当前代码生成。

---

## 五、造物域语义标签体系

造物系统使用三个命名空间的标签：

```
Material.*          — 材料属性标签（类型、品质、元素、语义）
Recipe.*            — 配方偏向标签（产物类型偏向、设计意图）
Intent.*            — 造物意图标签（产物种类、产出类型）
Affix.*             — 词缀分类标签
Outcome.*           — 产出成果标签
Energy.*            — 能量阶段标签（预留，暂未启用）
```

`CreationTags` 常量对象（`core/GameplayTags.ts`）是所有标签字符串的唯一真相源。  
`CreationTagContainer` 支持层级标签（`Material.Semantic` 命中 `Material` 前缀）及组合查询。

---

## 六、数值换算模型

### 6.1 能量计算

```
material.energyValue = (QUALITY_ORDER[rank] + 1) × quantity × 4 + typeBonus
typeBonus = gongfa_manual / skill_manual → 6, manual → 4, 其他 → 0

EnergyBudget.total = Σ materialFingerprint.energyValue
EnergyBudget.reserved = CREATION_RESERVED_ENERGY[productType]  (skill=6, artifact=4, gongfa=4)
EnergyBudget.initialRemaining = total - reserved
```

### 6.2 技能投影换算

```
mpCost = max(10, round(total / 3))
priority = 10 + affixes.length
cooldown = 核心词缀类型决定：heal→1, apply_buff→3, damage→2
```

### 6.3 词缀数值缩放

```
ScalableParam = number | { base, scale: 'quality' | 'none', coefficient }
resolvedValue = scale === 'quality' ? base + qualityOrder × coefficient : base
qualityOrder = QUALITY_ORDER[quality]  (凡品=0, 灵品=1, 玄品=2, 真品=3, 仙品=4)
```

---

## 七、产物类型映射

| 产物类型 | 造物域 `outcomeKind` | Battle 层投影 | `AbilityType` |
|---------|---------------------|-------------|---------------|
| `skill` | `active_skill` | `ActiveSkillBattleProjection` | `ACTIVE_SKILL` |
| `artifact` | `artifact` | `ArtifactBattleProjection` | `PASSIVE_SKILL` |
| `gongfa` | `gongfa` | `GongFaBattleProjection` | `PASSIVE_SKILL` |

**被动能力 listener 分组规则：** 相同 `(eventType, scope, priority)` 的词缀效果合并为同一 `ListenerConfig`，不同规格的词缀各自独立 listener。

---

## 八、测试策略

| 层级 | 位置 | 测试内容 |
|------|------|---------|
| 规则单元测试 | `tests/rules/` | 各 RuleSet 在固定 Facts 下的 Decision 产出 |
| 词缀系统测试 | `tests/affixes/` | AffixPool 构建 + AffixSelector 选择逻辑 |
| 分析层测试 | `tests/analysis/` | MaterialAnalyzer 指纹结构、SemanticTagAllowlist 归一化 |
| 预算测试 | `tests/budgeting/` | 能量闭环守恒（total = reserved + spent + remaining） |
| Composer 测试 | `tests/rules/composition/` | 完整的 CompositionRuleSet 输入输出 |
| 集成测试 | `tests/integration/` | 完整 workflow variant 路径（sync/async × auto/manual materialize） |
| 契约测试 | `tests/contracts/` | battle 接口结构约束、public API 锁定 |
| Orchestrator 测试 | `tests/CreationOrchestrator.test.ts` | 分步手动主流程 E2E |
| 战斗集成测试 | `tests/integration/CreationV2BattleIntegration.test.ts` | 产物 Ability 在战斗 Unit 中的真实运行验证 |

---

## 九、未来扩展预留点

| 扩展点 | 当前预留方式 |
|--------|------------|
| 新产物类型 | `ProductComposerRegistry` 注册新 Composer；`CreationProductType` 扩展新枚举值 |
| 新 workflow variant | `WorkflowVariantPolicy` 新增配置项；`PhaseActionRegistry.override()` 替换单阶段动作 |
| 新词缀类别 | `AffixCategory` 类型扩展；`CREATION_AFFIX_UNLOCK_THRESHOLDS` 增加阈值；补充词缀定义 |
| 新效果类型 | `AffixEffectTemplate` 新增 variant；`AffixEffectTranslator` 新增 case |
| 批量/专家造物 | `PhaseActionRegistry.override()` 替换 `rollAffixes` 动作；自定义 `AffixSelector` 实现 |
| 出入口审计 | 订阅所有领域事件（包括观察性事件）；或替换 `PhaseActionRegistry` 中的动作加 hook |

---

*最后更新：2026-04-02*
