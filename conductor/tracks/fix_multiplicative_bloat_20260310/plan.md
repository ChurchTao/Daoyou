# Implementation Plan: Fix Multiplicative Stat Bloat (Issue #23)

## Phase 1: Research and Reproduction (调研与复现)
- [ ] Task: 分析 StatModifierEffect.ts 中现有的属性加成逻辑，确认其是如何获取基础值的。
- [ ] Task: 在 engine/battle/ 目录下编写一个新的测试套件，专门用于复现 Issue #23 中描述的数值膨胀问题（特别是多个 +50% 加成的案例）。
- [ ] Task: 审查 DamageEffect.ts 和 BonusDamageEffect.ts 源码，识别所有使用 *= 操作符进行百分比叠加的代码点。

## Phase 2: Core Logic Implementation (核心逻辑重构)
- [ ] Task: 在计算上下文（Ctx/State）中引入 baseValue 概念（如果尚未清晰定义），确保所有百分比 Effect 能够访问到未被加成的原始值。
- [ ] Task: 重构 StatModifierEffect.ts：将百分比加成逻辑从 ctx.value *= (1 + addValue) 修改为加算（基于 baseValue 进行叠加）。
- [ ] Task: 重构 BonusDamageEffect.ts：将元素精通和伤害加成逻辑修改为加算（汇总所有加成比例后再计算）。
- [ ] Task: 重构 DamageEffect.ts：确保暴击伤害等逻辑在多来源加成下也遵循加算规则。
- [ ] Task: Conductor - User Manual Verification 'Phase 2: Core Logic Implementation' (Protocol in workflow.md)

## Phase 3: Testing and Validation (测试与验证)
- [ ] Task: 运行所有战斗引擎相关的单元测试，确保无逻辑回归。
- [ ] Task: 验证 Phase 1 中编写的数值膨胀复现测试，确认修复后的数值完全符合预期（+100%）。
- [ ] Task: 执行 Lint 和 Type Check，确保代码质量符合项目规范。
- [ ] Task: Conductor - User Manual Verification 'Phase 3: Testing and Validation' (Protocol in workflow.md)

## Phase 4: Finalization (收尾与提交)
- [ ] Task: 更新相关文档（如果需要说明加算规则的变更）。
- [ ] Task: 提交所有代码更改，采用原子化提交方式。
