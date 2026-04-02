# Creation-v2 全面重构蓝图

## 文档目标

本文档用于指导 `engine/creation-v2` 的后续全面重构，重点解决以下问题：

1. 业务规则散落在 analyzer / validator / affix / composer / orchestrator 中，缺少统一规则层。
2. 模块边界虽然初步形成，但 battle-v5 契约隔离、标签真相源、策略配置源、产物投影职责仍未完全收口。
3. 当前系统已可运行，但尚未达到“可持续演进的 v2 平台层”状态。

本文档只覆盖 `creation-v2` 内部重构，不设计 battle-v5 复用方案。

---

## 重构目标

### 一级目标

1. 建立 creation-v2 内部的显式规则层，使“业务判断”从流程代码中收口。
2. 让 orchestrator 回归流程编排职责，不再兼任业务规则中心。
3. 统一配置、标签、阈值、fallback、命名和数值换算的真相源。
4. 收口 creation-v2 与 battle-v5 的边界，把 battle 具体实现继续下沉到 adapter / testkit。
5. 形成一套可声明、可组合、可审计、可测试的造物系统 v2 架构。

### 二级目标

1. 让新产物类型扩展成本下降。
2. 让随机选择、失败原因、候选词缀拒绝原因具备可解释性。
3. 为后续 quick craft / expert craft / bulk craft 等 workflow variant 预留扩展空间。

### 非目标

1. 不引入通用 DSL、表达式引擎、YAML 规则热加载。
2. 不做 battle-v5 复用型规则平台。
3. 不在第一阶段同时大改平衡数值。
4. 不参考或复用初版造物系统实现。

---

## 当前问题归类

### P0: 架构与边界问题

1. 规则没有独立层，业务判断分散在多个模块。
2. orchestrator 已能事件驱动推进，但阶段服务仍是固定依赖，尚未形成真正可插拔工作流。
3. creation-v2 与 battle-v5 的契约边界仍不够薄，部分 battle 类型仍直接进入运行时内部。

### P1: 真相源与策略问题

1. 标签、语义规则、recipe bias、fallback、命名规则仍然散落。
2. energy 到 mpCost / damage / shield / heal / cooldown 的映射还没有统一策略层。
3. affix 候选与选择逻辑同时承担“规则判断”和“随机策略”，职责混合。

### P2: 测试与演进问题

1. 测试已有基础，但对架构承诺的锁定还不够完整。
2. diagnostics、decision trace、规则执行解释链还没有形成正式契约。
3. 未来扩产物、扩规则、改 workflow 的成本仍偏高。

---

## 目标目录级实施方案

下面是建议的目标目录结构。原则是：

1. `analysis` 负责事实提取，不再承担完整业务决策。
2. `rules` 负责业务判断。
3. `composers` 负责把 decision 投影为 blueprint / product model。
4. `adapters` 负责跨 creation-v2 与 battle-v5 的落地边界。

### 建议目录结构

