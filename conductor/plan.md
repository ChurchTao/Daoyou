# 技能冷却与法力消耗平衡调整计划

## Objective (目标)
调整主动技能（Active Skill）的 `mpCost`（法力消耗）与 `cooldown`（冷却时间）计算规则，使其随着造物材料品质（Quality）的提升而指数级上升（蓝耗）并在 2~8 回合内波动（冷却）。以适应游戏中角色境界（Realm）和基础属性的指数级增长。

## Key Files & Context (受影响的文件)
1. **`engine/creation-v2/config/CreationBalance.ts`**:
   - `CREATION_PROJECTION_BALANCE`：新增 `qualityCooldownBonus: [0, 0, 1, 2, 3, 4, 5, 6] as const` 用于控制随品质带来的额外冷却。

2. **`engine/creation-v2/rules/composition/EnergyConversionRules.ts`**:
   - 增加指数级法力消耗计算逻辑：提取 `qualityOrder`，使用 `Math.pow(2, qualityOrder)` 作为 `mpCost` 的乘数。

3. **`engine/creation-v2/rules/composition/ProjectionRules.ts`**:
   - 修改 `buildSkillPolicy` 中的 `cooldown` 计算逻辑，附加对应 `qualityOrder` 的冷却补偿，并通过 `Math.min(8, baseCooldown + bonus)` 封顶为 8 回合。

## Implementation Steps (实施步骤)

### 1. 更新 `CreationBalance.ts`
在 `CREATION_PROJECTION_BALANCE` 常量中添加 `qualityCooldownBonus` 数组：
```typescript
export const CREATION_PROJECTION_BALANCE = {
  // ...
  gongfaSpiritBuffBase: 3,

  /**
   * 主动技能冷却时间品质加成（基于品质 order 0-7）。
   * 将在基础冷却上增加该值，且总冷却限制在 2~8 回合。
   */
  qualityCooldownBonus: [0, 0, 1, 2, 3, 4, 5, 6] as const,
} as const;
```

### 2. 更新 `EnergyConversionRules.ts`
在 `EnergyConversionRules.apply` 方法中引入 `materialQualityProfile` 并应用指数级增长：
```typescript
    const { energySummary, affixes, materialQualityProfile } = facts;

    const qualityOrder = materialQualityProfile.weightedAverageOrder;
    const qualityMultiplier = Math.pow(2, qualityOrder);

    const baseMpCost = Math.round(
      energySummary.effectiveTotal / CREATION_PROJECTION_BALANCE.mpCostDivisor,
    );

    const mpCost = Math.max(
      CREATION_SKILL_DEFAULTS.minMpCost * qualityMultiplier,
      baseMpCost * qualityMultiplier,
    );
```

### 3. 更新 `ProjectionRules.ts`
在 `ProjectionRules.buildSkillPolicy` 方法中，修改冷却时间的计算逻辑：
```typescript
    const coreType = coreDef.effectTemplate.type;
    const baseCooldown =
      coreType === 'heal'
        ? CREATION_SKILL_DEFAULTS.healCooldown
        : coreType === 'apply_buff'
          ? CREATION_SKILL_DEFAULTS.buffCooldown
          : CREATION_SKILL_DEFAULTS.damageCooldown;

    const qualityOrder = materialQualityProfile.weightedAverageOrder;
    const cooldownBonus = CREATION_PROJECTION_BALANCE.qualityCooldownBonus[qualityOrder] ?? 0;
    const cooldown = Math.min(8, baseCooldown + cooldownBonus);

    diagnostics.addTrace({
      ruleId: this.id,
      outcome: 'applied',
      message: `cooldown=${cooldown} (coreType=${coreType}, base=${baseCooldown}, bonus=${cooldownBonus})`,
    });
```

## Verification & Testing (验证与测试)
- [ ] 运行 `npm test` 确保受影响的现有测试在更新预期的 `mpCost` 和 `cooldown` 断言后仍然通过。
