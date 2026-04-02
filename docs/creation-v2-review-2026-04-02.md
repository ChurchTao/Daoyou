# creation-v2 全面 Review 报告

**日期**: 2026-04-02  
**Review 范围**: `engine/creation-v2/` 全目录  
**测试运行结果**: 29 个测试套件 / 149 个用例全部通过  
**TypeScript 编译检查**: 发现 4 个 creation-v2 编译错误（含测试文件）

---

## 一、整体完成度评估

### 蓝图对照表（`docs/creation-v2-refactor-blueprint.md` 5 阶段规划）

| 阶段 | 规划目标 | 完成状态 | 备注 |
|------|----------|----------|------|
| Stage 0 | 基线冻结、清理遗留入口 | ✅ 完成 | DefaultBlueprintComposer 已从 public API 移除 |
| Stage 1 | rules/core、rules/contracts 骨架 | ✅ 完成 | Rule/RuleSet/RuleDiagnostics/RuleContext/全部 Decision+Facts 合约 |
| Stage 2 | 材料与配方规则迁移 | ⚠️ 部分完成 | MaterialConflictRules ✅；MaterialTypeRules / MaterialSemanticRules / RecipeBiasRules ❌ 未落地 |
| Stage 3 | 词缀候选与选择规则引擎化 | ✅ 完成 | AffixPicker / AffixPoolRuleSet / AffixSelectionRuleSet 全部就绪 |
| Stage 4 | Composition 规则与策略层收口 | ✅ 完成 | 5 条 composition rules + CompositionRuleSet，composer 退化为投影器 |
| Stage 5 | Orchestrator 与工作流语义收口 | ⚠️ 部分完成 | PhaseActionRegistry / WorkflowVariantPolicy ✅；clearSession / craftSync / craftAsync ❌ 未实现 |

---

## 二、已确认 Bug（tsc 编译错误）

### BUG-1：`CreationOrchestrator.ts:106` — sessionId 类型收窄缺失