```text
engine/creation-v2/
├── CreationOrchestrator.ts
├── CreationSession.ts
├── adapters/
│   ├── BattleAbilityBuilder.ts
│   ├── CreationAbilityAdapter.ts
│   └── types.ts
├── analysis/
│   ├── DefaultMaterialAnalyzer.ts
│   ├── AsyncMaterialAnalyzer.ts
│   ├── MaterialFactsBuilder.ts                  # 新增
│   └── MaterialTagNormalizer.ts                 # 收敛为基础归一化工具
├── affixes/
│   ├── AffixPoolBuilder.ts                      # 逐步退化为 decision applier
│   ├── AffixSelector.ts                         # 逐步退化为 picker / executor
│   ├── AffixPicker.ts                           # 新增：随机策略
│   ├── AffixRegistry.ts
│   ├── AffixEffectTranslator.ts
│   ├── definitions/
│   └── types.ts
├── composers/
│   ├── SkillBlueprintComposer.ts
│   ├── ArtifactBlueprintComposer.ts
│   ├── GongFaBlueprintComposer.ts
│   ├── shared.ts
│   └── types.ts
├── config/
│   ├── CreationBalance.ts
│   ├── CreationMappings.ts
│   ├── CreationSlugConfig.ts
│   ├── CreationEventPriorities.ts
│   ├── CreationNamingPolicy.ts                  # 新增
│   ├── CreationFallbackPolicy.ts                # 新增
│   └── CreationRulePolicy.ts                    # 新增
├── contracts/
│   ├── battle.ts
│   └── battle-testkit.ts
├── core/
│   ├── EventBus.ts
│   ├── GameplayTags.ts
│   ├── events.ts
│   └── types.ts
├── handlers/
│   └── CreationPhaseHandlers.ts
├── models/
│   ├── AbilityProjection.ts
│   ├── index.ts
│   └── types.ts
├── persistence/
│   └── OutcomeSnapshot.ts
├── resolvers/
│   └── DefaultIntentResolver.ts
├── rules/
│   ├── core/
│   │   ├── Rule.ts                             # 新增
│   │   ├── RuleSet.ts                          # 新增
│   │   ├── RuleContext.ts                      # 新增
│   │   ├── RuleDiagnostics.ts                  # 新增
│   │   └── types.ts                            # 新增
│   ├── contracts/
│   │   ├── MaterialFacts.ts                    # 新增
│   │   ├── RecipeFacts.ts                      # 新增
│   │   ├── AffixEligibilityFacts.ts            # 新增
│   │   ├── AffixSelectionFacts.ts              # 新增
│   │   ├── CompositionFacts.ts                 # 新增
│   │   ├── MaterialDecision.ts                 # 新增
│   │   ├── RecipeDecision.ts                   # 新增
│   │   ├── AffixPoolDecision.ts                # 新增
│   │   ├── AffixSelectionDecision.ts           # 新增
│   │   └── CompositionDecision.ts              # 新增
│   ├── material/
│   │   ├── MaterialTypeRules.ts                # 新增
│   │   ├── MaterialSemanticRules.ts            # 新增
│   │   ├── RecipeBiasRules.ts                  # 新增
│   │   ├── MaterialConflictRules.ts            # 从现有文件迁移
│   │   └── MaterialRuleSet.ts                  # 新增
│   ├── recipe/
│   │   ├── ProductSupportRules.ts              # 新增
│   │   ├── AffixUnlockRules.ts                 # 新增
│   │   ├── ReservedEnergyRules.ts              # 新增
│   │   ├── RecipeValidationRuleSet.ts          # 新增
│   │   └── DefaultRecipeValidator.ts           # 过渡期保留，后续退化为适配器
│   ├── affix/
│   │   ├── AffixEligibilityRules.ts            # 新增
│   │   ├── AffixWeightRules.ts                 # 新增
│   │   ├── ExclusiveGroupRules.ts              # 新增
│   │   ├── BudgetExhaustionRules.ts            # 新增
│   │   ├── FallbackAffixRules.ts               # 新增
│   │   ├── AffixPoolRuleSet.ts                 # 新增
│   │   └── AffixSelectionRuleSet.ts            # 新增
│   └── composition/
│       ├── NamingRules.ts                      # 新增
│       ├── FallbackOutcomeRules.ts             # 新增
│       ├── EnergyConversionRules.ts            # 新增
│       ├── ProjectionRules.ts                  # 新增
│       └── CompositionRuleSet.ts               # 新增
└── tests/
    ├── contracts/
    ├── rules/                                  # 新增
    │   ├── material/
    │   ├── recipe/
    │   ├── affix/
    │   └── composition/
    ├── integration/
    └── ...
```

---

## 目标模块职责

### analysis

职责：

1. 从原始材料、session 输入、外部异步语义分析结果中提取事实。
2. 生成 `MaterialFacts`，而不是直接给出最终 recipe / affix / composition 决策。

不再负责：

1. 完整 recipe bias 决策。
2. 材料冲突裁决。
3. 最终能量与解锁层级决策。

### rules

职责：

1. 基于事实对象执行业务判断。
2. 输出结构化 `Decision`。
3. 返回 diagnostics、reasons、warnings、trace。

这是未来最重要的真相源。

### affixes

职责：

1. 管理 affix 定义与 registry。
2. 承载 picker 等策略执行器。
3. 接收 rules 的 decision，而不是继续独占业务规则。

