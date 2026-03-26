# 战斗日志事务整合与时序修复计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复 DOT 伤害错位问题，并真正实现将一个行动（Span）内的多个事件聚合成语义通顺的文案。

**Architecture:** 
- **优先级调整**：提升 Span 切换事件的订阅优先级，确保在效果结算前完成上下文切换。
- **聚合格式化**：在 `LogFormatter` 中实现基于规则的 Entry 合并逻辑。
- **接口一致性**：更新 `getLogs()` 返回整合后的文案数组。

---

## Tasks

### Task 1: 修复事件订阅优先级

**Files:**
- Modify: `engine/battle-v5/systems/log/LogSubscriber.ts`

- [ ] **Step 1: 调整 `LogSubscriber.subscribe` 中的优先级逻辑**
  - 为 `BattleInitEvent`, `RoundStartEvent`, `ActionPreEvent`, `SkillCastEvent` 显式设置高优先级（如 `EventPriorityLevel.ACTION_TRIGGER + 1`）。
  - 保持 `DamageTakenEvent` 等效果事件为 `COMBAT_LOG (10)` 优先级。

### Task 2: 实现 LogFormatter 的文案聚合逻辑

**Files:**
- Modify: `engine/battle-v5/systems/log/LogFormatter.ts`
- Test: `engine/battle-v5/tests/systems/LogFormatter.test.ts`

- [ ] **Step 1: 在 `TextFormatter` 中实现 `summarizeSpan` 逻辑**
  - 遍历 Span 内的 entries。
  - 将 `skill_cast` + `damage` + `buff_apply` 组合成一个复合句子。
  - 处理特殊情况：例如多个目标的伤害合并、暴击标记合并等。

- [ ] **Step 2: 更新 `formatSpan` 以返回聚合文案而非原始列表**

- [ ] **Step 3: 运行测试验证聚合效果**
  Run: `npm test engine/battle-v5/tests/systems/LogFormatter.test.ts`

### Task 3: 更新 CombatLogSystem 输出接口

**Files:**
- Modify: `engine/battle-v5/systems/log/CombatLogSystem.ts`

- [ ] **Step 1: 修改 `getLogs()` 方法**
  - 不再手动插入 `>>> Title` 和 Entries。
  - 直接调用 `this._formatter.formatSpan(span)` 并将其作为结果数组的一个元素。
  - 这样 `result.logs` 的每个元素就代表一个完整的“事务”。

### Task 4: 最终回归验证

- [ ] **Step 1: 运行原子效果全量回归验证**
  Run: `npm test engine/battle-v5/tests/integration/EffectVisualValidation.test.ts`
  - 预期结果：`ActionPre` 产生的持续伤害正确出现在该单位的 Span 内，且文案是整合过的。