**文件**: [engine/creation-v2/CreationOrchestrator.ts](../engine/creation-v2/CreationOrchestrator.ts#L106)  
**错误**: `TS2345: Argument of type 'string | undefined' is not assignable to parameter of type 'string'`

```typescript
// input.sessionId?: string（可能 undefined）
if (this.sessions.has(input.sessionId)) {  // ← 编译错误
```

**影响**: 
- 当 `sessionId` 未提供时（`CreationSessionInput.sessionId` 是可选字段），`Map.has(undefined)` 结果恒为 `false`，导致重复 session 防重逻辑失效
- TypeScript strict 模式下必须修复

**修复方案**:
```typescript
createSession(input: CreationSessionInput): CreationSession {
  const sessionId = input.sessionId;
  if (sessionId && this.sessions.has(sessionId)) {
    throw new Error(
      `CreationOrchestrator: sessionId '${sessionId}' is already in use. ...`
    );
  }
  ...
}
```

---

### BUG-2：`NamingRules.ts:57` — `diagnostics` 超出作用域 + 无效 trace outcome

**文件**: [engine/creation-v2/rules/composition/NamingRules.ts](../engine/creation-v2/rules/composition/NamingRules.ts#L57)  
**错误**: `TS2304: Cannot find name 'diagnostics'`

```typescript
// apply() 中的 diagnostics 参数未传递给 resolveName()
private resolveName(facts: CompositionFacts): string {
  ...
  case 'gongfa': {
    if (!materialNames[0]) {
      diagnostics.addTrace({          // ← 运行时 ReferenceError
        outcome: 'fallback',           // ← 'fallback' 不是合法 RuleTraceOutcome
        ...
      });
    }
  }
}
```

**影响**:
- 当 `productType === 'gongfa'` 且 `materialNames[0]` 为空时，**运行时抛出 ReferenceError**
- 即使修复 `diagnostics` 引用，`'fallback'` 也不是合法的 `RuleTraceOutcome`（合法值：`'applied' | 'skipped' | 'blocked'`）
- 当前测试套件未覆盖 `materialNames[0]` 为空的路径，故未触发

**修复方案**:
```typescript
// apply() 中需将 diagnostics 传递给 resolveName
apply({ facts, decision, diagnostics }: RuleContext<...>): void {
  decision.name = this.resolveName(facts, diagnostics);
  ...
}

private resolveName(
  facts: CompositionFacts,
  diagnostics: RuleDiagnostics,
): string {
  ...
  case 'gongfa': {
    if (!materialNames[0]) {
      diagnostics.addTrace({
        ruleId: this.id,
        outcome: 'applied',   // ← 修为合法值
        message: `功法命名：materialNames[0] 为空，fallback 到默认名称`,
      });
      return CREATION_GONGFA_NAMING.defaultName;
    }
  }
}
```

---

## 三、测试文件中的编译错误（tsc 检出，运行时未报错）

ts-jest 在部分配置下不执行严格类型检查，以下错误在测试运行时被忽略，但在 `tsc --noEmit` 时暴露：

| 文件 | 行号 | 错误 | 问题说明 |
|------|------|------|----------|
| [tests/adapters/CreationAbilityAdapter.test.ts](../engine/creation-v2/tests/adapters/CreationAbilityAdapter.test.ts#L66) | 66 | `'name' does not exist in type 'CreationBlueprint'` | 测试中断言了旧版 Blueprint 的 `name` 字段，重构后已移入 `productModel.name` |
| [tests/CreationOrchestrator.test.ts](../engine/creation-v2/tests/CreationOrchestrator.test.ts#L262) | 262 | `'equipPolicy' does not exist in type 'ArtifactProductModel'` | 测试中使用了旧字段路径，实际字段在 `artifactConfig.equipPolicy` |
| [tests/CreationOrchestrator.test.ts](../engine/creation-v2/tests/CreationOrchestrator.test.ts#L583) | 583 | `'name' does not exist in type 'CreationBlueprint'` | 同上，出现两处 |
| [tests/helpers/fingerprintFactory.ts](../engine/creation-v2/tests/helpers/fingerprintFactory.ts#L3) | 3 | `Cannot find module '../../analysis/types'` | 导入了已删除的模块路径，该文件已成为孤立死代码 |

**说明**: `tests/helpers/fingerprintFactory.ts` 可能是重构过程中已废弃但未清理的文件，需确认是否有测试依赖它，若无则直接删除。

---

## 四、架构差距（Blueprint 规划但未实现）

### GAP-1：`rules/material/` 规则层不完整

**现状**: 只有 `MaterialConflictRules.ts` + `MaterialRuleSet.ts`  
**缺失**:
- `MaterialTypeRules.ts` — 材料类型 → explicit tag 的规则提取，当前硬编码在 `MaterialTagNormalizer.normalizeExplicitTags()`
- `MaterialSemanticRules.ts` — 材料名称语义 → semantic tag 的规则提取，当前硬编码在 `MaterialTagNormalizer.normalizeSemanticTags()`（正则数组）
- `RecipeBiasRules.ts` — 材料类型 → recipe bias tag 的规则映射，当前硬编码在 `MaterialTagNormalizer.normalizeRecipeTags()`（switch-case）

**影响**: 
- 材料分类和 recipe bias 决策无 RuleTrace，调试时不可解释
- 上述逻辑未对 `MaterialDecision` 贡献 reasons/warnings/trace
- `MaterialRuleSet` 只有一条规则（冲突检测），远不足以承载完整"事实提取"语义

**参考文件**:
- [engine/creation-v2/analysis/MaterialTagNormalizer.ts](../engine/creation-v2/analysis/MaterialTagNormalizer.ts) ← 有待迁移的三个方法
- [engine/creation-v2/rules/material/MaterialRuleSet.ts](../engine/creation-v2/rules/material/MaterialRuleSet.ts) ← 需注入上述规则

---

### GAP-2：`clearSession()` 不存在

**现状**: `createSession()` 的错误信息引用了 `clearSession()`，但该方法未实现

```typescript
// CreationOrchestrator.ts:109
`Provide a unique sessionId or call clearSession() first.`
// ^ clearSession() does not exist
```

**影响**:
- 错误信息误导调用方
- Session 生命周期缺少清理入口，`orchestrator.sessions` Map 在长期运行中会积累
- 多次同 ID 造物时无法复用 orchestrator 实例

---

### GAP-3：高阶 API `craftSync()` / `craftAsync()` 不存在

**现状**: 多个方法被标注 `@internal 供测试和工作流内部调用，生产调用方请改用 craftSync/Async 等高阶入口`，但这两个方法从未实现

**影响**:
- 外部调用方（如 `lib/services/`）必须直接调用底层 `@internal` 步骤方法
- 没有简洁的单一入口封装，与上游服务集成时容易误用
- `@internal` 标注无约束力，实际成为了事实上的 public API

---

### GAP-4：`DefaultIntentResolver` slot 偏向逻辑未进入规则层

**文件**: [engine/creation-v2/resolvers/DefaultIntentResolver.ts#L54](../engine/creation-v2/resolvers/DefaultIntentResolver.ts#L54)  
**现状**: `inferSlotBias()` 使用关键词正则 + 默认回退 `'weapon'`，且有两处 TODO 注释标注为待迁移  
**两条 TODO**:
- `P1-4`: `inferSlotBias()` 整体应迁入 rules 层为 `SlotBiasRule`
- `P1-1`: 默认 fall-through 到 `'weapon'` 的决策应产出 RuleTrace

**影响**: slot 推断结果（influence artifact 命名和投影）无法被解释或覆盖

---

## 五、设计问题

### DESIGN-1：`CreationAbilityAdapter` 重复调用 `projectAbilityConfig`

**文件**: [engine/creation-v2/adapters/CreationAbilityAdapter.ts](../engine/creation-v2/adapters/CreationAbilityAdapter.ts#L20)

Composer 已在构建 blueprint 时调用过 `projectAbilityConfig` 并填充 `blueprint.abilityConfig`。`materialize()` 再次调用 `projectAbilityConfig(blueprint.productModel)` 是重复投影：

```typescript
materialize(_productType, blueprint): CraftedOutcome {
  const abilityConfig = projectAbilityConfig(blueprint.productModel); // ← 重复投影
  this.assertBlueprintShape(blueprint, abilityConfig.type);
  const ability = this.abilityBuilder.build(abilityConfig);           // ← 使用重新投影结果
  // blueprint.abilityConfig 被完全忽略
}
```

**影响**: 
- `blueprint.abilityConfig` 实际上没有被使用，其语义定义变得模糊
- 如果 blueprint 被外部修改/patch，adapter 的重新投影会静默覆盖修改
- `CreationBlueprint` 上的 `abilityConfig` 字段存在冗余，可以考虑移除或明确其契约

---

### DESIGN-2：`buildGroupedListeners` 分组 key 包含 priority

**文件**: [engine/creation-v2/composers/shared.ts](../engine/creation-v2/composers/shared.ts#L40)

```typescript
const key = `${spec.eventType}||${spec.scope}||${spec.priority}`;
```

两个词缀若监听相同事件（eventType + scope 相同）但 priority 不同，会产生**两个独立 listener**，每个只包含一个 effect。而两个词缀若 priority 也相同，则会合并到同一 listener。这导致 priority 既是分组依据又是合并阈值，语义混淆。

**影响**: 若游戏设计要求"同类型 listener 合并后统一竞争优先级"，当前合并粒度过细；若设计允许多优先级，则 key 设计正确但 `priority` 与 `scope` 的选择合理性需明确文档化。

---

### DESIGN-3：`ProductSupportRules` 标记 `valid = false` 后后续规则仍执行

**文件**: [engine/creation-v2/rules/recipe/RecipeValidationRuleSet.ts](../engine/creation-v2/rules/recipe/RecipeValidationRuleSet.ts)

执行顺序：`ProductSupportRules → AffixUnlockRules → ReservedEnergyRules`

当 `ProductSupportRules` 将 `decision.valid = false` 后，`AffixUnlockRules` 和 `ReservedEnergyRules` 继续执行并填充结果（unlock 分类、reservedEnergy），test 中明确验证了此行为：

```
it('应在材料不支持目标产物时返回 invalid 但保留阈值结果', ...)
```

**问题**: 这是有意的设计（即使 recipe 无效，调用方也能看到"假如成功会应用什么能量值"），但没有文档说明其意图。若未来规则评审者/新增规则不了解此设计，可能误判为 bug 并引入短路逻辑。

**建议**: 在 `RecipeValidationRuleSet` 或各规则上添加注释说明"intentional: run all rules even when valid=false"。

---

### DESIGN-4：`AffixPicker.pick()` 对空池无防护

**文件**: [engine/creation-v2/affixes/AffixPicker.ts](../engine/creation-v2/affixes/AffixPicker.ts)

```typescript
const fallback = pool[pool.length - 1]; // pool 为空时：pool[-1] = undefined
return { candidate: fallback, ... };     // candidate: undefined → 下游解构 crash
```

当前 `AffixSelector` 在调用 `picker.pick()` 前会检查 `decision.candidatePool.length > 0`，因此这个路径尚未触发。但 `AffixPicker` 作为独立组件，不应依赖调用方保证非空。

---

### DESIGN-5：`MaterialTagNormalizer.SEMANTIC_PATTERNS` 与 `SemanticTagAllowlist.SEMANTIC_TAG_ALIAS_MAP` 双真相源

**文件对比**:
- [engine/creation-v2/analysis/MaterialTagNormalizer.ts](../engine/creation-v2/analysis/MaterialTagNormalizer.ts#L25) — 使用正则匹配汉字和关键词
- [engine/creation-v2/analysis/SemanticTagAllowlist.ts](../engine/creation-v2/analysis/SemanticTagAllowlist.ts) — 使用别名字符串映射（含英文/拼音/汉字）

两个文件都映射相同的 10 个语义标签，但机制不同：
- `MaterialTagNormalizer` 处理离线材料数据（name + description）
- `SemanticTagAllowlist` 处理来自 LLM 的标签结果（`AsyncMaterialAnalyzer`）

这种设计分工是合理的，但两个文件覆盖的语义边界（哪些汉字被识别为哪个 tag）**没有共用常量，可能不一致**。例如 `MaterialTagNormalizer` 识别 `魂|魄|灵` 为 `SEMANTIC_SPIRIT`，而 `SemanticTagAllowlist` 只有 `'灵'` 作为显式 alias。

---

## 六、硬编码与配置化问题

### HARD-1：`CreationBalance.ts` 数值缺少推导说明

以下数值已正确提取到配置，但缺乏推导依据的注释：

```typescript
export const CREATION_PROJECTION_BALANCE = {
  skillPriorityBase: 10,       // ← 为何是 10？与战斗引擎 priority 体系的关系？
  mpCostDivisor: 3,            // ← 为何是 3？
  artifactShieldBaseDivisor: 1.5, // ← 为何是 1.5？
  defaultMaxAffixCount: 4,     // ← 设计上限是多少？
} as const;
```

**影响**: 数值平衡调整无据可查，未来调参时容易引入不一致。

---

### HARD-2：`MaterialConflictRules` 本地常量未复用 GameplayTags

**文件**: [engine/creation-v2/rules/material/MaterialConflictRules.ts](../engine/creation-v2/rules/material/MaterialConflictRules.ts#L1)

```typescript
const MANUAL_MATERIAL_TYPES = {
  SKILL: 'skill_manual',
  GONGFA: 'gongfa_manual',
  LEGACY: 'manual',
} as const;
```

这些字符串字面量与 `Material['type']` 类型在 `@/types/cultivator` 中一致，但并非直接复用类型，而是重新定义字符串常量。若 `Material.type` 枚举值变更，此处不会报编译错误。

---

### HARD-3：`AffixEffectTranslator` 本地 `ATTR_BUFF_NAMES` 映射

**文件**: [engine/creation-v2/affixes/AffixEffectTranslator.ts](../engine/creation-v2/affixes/AffixEffectTranslator.ts#L17)

`ATTR_BUFF_NAMES` 使用 `Partial<Record<AttributeType, string>>`，缺失条目 fallback 为 `${attrType}强化`。此映射可以迁入 `CreationNamingPolicy.ts` 或 `CreationMappings.ts` 以便统一管理。

---

## 七、测试覆盖空白

| 模块 | 状态 | 备注 |
|------|------|------|
| `rules/affix/AffixEligibilityRules` | ⚠️ 无独立测试 | 仅通过 AffixPoolRuleSet.test 间接覆盖 |
| `rules/affix/AffixWeightRules` | ⚠️ 无独立测试 | 同上 |
| `rules/recipe/ProductSupportRules` | ⚠️ 无独立测试 | 仅通过 RecipeValidationRuleSet.test 覆盖 |
| `rules/recipe/ReservedEnergyRules` | ⚠️ 无独立测试 | 同上 |
| `persistence/OutcomeSnapshot` | ❌ 无测试 | 包含非平凡逻辑 (`restoreCraftedOutcome`、`assertSnapshotShape`) |
| `resolvers/DefaultIntentResolver` | ⚠️ 无独立测试 | slot 推断逻辑、element bias 逻辑仅通过集成测试间接触达 |
| `affixes/AffixPicker` | ⚠️ 无独立测试 | 随机策略逻辑无 coverage（仅通过 AffixSystem.test 覆盖路径） |
| `gongfa materialNames[0] 为空路径` | ❌ 未覆盖 | 与 BUG-2 直接相关 |

---

## 八、命名 & API 可见性问题

### NAME-1：大量 `@internal` 公开方法

`CreationOrchestrator` 中有 9 个以上方法标注了 `@internal`，但其访问修饰符为 `public`：

```typescript
/** @internal 供测试和工作流内部调用，生产调用方请改用 craftSync/Async */
analyzeMaterialsWithDefaults(session: CreationSession): MaterialFingerprint[]
```

这些方法被直接用于测试（如 `CreationOrchestrator.test.ts`），形成了**实际上的公开 API 表面**。结合 `craftSync/craftAsync` 不存在，`@internal` 已名存实亡。

**建议策略**:
1. 实装 `craftSync()` / `craftAsync()` 高阶方法
2. 将 `*WithDefaults` 方法标注为可测试的 `protected`，测试通过子类访问
3. 或者接受当前现状，移除 `@internal` 标注以免误导

---

### NAME-2：`RecipeMatch.notes` 与 `Decision.reasons` 语义重叠

`RecipeMatch.notes: string[]` 和 `RecipeDecision.reasons: RuleReason[]` 在表达"为何配方无效"这一语义时存在重叠。`DefaultRecipeValidator.toRecipeMatch()` 将 `decision.notes` 传递给 `recipeMatch.notes`，而 `decision.reasons` 中包含更结构化的信息但未传递。

**建议**: 明确 `notes` 的定位（用户可读提示）与 `reasons` 的定位（系统结构化原因），避免未来两者出现分歧。

---

## 九、冗余与清理项

| 文件/代码 | 状态 | 建议 |
|-----------|------|------|
| `tests/helpers/fingerprintFactory.ts` | 导入已删除模块，编译失败 | 确认无用途则删除 |
| `blueprint.abilityConfig` | Composer 和 Adapter 分别独立投影，双填充场景下 `abilityConfig` 含义模糊 | 评估是否应该只从 `productModel` 派生、不主动写入 blueprint |
| `CreationPhase.INIT` | `CreationSession` 初始 phase，但 `CreationPhaseHandlerRegistry` 中无对应 handler | 确认是否需要 INIT 阶段的 handler 或统一 sentinel 语义 |

---

## 十、优先级排序修复计划

### P0 — 必须修复（影响正确性）

| ID | 问题 | 文件 | 工作量 |
|----|------|------|--------|
| BUG-1 | `input.sessionId` 类型收窄缺失 | `CreationOrchestrator.ts:106` | S（5min） |
| BUG-2 | `diagnostics` 超出作用域 + 无效 outcome | `NamingRules.ts:57` | S（15min） |
| TEST-4 | `fingerprintFactory.ts` 导入不存在模块 | `tests/helpers/fingerprintFactory.ts:3` | S（删除或修复） |

### P1 — 近期修复（影响架构质量）

| ID | 问题 | 文件 | 工作量 |
|----|------|------|--------|
| GAP-2 | `clearSession()` 未实装 | `CreationOrchestrator.ts` | S |
| GAP-3 | `craftSync/craftAsync` 高阶入口未实装 | `CreationOrchestrator.ts` | M |
| TEST-1~3 | 测试文件中 3 处 tsc 错误（旧类型断言） | `CreationOrchestrator.test.ts`, `CreationAbilityAdapter.test.ts` | S |
| DESIGN-1 | `CreationAbilityAdapter` 双重投影 | `adapters/CreationAbilityAdapter.ts` | S |
| DESIGN-4 | `AffixPicker.pick()` 空池防护 | `affixes/AffixPicker.ts` | S |
| COVERAGE-5 | `OutcomeSnapshot` 无测试 | `persistence/OutcomeSnapshot.ts` | M |

### P2 — 中期演进（影响可解释性与可维护性）

| ID | 问题 | 文件 | 工作量 |
|----|------|------|--------|
| GAP-1 | Stage 2 材料分类规则未落地（MaterialTypeRules / MaterialSemanticRules / RecipeBiasRules） | `rules/material/` | L |
| GAP-4 | `inferSlotBias` 未迁入 rules 层（TODO P1-1, P1-4） | `resolvers/DefaultIntentResolver.ts` | M |
| DESIGN-2 | `buildGroupedListeners` 分组 key 语义明确化 | `composers/shared.ts` | S |
| DESIGN-3 | `RecipeValidationRuleSet` 部分执行意图文档化 | `rules/recipe/RecipeValidationRuleSet.ts` | S |
| DESIGN-5 | 语义标签双真相源统一 | `analysis/MaterialTagNormalizer.ts` + `SemanticTagAllowlist.ts` | M |
| HARD-1 | `CreationBalance.ts` 数值推导注释 | `config/CreationBalance.ts` | S |
| HARD-2 | `MaterialConflictRules` 本地字符串常量 type 安全 | `rules/material/MaterialConflictRules.ts` | S |
| COVERAGE-1~4 | 缺失单元测试（4 条规则） | `tests/rules/` | M |
| NAME-1 | `@internal` 公开方法 vs 高阶 API 缺失冲突 | `CreationOrchestrator.ts` | M |

### P3 — 长期优化（性能与可扩展性）

| ID | 问题 | 说明 |
|----|------|------|
| PERF-1 | `AffixRegistry.queryById` O(n) 线性扫描 | 当前规模可接受，超过 100 个词缀定义时应改为 Map |
| HARD-3 | `ATTR_BUFF_NAMES` 迁入统一命名策略 | Config 化，与 NamingPolicy 对齐 |

---

## 十一、已正确完成的亮点（不需修改）

以下部分实现质量较高，可作为后续扩展的参考基准：

1. **Rule / RuleSet / RuleDiagnostics 核心**：接口设计简洁，决策与诊断分离，可扩展
2. **CompositionRuleSet 执行顺序**：OutcomeTagRules → NamingRules → EnergyConversionRules → ProjectionRules → FallbackOutcomeRules，依赖链单向，注释清晰
3. **WorkflowVariantPolicy**：将策略判断从 handler 中解耦，扩展 workflow variant 只需新建 policy 对象
4. **PhaseActionRegistry.override()**：为 workflow variant 提供了正确的插拔机制
5. **AffixSelector / AffixPicker 分离**：业务约束在 RuleSet，随机策略在 Picker，职责清晰
6. **SlugService**：统一 slug 生成，消除了旧版的前缀不一致问题
7. **config/ 目录**：Balance / Mappings / NamingPolicy / FallbackPolicy / RulePolicy / SlugConfig / EventPriorities 分类合理，无业务逻辑混入
8. **contracts/battle.ts + battle-testkit.ts**：合理隔离运行时依赖与测试依赖
9. **persistence/OutcomeSnapshot.ts**：接口定义和序列化/反序列化结构清晰（仅缺测试）

---

## 附：编译错误完整列表（tsc --noEmit，仅 creation-v2）

```
engine/creation-v2/CreationOrchestrator.ts(106,27): error TS2345
  Argument of type 'string | undefined' is not assignable to parameter of type 'string'.

engine/creation-v2/rules/composition/NamingRules.ts(57,11): error TS2304
  Cannot find name 'diagnostics'.

engine/creation-v2/tests/adapters/CreationAbilityAdapter.test.ts(66,5): error TS2353
  Object literal may only specify known properties, and 'name' does not exist in type 'CreationBlueprint'.

engine/creation-v2/tests/CreationOrchestrator.test.ts(262,9): error TS2353
  Object literal may only specify known properties, and 'equipPolicy' does not exist in type 'ArtifactProductModel'.

engine/creation-v2/tests/CreationOrchestrator.test.ts(583,7): error TS2353
  Object literal may only specify known properties, and 'name' does not exist in type 'CreationBlueprint'.

engine/creation-v2/tests/helpers/fingerprintFactory.ts(3,35): error TS2307
  Cannot find module '../../analysis/types' or its corresponding type declarations.
```

> 注意：battle-v5 中也存在 6 处 tsc 错误（`LogPresenter.test.ts` 中），与 creation-v2 无关，此处不计入。
