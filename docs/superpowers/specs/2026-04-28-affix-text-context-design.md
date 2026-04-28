# 词缀描述渲染上下文化设计

## 背景

`engine/battle-v5/effects/affixText/index.ts` 当前通过 `buildBodyText` 组合三段文案：

- `listenerText`
- `conditionText`
- `coreText`

现状问题是前两段文案缺少事件语义上下文：

- `describeListener` 仅按 `eventType` 映射固定前缀，没有区分 `ListenerScope`
- `describeConditions` 仅按条件类型翻译固定短句，没有区分监听器主语是“自身”还是“目标”

这会导致 `DamageTakenEvent` 一类依赖参与关系的监听，在 `owner_as_target` 与 `owner_as_caster` 下渲染出相同的“受击时”，从而误导词缀语义。

## 目标

在不改动运行时监听判定与条件判定逻辑的前提下，让词缀展示文案能够基于事件类型与监听范围输出更准确的中文描述。

本次改动只处理展示层：

- 调整 `listenerText`
- 调整 `conditionText`
- 保持 `coreText` 与实际效果执行逻辑不变

## 非目标

- 不修改 `ListenerScope` 的运行时匹配逻辑
- 不修改 `ConditionEvaluator` 的判定逻辑
- 不引入完整句式模板系统
- 不重构 `affixText` 之外的词缀生成流程

## 设计

### 1. 引入轻量渲染上下文

在 `affixText` 内新增一个仅用于展示的上下文对象，至少包含：

- `eventType`
- `listenerScope`

`buildBodyText` 在拿到 `listenerSpec` 后，统一把该上下文传给：

- `describeListener`
- `describeConditions`

该上下文只服务于文案生成，不参与任何运行时判定。

### 2. Listener 文案按事件与 scope 区分

`describeListener` 从“只看事件类型”改为“同时看事件类型与 scope”。

本次至少覆盖以下语义：

- `DamageTakenEvent + owner_as_target` → “受击后”
- `DamageTakenEvent + owner_as_caster` → “造成伤害后”
- `DamageTakenEvent + owner_as_actor` → 退化为中性表达，例如“伤害结算后”
- `DamageRequestEvent + owner_as_caster` → 保持攻击侧语义，例如“造成伤害时”或等价表达

其它已有事件先尽量保持原表达，避免扩大变更面。

### 3. Condition 文案按主语区分

`describeConditions` 增加上下文感知，但仍保持“条件短句拼接”的结构，不升级为整句模板。

#### `is_critical`

根据监听上下文区分：

- 攻击者主语：`暴击时`
- 受击者主语：`被暴击时`

#### 数值状态类条件

对于 `hp_above` / `hp_below` / `mp_above` / `mp_below` / `has_shield` / `buff_count_at_least` / `debuff_count_at_least`：

- `scope: caster` → “自身...”
- `scope: target` 或未填且监听器为受击主语 → “自身...”或“目标...”需按监听上下文推导

具体原则：

- 当监听器主语已经是自身时，优先输出自然短句，如“气血低于30%”
- 当条件指向与监听主语不同的对象时，显式标注“自身”或“目标”

例如：

- 攻击方监听 + `hp_below(scope: caster)` → “自身气血低于30%”
- 攻击方监听 + `hp_below(scope: target)` → “目标气血低于30%”

#### 事件属性类条件

对于 `damage_type_is` / `ability_has_tag` / `ability_has_not_tag` / `is_critical`：

- 攻击者主语下优先使用“造成...”语义
- 受击者主语下优先使用“受到...”语义

例如：

- 攻击方监听 + 火属性标签 → “造成「火系」伤害时”
- 受击方监听 + 火属性标签 → “受到「火系」伤害时”

### 4. 文案拼接策略保持不变

`joinSegments` 继续负责拼接：

- `[listenerText] [conditionText] [coreText]`

只修正文案内容，不调整现有拼接结构，避免影响其它词缀快照。

## 实现范围

预计只改动：

- `engine/battle-v5/effects/affixText/index.ts`
- `engine/battle-v5/effects/affixText/listeners.ts`
- `engine/battle-v5/effects/affixText/conditions.ts`
- `engine/battle-v5/tests/effects/AffixRenderer.test.ts`

如需共享类型，可在 `affixText` 目录内新增小型类型文件，但不扩散到 battle runtime。

## 验证计划

先写失败测试，再最小实现，覆盖至少以下场景：

1. `DamageTakenEvent + owner_as_target + is_critical` 仍渲染为受击主语文案
2. `DamageTakenEvent + owner_as_caster + is_critical` 渲染为自身造成暴击后的文案
3. 攻击侧监听下 `hp_below(scope: caster)` 与 `hp_below(scope: target)` 产生不同文本
4. 现有属性类词缀仍不带 listener / condition 前缀

## 风险与取舍

本方案刻意不引入完整句式模板，因此个别事件与条件组合仍可能存在“短句精确但整体不够优雅”的情况。

当前优先级是修正主语与作用对象，确保语义正确；若后续需要更自然的长句，再单独设计模板层。
