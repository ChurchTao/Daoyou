# 排查毒术 DOT 伤害在日志中缺失以及 Buff 异常过期的问题

## 背景与问题分析
在战斗机制可视化测试场景 8 中，发现毒术 (PoisonDotBuff) 存在以下问题：
1. **日志不可见**：毒术每回合造成的持续伤害 (DOT) 没有出现在战斗日志中。
2. **提前过期**：Buff 持续时间虽然设为 3，但仅经过 1 个回合就因过期被移除。

### 根因分析
1. **提前过期原因**：
   - `BattleEngineV5.ts` 的 `processBuffs` 方法在每个回合结束时都会对所有 Buff 调用 `tickDuration()`。
   - `PoisonDotBuff.ts` 的 `_onRoundPre` 事件处理器中，也显式调用了 `this.tickDuration()` 并检查 `this.isExpired()` 后自行移除了 Buff。
   - 结果：每回合 Buff 持续时间被扣除两次（RoundPre 一次，回合结束一次）。对于 3 回合的 Buff，在第 2 回合前置阶段结束后其实际值已降至 0 (3 -> 2 -> 1 -> 0)，并被提前移除。

2. **日志缺失原因**：
   - `PoisonDotBuff.ts` 只是发布了 `DamageEvent`。
   - 核心逻辑由 `DamageSystem.ts` 订阅 `DamageEvent` 并处理。
   - `DamageSystem.ts` 在处理 `DamageEvent` 时会更新目标血量并发布 `DamageTakenEvent`。
   - `CombatLogSystem.ts` 订阅了 `DamageTakenEvent` 并生成日志。
   - 问题在于：`PoisonDotBuff` 发布 `DamageEvent` 时设置 `caster` 和 `ability` 为 `null`。
   - `CombatLogSystem.ts` 在处理 `DamageTakenEvent` 时，如果 `caster` 为 `null`，会显示为 "持续伤害"，如果 `ability` 为 `null`，会显示为 "持续效果"。
   - 理论上应该有日志。但在测试输出中没有看到，可能是因为 `DamageSystem.ts` 中 `_applyDamage` 方法处理流程与 `DamageTakenEvent` 触发点的问题，或者是 `DamageEvent` 的订阅优先级/处理器逻辑未正确触发 `DamageTakenEvent`。
   - 经检查 `DamageSystem.ts` 的代码，它**并没有**订阅 `DamageEvent`。它的 `_applyDamage` 是直接被 `_calculateDamage` 内部调用的。`PoisonDotBuff` 发布了 `DamageEvent`，但没有系统去处理它。

## 修改方案

### 1. 统一 Buff 生命周期管理
修改 `PoisonDotBuff.ts`，移除 `_onRoundPre` 中的 `tickDuration()` 和过期检查逻辑。遵循引擎的统一生命周期管理。

### 2. 完善 DOT 伤害处理流程
- 在 `DamageSystem.ts` 中添加对 `DamageEvent` 的订阅，专门处理外部（如 DOT）直接触发的伤害。
- 确保 `DamageTakenEvent` 能够被正确发布，从而让 `CombatLogSystem` 记录日志。

## 待修改文件
- `engine/battle-v5/buffs/examples/PoisonDotBuff.ts`
- `engine/battle-v5/systems/DamageSystem.ts`

## 验证计划
- 运行 `npm test engine/battle-v5/tests/integration/BattleMechanicsVisualTest.test.ts`
- 检查场景 8 的战报，确认：
  - 是否出现了 "【伤害】持续伤害使用【持续效果】对辅助修士造成..." 的日志。
  - "中毒" Buff 是否维持了 3 回合。