### composers

职责：

1. 把 `CompositionDecision` 投影为 `CreationBlueprint`。
2. 组装 `productModel` 与 `abilityConfig`。

不再负责：

1. 写死 fallback。
2. 写死命名规则。
3. 写死数值换算策略。

### adapters

职责：

1. 作为 creation-v2 与 battle-v5 的单向落地边界。
2. 只承接 ability materialization 与 runtime object build。

### handlers / orchestrator

职责：

1. 阶段推进。
2. 调用 facts builder。
3. 调用 rule runner。
4. 应用 decision。

不再负责：

1. 业务规则本身。
2. fallback 规则。
3. 产物策略选择。

---

## 分阶段实施方案

建议分为 5 个阶段，每一阶段都有明确的目标、修改文件和验收标准。

---

## 阶段 0：基线冻结与现状收口

### 目标

1. 冻结当前可运行主链路，避免边改边漂移。
2. 锁定现有 public exports、battle contract、关键行为测试。
3. 清理已知遗留入口和重复真相源。

### 本阶段应完成的文件改造清单

#### 已完成或应保持完成

1. [engine/creation-v2/index.ts](../engine/creation-v2/index.ts)
   动作：保持不再暴露 `DefaultBlueprintComposer`。

2. [engine/creation-v2/models/index.ts](../engine/creation-v2/models/index.ts)
   动作：保持不再导出过时符号。

3. [engine/creation-v2/contracts/battle.ts](../engine/creation-v2/contracts/battle.ts)
   动作：维持“主合同只暴露运行时必要类型”的方向。

4. [engine/creation-v2/contracts/battle-testkit.ts](../engine/creation-v2/contracts/battle-testkit.ts)
   动作：继续承接测试专用 battle 运行时对象。

5. [engine/creation-v2/tests/contracts/PublicApiExports.test.ts](../engine/creation-v2/tests/contracts/PublicApiExports.test.ts)
   动作：作为 public surface 与 contract boundary 的基线测试。

### 本阶段验收标准

1. creation-v2 当前关键主流程测试通过。
2. public API 不再暴露已废弃入口。
3. 主 battle contract 不重新泄漏 test-only 依赖。

---

## 阶段 1：建立规则核心骨架

### 目标

1. 建立规则层基础设施，但不大改现有行为。
2. 先让 facts / decisions / diagnostics 有统一模型。
3. 为后续迁移材料、配方、词缀和 composition 规则做容器准备。

### 新增目录与文件

1. `engine/creation-v2/rules/core/Rule.ts`
   作用：定义基础规则接口。

2. `engine/creation-v2/rules/core/RuleSet.ts`
   作用：定义规则集合执行器。

3. `engine/creation-v2/rules/core/RuleContext.ts`
   作用：定义规则执行上下文。

4. `engine/creation-v2/rules/core/RuleDiagnostics.ts`
   作用：统一规则诊断输出结构。

5. `engine/creation-v2/rules/contracts/MaterialFacts.ts`
6. `engine/creation-v2/rules/contracts/RecipeFacts.ts`
7. `engine/creation-v2/rules/contracts/AffixEligibilityFacts.ts`
8. `engine/creation-v2/rules/contracts/AffixSelectionFacts.ts`
9. `engine/creation-v2/rules/contracts/CompositionFacts.ts`
10. `engine/creation-v2/rules/contracts/MaterialDecision.ts`
11. `engine/creation-v2/rules/contracts/RecipeDecision.ts`
12. `engine/creation-v2/rules/contracts/AffixPoolDecision.ts`
13. `engine/creation-v2/rules/contracts/AffixSelectionDecision.ts`
14. `engine/creation-v2/rules/contracts/CompositionDecision.ts`

### 修改文件清单

1. [engine/creation-v2/types.ts](../engine/creation-v2/types.ts)
   动作：必要时补充与 Decision 对齐的中间类型，但不要让 `types.ts` 重新膨胀成所有真相源。

2. [engine/creation-v2/CreationOrchestrator.ts](../engine/creation-v2/CreationOrchestrator.ts)
   动作：仅做最小适配准备，不改主业务行为。

