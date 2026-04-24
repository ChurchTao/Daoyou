# 神通目标策略约束系统 (Skill Target Policy Constraint) 设计文档

**状态**: 已完成 (Completed)  
**作者**: Gemini CLI  
**日期**: 2026-04-24  

## 1. 背景与动机 (Background)
在当前的万界道友造物系统（creation-v2）中，神通（Skill）的最终战斗策略（`targetPolicy`）是根据核心词缀的效果类型硬编码推断的。这种设计存在两个主要弊端：
1. **玩家无法自主选择范围**：例如，玩家无法明确制造一个 AOE 治疗或 AOE 伤害技能。
2. **词缀混搭不和谐**：攻击性的变体词缀（如灼烧）可能会出现在玩家意图为治疗的技能中，反之亦然。

为了解决这些问题，我们需要引入类似法宝槽位（Slot）的约束机制，让词缀能够声明自己“适用于何种目标策略”。

## 2. 核心方案 (Core Design)

### 2.1 直接复用战斗引擎类型
直接复用 `@engine/battle-v5/abilities/TargetPolicy.ts` 中的 `TargetPolicyConfig` 及其关联类型（`TargetTeam`, `TargetScope` 等），确保造物层与战斗层的语义完全统一。

### 2.2 词缀定义增强
在 `AffixDefinition` 中增加 `targetPolicyConstraint` 字段，作为词缀入池的硬约束。

```typescript
/** engine/creation-v2/affixes/types.ts **/
export interface AffixDefinition {
  // ...
  targetPolicyConstraint?: Partial<TargetPolicyConfig>;
}
```

### 2.3 意图引导的过滤
玩家通过 `CreationSessionInput` 传入期望的目标策略。造物流程将其固化为意图偏好 `targetPolicyBias`。

1. **Input**: `requestedTargetPolicy?: TargetPolicyConfig`
2. **Intent**: `targetPolicyBias?: TargetPolicyConfig`
3. **Filtering**: 在 `AffixPoolBuilder` 中，如果词缀声明了约束，而当前意图不满足该约束，则该词缀禁止入池。

### 2.4 投影策略决策
在 `ProjectionRules` 中，最终技能的 `targetPolicy` 决策逻辑按以下优先级：
1. **玩家显式意图** (`intent.targetPolicyBias`)
2. **核心词缀推断** (例如 `heal` 类型推断为 `self/single`)
3. **系统默认** (`enemy/single`)

## 3. 修改细节 (Modifications)

### 3.1 类型与接口 (Types & Interfaces)
- **`engine/creation-v2/affixes/types.ts`**:
    - 导入 `TargetPolicyConfig`。
    - 更新 `AffixDefinition` 接口。
- **`engine/creation-v2/types.ts`**:
    - 导入 `TargetPolicyConfig`。
    - 更新 `CreationSessionInput` 和 `CreationIntent` 接口。

### 3.2 逻辑层 (Logics)
- **`engine/creation-v2/resolvers/DefaultIntentResolver.ts`**:
    - 在 `resolve` 方法中处理 `requestedTargetPolicy` 的转换。
- **`engine/creation-v2/affixes/AffixPoolBuilder.ts`**:
    - **重构 `filterCandidatesForProductContext` 方法**：
        - **解除类别限制**：移除针对 `core` 类别的 `if` 早回逻辑，使环境过滤对所有词缀类别（变体、稀有、面板等）生效。
        - **法宝全量过滤**：所有法宝词缀若定义了 `applicableArtifactSlots`，必须与当前 `slotBias` 兼容。
        - **神通全量过滤**：所有神通词缀若定义了 `targetPolicyConstraint`，必须与当前玩家意图 `targetPolicyBias` 兼容。
        - **保留核心校验**：仅针对 `skill_core`, `gongfa_foundation`, `artifact_core` 类别继续执行原有的 `isSkillCoreCandidate` 等特定逻辑。
- **`engine/creation-v2/rules/composition/ProjectionRules.ts`**:
    - 更新 `buildSkillPolicy` 方法中的 `targetPolicy` 生成逻辑。

### 3.3 数据层 (Definitions)
- **`engine/creation-v2/affixes/definitions/skillAffixes.ts`**:
    - 为所有核心词缀（`skill_core`）和具有明确目标倾向的变体词缀（`skill_variant`）添加 `targetPolicyConstraint`。

## 4. 测试用例 (Test Cases)

### 4.1 场景：显式指定 AOE 治疗
- **输入**:
    - `productType: 'skill'`
    - `requestedTargetPolicy: { team: 'self', scope: 'aoe' }`
- **预期**:
    - 池中包含：`skill-core-heal`。
    - 池中**不包含**：`skill-core-damage`（因约束为 `enemy`）。
    - 最终蓝图：`targetPolicy` 为 `{ team: 'self', scope: 'aoe' }`。

### 4.2 场景：默认兼容性
- **输入**: 无 `requestedTargetPolicy`。
- **预期**:
    - 行为与当前版本一致。
    - 如果选到 `skill-core-damage`，推断为 `enemy/single`。

## 5. 扩展思考
未来可以进一步通过材料语义推断目标策略。例如，加入“范围”关键词的材料可以自动推断 `scope: 'aoe'` 的 Bias。
