# Track Specification: Fix Multiplicative Stat Bloat (Issue #23)

## 1. Overview
针对战斗引擎中百分比属性（如灵力加成、伤害加成）叠加算法错误的修复。目前系统采用连乘（Multiplicative）方式，导致数值异常膨胀。修复目标是将所有同类百分比加成改为基于**基础属性值（Base Value）**的加算（Additive）。

## 2. Functional Requirements
- **属性加成 (StatModifier):** StatModifierType.PERCENT 类型加成必须改为加算。
  - 公式：FinalValue = BaseValue * (1 + Sum(ModifierPercentages))
  - 示例：基础灵力 100，挂载两个 +50% 加成，结果应为 100 * (1 + 0.5 + 0.5) = 200，而非 100 * 1.5 * 1.5 = 225。
- **伤害加成 (BonusDamage):** 修改 BonusDamageEffect 和 DamageEffect，确保不同来源的伤害加成（如元素精通、增伤 Buff）先求和再参与乘法计算。
- **暴击逻辑:** 审查并确保暴击伤害（Crit Damage）等逻辑不会引入非预期的连乘风险。
- **引擎层级一致性:** 确保所有计算流程均能访问到 BaseValue（基础值），而非仅依赖中间状态值。

## 3. Non-Functional Requirements
- **数值稳定性:** 杜绝数值随 Buff 增加而产生指数级爆炸。
- **单元测试覆盖:** 为每个受影响的 Effect 编写测试案例，验证加算逻辑。

## 4. Acceptance Criteria
- [ ] 两个 +50% 灵力加成的最终结果为 +100%。
- [ ] 所有加成均基于基础属性计算，而非加成后的中间值。
- [ ] StatModifierEffect.ts 已修复为加算逻辑。
- [ ] DamageEffect.ts 和 BonusDamageEffect.ts 已修复为加算逻辑。
- [ ] 所有相关单元测试通过，且覆盖率符合工作流要求。

## 5. Out of Scope
- 固定值（FLAT）加成的逻辑修改（除非其与百分比计算存在冲突）。
- 战斗引擎之外的系统（如商城价格计算）暂时不在此 Track 范围内。