3. [engine/creation-v2/tests/contracts/PublicApiExports.test.ts](../engine/creation-v2/tests/contracts/PublicApiExports.test.ts)
   动作：补对 rules contracts 的导出约束测试。

### 本阶段验收标准

1. rules core 存在且可被最小单测使用。
2. 不改变现有材料分析、recipe、affix、composition 行为。
3. facts / decisions / diagnostics 类型具备最小可用性。

---

## 阶段 2：材料与配方规则迁移

### 目标

1. 把材料分类、语义识别、recipe bias、冲突检测和 recipe 判定从局部 helper 中抽离出来。
2. 让 analyzer 产出 `MaterialFacts`，让 recipe validator 消费 `RecipeDecision`。

### 新增文件

1. `engine/creation-v2/analysis/MaterialFactsBuilder.ts`
2. `engine/creation-v2/rules/material/MaterialTypeRules.ts`
3. `engine/creation-v2/rules/material/MaterialSemanticRules.ts`
4. `engine/creation-v2/rules/material/RecipeBiasRules.ts`
5. `engine/creation-v2/rules/material/MaterialRuleSet.ts`
6. `engine/creation-v2/rules/recipe/ProductSupportRules.ts`
7. `engine/creation-v2/rules/recipe/AffixUnlockRules.ts`
8. `engine/creation-v2/rules/recipe/ReservedEnergyRules.ts`
9. `engine/creation-v2/rules/recipe/RecipeValidationRuleSet.ts`

### 修改文件清单

1. [engine/creation-v2/analysis/MaterialTagNormalizer.ts](../engine/creation-v2/analysis/MaterialTagNormalizer.ts)
   动作：
   - 保留基础归一化职责。
   - 移出 recipe bias 的最终业务决策。
   - 移出完整 semantic 业务裁定逻辑到 material rules。

2. [engine/creation-v2/rules/MaterialConflictRules.ts](../engine/creation-v2/rules/MaterialConflictRules.ts)
   动作：
   - 迁入 `rules/material/`。
   - 从 helper 变成规则实现或规则集成员。
   - 输出结构化 decision / diagnostics，而不是只返回数组。

3. [engine/creation-v2/rules/DefaultRecipeValidator.ts](../engine/creation-v2/rules/DefaultRecipeValidator.ts)
   动作：
   - 退化为适配器或 facade。
   - 内部改为组装 `RecipeFacts` 并执行 `RecipeValidationRuleSet`。

4. [engine/creation-v2/config/CreationBalance.ts](../engine/creation-v2/config/CreationBalance.ts)
   动作：
   - 继续承接 affix unlock thresholds、reserved energy。
   - 避免把规则逻辑再次写回配置文件。

5. [engine/creation-v2/config/CreationMappings.ts](../engine/creation-v2/config/CreationMappings.ts)
   动作：
   - 保留映射常量。
   - 配合 material rules 使用，而不是让 analyzer 独占业务语义。

### 新增测试清单

1. `engine/creation-v2/tests/rules/material/MaterialRuleSet.test.ts`
2. `engine/creation-v2/tests/rules/material/MaterialConflictRules.test.ts`
3. `engine/creation-v2/tests/rules/recipe/RecipeValidationRuleSet.test.ts`
4. `engine/creation-v2/tests/rules/recipe/AffixUnlockRules.test.ts`

### 本阶段验收标准

1. recipe 决策的 valid / notes / matchedTags / unlockedAffixCategories / reservedEnergy 全部来自 `RecipeDecision`。
2. 材料冲突、manual 冲突、artifact-manual-only 等规则可以独立测试。
3. analyzer 不再承担完整 recipe 判定语义。

---

## 阶段 3：词缀候选与选择规则引擎化

### 目标

1. 把 affix 系统拆成“候选资格规则”和“选择约束规则”。
2. 把随机挑选策略与业务约束彻底分离。

### 新增文件

1. `engine/creation-v2/affixes/AffixPicker.ts`
   作用：只负责随机挑选策略。

