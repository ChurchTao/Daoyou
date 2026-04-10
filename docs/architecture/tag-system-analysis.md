# 标签系统架构分析与优化建议 (Tag System Architecture Analysis)

## 1. 现状审计 (Current State Audit)

经过对 `engine/creation-v2` 与 `engine/battle-v5` 的深度分析，当前标签系统呈现出**“从自发增长向规范化转型”**的过渡特征，存在以下核心问题：

### 1.1 核心病灶：推断式逻辑 (Inference-based Logic)
在 `AbilityTagAssembler.ts` 中，系统通过 `summarizeCapabilities` 函数解析效果配置（EffectConfig）来“反向推断”功能标签（如 `Ability.Function.Damage`）。
*   **架构风险：** 标签本应是机制的“元数据”，现在的做法却是根据“后果”推导“身份”。这导致战斗引擎无法在不解析复杂效果的情况下预知能力类型，且推断逻辑极易在新增复杂效果时失效。

### 1.2 语义断层 (Semantic Disconnect)
造物侧的“意图标签”（CreationTags）与战斗侧的“机制标签”（GameplayTags）之间缺乏透明的投影契约。
*   **表现：** 依赖 `projectAbilityRuntimeSemantics` 等中间转换函数，且存在 `inherentTags`（遗留字符串标签）与 `runtimeSemantics`（结构化语义）并存的现象。
*   **后果：** 开发者在定义一个词缀（Affix）时，无法直观预判它在战斗中最终呈现的标签画像。

### 1.3 硬编码映射 (Hardcoded Mappings)
存在大量类似 `ELEMENT_TO_RUNTIME_ABILITY_TAG` 的静态映射表散落在 `Assembler` 或 `shared` 目录。
*   **后果：** 增加一个新元素或新机制需要跨 3-4 个文件进行同步修改，维护压力极大。

---

## 2. 工业界方案对标 (Professional Benchmarking)

成熟的商业引擎（如 **Unreal Engine Gameplay Ability System - GAS**）采用以下设计模式：

### 2.1 显式契约 (Explicit Tag Contract)
能力（Ability）或词缀（Affix）在定义阶段就必须显式声明其“标签画像”。
*   **原则：** “我是伤害类、火属性、魔法通道的能力”这一事实是由定义者告诉引擎的，而不是由引擎根据数值公式猜出来的。

### 2.2 层级化标签查询 (Hierarchical Tags)
标签以 `. ` 分隔的树状结构存在（如 `Effect.Damage.Fire.Magic`）。
*   **逻辑优化：** 支持泛化匹配。检查 `Effect.Damage` 自动命中其所有子标签。这消除了战斗引擎中大量的 `if/else` 判断。

---

## 3. 重构建议方案 (Proposed Architecture)

### 3.1 引入“能力画像”契约 (Ability Profile Contract)
废弃 `summarizeCapabilities`。在词缀注册表（AffixRegistry）中，强制要求核心词缀（Core Affix）声明其赋予产物的标签。

```typescript
// 推荐的词缀定义结构
export interface AffixDefinition {
  id: string;
  // 直接声明战斗引擎认识的标签契约
  grantsTags: GameplayTagPath[]; 
  effects: EffectConfig[];
  // ...
}
```

### 3.2 标签命名空间重组 (Refined Namespaces)
消除冗余，对齐语义。建议将 `GameplayTags` 划分为以下五个标准轴（Axes）：
1.  **Kind (是什么):** `Kind.Skill`, `Kind.Passive`, `Kind.Artifact` (确定来源)
2.  **Mech (机制):** `Mech.Damage`, `Mech.Heal`, `Mech.Control` (确定主要动作)
3.  **Elem (元素):** `Elem.Fire`, `Elem.Ice`, `Elem.Physical` (确定属性)
4.  **Chan (渠道):** `Chan.Magic`, `Chan.Physical`, `Chan.True` (确定结算通道)
5.  **Trig (触发):** `Trig.OnHit`, `Trig.OnKill`, `Trig.LowHP` (确定触发时机)

### 3.3 自动化投影器 (Automated Projector)
在 `tag-domain` 中建立标签元数据，使 `CreationTag` 在定义时就自带对应的 `GameplayTag` 投影。
*   例如：定义 `CreationTags.FIRE_MATERIAL` 时，元数据关联 `GameplayTags.Elem.Fire`。造物引擎在合并材料时，只需简单的 Set 并集操作即可完成标签生成，无需任何 hardcode 映射。

---

## 4. 实施建议 (Implementation Strategy)

1.  **短期：** 清理 `AbilityTagAssembler.ts`，将推断逻辑转化为显式的 `Affix` 标签声明。
2.  **中期：** 统一 `CreationTags` 与 `GameplayTags` 的层级结构，实现“定义即投影”。
3.  **长期：** 在战斗引擎中引入 `GameplayTagContainer` 进行层级匹配优化，提升机制处理的优雅度。