2. `engine/creation-v2/rules/affix/AffixEligibilityRules.ts`
3. `engine/creation-v2/rules/affix/AffixWeightRules.ts`
4. `engine/creation-v2/rules/affix/ExclusiveGroupRules.ts`
5. `engine/creation-v2/rules/affix/BudgetExhaustionRules.ts`
6. `engine/creation-v2/rules/affix/FallbackAffixRules.ts`
7. `engine/creation-v2/rules/affix/AffixPoolRuleSet.ts`
8. `engine/creation-v2/rules/affix/AffixSelectionRuleSet.ts`

### 修改文件清单

1. [engine/creation-v2/affixes/AffixPoolBuilder.ts](../engine/creation-v2/affixes/AffixPoolBuilder.ts)
   动作：
   - 从“完整候选规则中心”退化为 facts builder + decision applier。
   - registry 查询结果交给 `AffixPoolRuleSet` 继续裁定。

2. [engine/creation-v2/affixes/AffixSelector.ts](../engine/creation-v2/affixes/AffixSelector.ts)
   动作：
   - 把 budget、exclusiveGroup、maxCount、rejectionReason 拆到 rules。
   - 把 weightedPick 保留或下沉到 `AffixPicker.ts`。

3. [engine/creation-v2/affixes/types.ts](../engine/creation-v2/affixes/types.ts)
   动作：
   - 对齐新的 `AffixPoolDecision`、`AffixSelectionDecision`。
   - 明确 rule outcome 与 picker outcome 的边界。

4. [engine/creation-v2/CreationOrchestrator.ts](../engine/creation-v2/CreationOrchestrator.ts)
   动作：
   - 调整 affix pool build / affix roll 默认流程。
   - 改为消费 `AffixPoolDecision` 和 `AffixSelectionDecision`。

5. [engine/creation-v2/budgeting/DefaultEnergyBudgeter.ts](../engine/creation-v2/budgeting/DefaultEnergyBudgeter.ts)
   动作：
   - 保持账本所有权。
   - 改为消费选择 decision，而不是直接绑定 selector 内部结构。

### 新增测试清单

1. `engine/creation-v2/tests/rules/affix/AffixPoolRuleSet.test.ts`
2. `engine/creation-v2/tests/rules/affix/AffixSelectionRuleSet.test.ts`
3. `engine/creation-v2/tests/rules/affix/ExclusiveGroupRules.test.ts`
4. `engine/creation-v2/tests/rules/affix/BudgetExhaustionRules.test.ts`
5. `engine/creation-v2/tests/rules/affix/FallbackAffixRules.test.ts`

### 本阶段验收标准

1. 为什么某个 affix 被纳入候选池、为什么被拒绝、为什么停止选择，都能从 decision 里解释出来。
2. 随机 picker 不再同时承担业务规则。
3. `exhaustionReason`、`rejections`、`allocations` 来自显式规则层。

---

## 阶段 4：Composition 规则与策略层收口

### 目标

1. 把 composer 内的命名、fallback、能量数值换算、默认 listener policy 等隐式规则抽到 composition rules。
2. 让 composer 变成 decision 投影器。

### 新增文件

1. `engine/creation-v2/config/CreationNamingPolicy.ts`
2. `engine/creation-v2/config/CreationFallbackPolicy.ts`
3. `engine/creation-v2/config/CreationRulePolicy.ts`
4. `engine/creation-v2/rules/composition/NamingRules.ts`
5. `engine/creation-v2/rules/composition/FallbackOutcomeRules.ts`
6. `engine/creation-v2/rules/composition/EnergyConversionRules.ts`
7. `engine/creation-v2/rules/composition/ProjectionRules.ts`
8. `engine/creation-v2/rules/composition/CompositionRuleSet.ts`

### 修改文件清单

1. [engine/creation-v2/composers/SkillBlueprintComposer.ts](../engine/creation-v2/composers/SkillBlueprintComposer.ts)
   动作：
   - 移出默认命名、默认伤害、mpCost/cooldown 业务策略。
   - 保留 skill product projection。

2. [engine/creation-v2/composers/ArtifactBlueprintComposer.ts](../engine/creation-v2/composers/ArtifactBlueprintComposer.ts)
   动作：
   - 移出默认名称、保底 shield、默认 listener policy。
   - 保留 artifact projection。

3. [engine/creation-v2/composers/GongFaBlueprintComposer.ts](../engine/creation-v2/composers/GongFaBlueprintComposer.ts)
   动作：
   - 移出保底 buff、功法命名、默认 listener policy。
   - 保留 gongfa projection。

4. [engine/creation-v2/composers/shared.ts](../engine/creation-v2/composers/shared.ts)
   动作：
   - 继续只保留真正共享的投影辅助逻辑。
   - 避免再次堆入业务规则。

5. [engine/creation-v2/models/AbilityProjection.ts](../engine/creation-v2/models/AbilityProjection.ts)
   动作：
   - 保持只做 model 到 abilityConfig 的纯投影。

### 新增测试清单

1. `engine/creation-v2/tests/rules/composition/NamingRules.test.ts`
2. `engine/creation-v2/tests/rules/composition/FallbackOutcomeRules.test.ts`
3. `engine/creation-v2/tests/rules/composition/EnergyConversionRules.test.ts`
4. `engine/creation-v2/tests/rules/composition/CompositionRuleSet.test.ts`

### 本阶段验收标准

1. composer 文件不再包含主要业务策略与阈值。
2. 新增或修改 fallback 时，不需要直接改 composer 主流程。
3. 数值换算规则进入统一 policy + rules 层。

---

## 阶段 5：Orchestrator 与工作流语义收口

### 目标

1. 让 orchestrator 只做阶段推进和 decision 应用。
2. 为将来的 workflow variant 留出插拔位。
3. 让 handler / phase action 组合更加显式。

### 新增文件

1. `engine/creation-v2/handlers/PhaseActionRegistry.ts`
2. `engine/creation-v2/handlers/WorkflowVariantPolicy.ts`

如果阶段复杂度仍上升，可考虑：

3. `engine/creation-v2/services/CreationWorkflowService.ts`

### 修改文件清单

1. [engine/creation-v2/CreationOrchestrator.ts](../engine/creation-v2/CreationOrchestrator.ts)
   动作：
   - 移除散落的默认业务判断。
   - 改为事实构建 -> 规则执行 -> decision 应用三段式。

2. [engine/creation-v2/handlers/CreationPhaseHandlers.ts](../engine/creation-v2/handlers/CreationPhaseHandlers.ts)
   动作：
   - 为 phase action 替换和 workflow variant 预留更明确的注入点。

3. [engine/creation-v2/core/events.ts](../engine/creation-v2/core/events.ts)
   动作：
   - 视需要扩展 decision audit 或 diagnostics 事件，但不要让事件类型失控。

4. [engine/creation-v2/persistence/OutcomeSnapshot.ts](../engine/creation-v2/persistence/OutcomeSnapshot.ts)
   动作：
   - 评估是否需要保存 decision trace 或最小 rule audit 信息。

### 新增测试清单

1. `engine/creation-v2/tests/contracts/WorkflowDecisionBoundary.test.ts`
2. `engine/creation-v2/tests/contracts/BattleContractBoundary.test.ts`
3. `engine/creation-v2/tests/integration/CreationWorkflowVariants.test.ts`

### 本阶段验收标准

1. orchestrator 不再直接持有主要规则判断。
2. phase handlers 可以替换 action，而不是只能调用固定默认实现。
3. workflow sync / async / autoMaterialize false 路径都能稳定通过。

---

## 横向专项清单

以下工作会跨多个阶段，建议单独持续跟踪。

### A. Battle 契约边界

涉及文件：

1. [engine/creation-v2/contracts/battle.ts](../engine/creation-v2/contracts/battle.ts)
2. [engine/creation-v2/contracts/battle-testkit.ts](../engine/creation-v2/contracts/battle-testkit.ts)
3. [engine/creation-v2/adapters/BattleAbilityBuilder.ts](../engine/creation-v2/adapters/BattleAbilityBuilder.ts)
4. [engine/creation-v2/adapters/CreationAbilityAdapter.ts](../engine/creation-v2/adapters/CreationAbilityAdapter.ts)
5. [engine/creation-v2/tests/contracts/PublicApiExports.test.ts](../engine/creation-v2/tests/contracts/PublicApiExports.test.ts)

专项目标：

1. 主合同只保留运行时必要 battle 类型。
2. 测试用 battle 运行时对象只走 testkit。
3. battle-v5 具体构建逻辑持续下沉到 adapter。

### B. 标签与映射真相源

涉及文件：

1. [engine/creation-v2/core/GameplayTags.ts](../engine/creation-v2/core/GameplayTags.ts)
2. [engine/creation-v2/config/CreationMappings.ts](../engine/creation-v2/config/CreationMappings.ts)
3. [engine/creation-v2/analysis/MaterialTagNormalizer.ts](../engine/creation-v2/analysis/MaterialTagNormalizer.ts)
4. affix definitions 全部文件

专项目标：

1. tag path、element mapping、recipe bias 不再重复定义。
2. 新规则只从统一配置/常量派生标签，不再写裸字符串。

### C. 可解释性与 diagnostics

涉及文件：

1. `rules/core/RuleDiagnostics.ts`
2. `rules/contracts/*Decision.ts`
3. [engine/creation-v2/CreationOrchestrator.ts](../engine/creation-v2/CreationOrchestrator.ts)
4. [engine/creation-v2/core/events.ts](../engine/creation-v2/core/events.ts)

专项目标：

1. 每个 decision 都有 reasons / warnings / trace。
2. affix rejection 与 recipe failure 可明确解释。
3. 后续可接 UI 调试或日志输出。

---

## 建议测试策略

### 1. Rule Unit Tests

每一条规则都应能独立测试，例如：

1. 火冰混炉冲突。
2. 手册混用冲突。
3. affix minQuality 过滤。
4. exclusiveGroup 冲突。
5. budget_exhausted 停机原因。

### 2. RuleSet Contract Tests

验证多条规则组合后是否输出稳定 decision。

### 3. Projection Tests

验证 decision 到 blueprint / productModel / abilityConfig 的映射稳定。

### 4. Workflow Integration Tests

保留现有 orchestrator 集成测试，但将断言重点从“跑通”转向“decision 应用正确”。

---

## 推荐实施顺序

如果只考虑性价比，建议按下面顺序推进：

1. 阶段 1：规则骨架。
2. 阶段 2：材料与配方规则。
3. 阶段 3：词缀候选与选择规则。
4. 阶段 4：composition 规则与策略层。
5. 阶段 5：orchestrator 收口与 workflow 语义抽象。

不建议跳过阶段 1 直接做 affix 规则，因为没有统一 contracts / diagnostics，后面容易返工。

---

## 建议排期

### 参考排期

1. 阶段 1：2 到 3 天
2. 阶段 2：3 到 4 天
3. 阶段 3：4 到 6 天
4. 阶段 4：3 到 5 天
5. 阶段 5：3 到 4 天

总计建议预估：约 3 周。

前提：

1. 不同时引入大规模数值再平衡。
2. 不同时引入可复现 RNG / clock 注入专项。
3. 不同时把 snapshot 持久化升级为完整基础设施接入。

---

## 里程碑验收建议

### M1: Rule Core Ready

标志：

1. rules/core 和 rules/contracts 完成。
2. 不改变现有行为。

### M2: Recipe Decision Ready

标志：

1. recipe 判定完全来自 `RecipeDecision`。
2. 材料冲突与 recipe invalid 可独立解释。

### M3: Affix Decision Ready

标志：

1. affix pool 与 affix selection 完全可解释。
2. picker 与 rule 分离。

### M4: Composition Decision Ready

标志：

1. composer 基本退化为投影器。
2. fallback 和 naming 进入 policy + rules 层。

### M5: Workflow Ready

标志：

1. orchestrator 不再是业务规则中心。
2. workflow variant 已具备设计扩展位。

---

## 执行建议

1. 每完成一个阶段，就先补该阶段的 rule tests 和 contract tests，再推进下一阶段。
2. 每次迁移都优先保持现有行为一致，不先混入新功能需求。
3. 所有新规则都要求附带明确 diagnostics，避免再次回到“逻辑存在但不可解释”的状态。
4. 每个阶段结束后，更新 [docs/creation-v2.md](./creation-v2.md) 的当前状态摘要，避免评审文档与代码脱节。
