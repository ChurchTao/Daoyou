推荐分成 3 个独立提交修复：先保证战斗正确性，再修通用展示层，最后补战术与平衡验收。不要在 battle-v5 中增加幽都 ID 特判。

## 1. 先修战斗正确性

### 1.1 修复 4→5 层漏发魂火

根因是监听顺序：

- 归窍钳制：1000
- 失魂触发：500
- 魂火获取：200

失魂抵抗后会先生成归窍，导致魂火监听误以为目标施法前就在归窍期。

建议把两个魂火监听提高到失魂触发之前、归窍钳制之后，例如：

```ts
const YOUDU_LAYER_PRIORITY = {
  RETURNING_CLAMP: 1_000,
  FIFTH_LAYER_NODE: 600,
  SOUL_FIRE_GAIN: 550,
  SOUL_LOST: 500,
} as const;
```

这样：

- 普通 4→5：先获得魂火，再处理失魂。
- 已有归窍的 4→5：先被钳制，仍不获得魂火。
- 已有归窍的 3→5：最终实际变为4层，仍获得1点魂火。
- 失魂抵抗/免疫不会反向影响已经成立的实际加层。

修改位置：[YouduBaseCompiler.ts](/Users/churcht/daoyou/Daoyou/src/shared/engine/sect/content/youdu/base/YouduBaseCompiler.ts:386)

至少补四组测试：

- 无归窍 4→5，失魂成功，获得魂火。
- 无归窍 4→5，失魂抵抗，获得魂火。
- 无归窍 4→5，失魂免疫，获得魂火。
- 有归窍 4→5→4，不获得魂火；3→5→4，获得魂火。

### 1.2 按伤害请求区分 MAGIC/TRUE

不要移除混合技能的 MAGIC/TRUE 能力标签；`AbilityFactory` 的标签契约是合理的。应修复伤害结算阶段的匹配方式。

在 [DamageImmunityEffect.ts](/Users/churcht/daoyou/Daoyou/src/shared/engine/battle-v5/effects/DamageImmunityEffect.ts:28) 中：

- MAGIC/TRUE/PHYSICAL 等伤害通道标签，只匹配 `event.damageType`。
- 非伤害通道标签，才匹配 `event.ability.tags`、`event.buff.tags` 或 `damageTags`。

类似：

```ts
function matchesDamageTag(event: DamageEvent, tag: string): boolean {
  if (tag === GameplayTags.ABILITY.CHANNEL.MAGIC) {
    return event.damageType === DamageType.MAGICAL;
  }
  if (tag === GameplayTags.ABILITY.CHANNEL.TRUE) {
    return event.damageType === DamageType.TRUE;
  }
  if (tag === GameplayTags.ABILITY.CHANNEL.PHYSICAL) {
    return event.damageType === DamageType.PHYSICAL;
  }

  return (
    event.ability?.tags.hasTag(tag) ||
    event.buff?.tags.hasTag(tag) ||
    event.damageTags?.includes(tag)
  );
}
```

同时全局搜索监听 `DamageRequestEvent/DamageEvent/DamageTakenEvent` 时使用 `ability_has_tag(CHANNEL.*)` 的代码。比如“摄魂”应改为：

```ts
{
  type: 'damage_type_is',
  params: { damageType: DamageType.MAGICAL },
}
```

位置：[artifactAffixes.ts](/Users/churcht/daoyou/Daoyou/src/shared/engine/creation-v2/affixes/definitions/artifactAffixes.ts:801)

回归测试需要证明：

- 法术免疫只阻挡《夺魄》的术伤包。
- 真实伤害免疫只阻挡魂伤包。
- 法术伤害回蓝只触发一次，不响应魂伤。
- 魂伤仍不能暴击、不能吸血。

## 2. 修复通用展示架构

### 2.1 移除通用层中的“佛相”硬编码

[abilityFacts.ts](/Users/churcht/daoyou/Daoyou/src/shared/engine/sect/core/presentation/abilityFacts.ts:590) 不应理解佛相、魔相、无相。

建议给 `AbilityEffectLayerConfig` 增加可选展示名称：

```ts
interface AbilityEffectLayerConfig {
  id: string;
  displayName?: string;
  effects?: EffectConfig[];
  completionEffects?: EffectConfig[];
}
```

通用层规则：

- 有 `displayName`：使用展示名。
- 无 `displayName`：根据计划条件生成“施法前至少3层蚀魂”等描述。
- 永远不直接展示 `sever-high`、`pin-low` 等内部 ID。
- 无相宗自己配置“佛相/魔相/无相”，通用层不再猜测。

幽都可配置为：

```ts
{ id: 'sever-low', displayName: '目标施法前少于3层蚀魂' }
{ id: 'sever-high', displayName: '目标施法前至少3层蚀魂' }
```

### 2.2 让展示层认识新的通用原语

[abilityFacts.ts](/Users/churcht/daoyou/Daoyou/src/shared/engine/sect/core/presentation/abilityFacts.ts:418) 当前仍按“重复几个 apply_buff”计算层数，应改为累计：

```ts
const layers = matches.reduce(
  (total, effect) => total + (effect.params.layers ?? 1),
  0,
);
```

还应展示 effect 条件，特别是：

```text
拥有3点魂火时：本次魂伤提高25%，伤害后消耗全部魂火
```

否则 `consume_all` 会被错误描述成无条件消费。

### 2.3 明确处理手写 detailRows

当前 [SectCompiler.ts](/Users/churcht/daoyou/Daoyou/src/shared/engine/sect/core/compilation/SectCompiler.ts:241) 会完全覆盖内容编译器传入的 `detailRows`。

建议二选一：

- 推荐：有手写 `detailRows` 时作为权威内容，自动事实只作补充。
- 或删除 `SectAbilityFactory` 的 `detailRows` 参数，避免继续产生死代码。

例如：

```ts
const authoredFacts = ability.detailRows ?? [];
const detailRows = Array.from(
  new Set([...authoredFacts, ...configFacts, ...modifierFacts].filter(Boolean)),
);
```

随后把幽都详情全部改成基于 `settings` 动态生成，避免节点强化后仍显示基础值。

### 2.4 展示 valueByLayer

在 [buffText.ts](/Users/churcht/daoyou/Daoyou/src/shared/engine/battle-v5/effects/affixText/buffText.ts:95) 中增加 `valueByLayer` 格式化。

推荐把相同曲线的属性合并：

```text
物攻、法攻、物防、法防、身法：
1层-3%，2层-5%，3层-8%，4～5层-12%

受治疗削弱：
1层0%，2层15%，3层30%，4层50%，5层100%

普通驱散每次只移除1层
```

同时使用 `isPercentageAttributeType()` 判断 FIXED 概率属性，避免把 `0.2` 显示成“+0.2”而不是“20%”。

展示回归测试应断言：

- 不出现 `佛相`、`sever-high`、`pin-low`。
- 离魂引和镇魂显示增加2层。
- 蚀魂详情不包含 `+0`。
- 节点强化后显示真实的70%、0.22、40%控制抗性等数值。
- 魂火消费条件和25%/35%增幅可见。

## 3. 补齐战术与平衡验收

### 3.1 自动战术

`healer-drown` 可以检查对手能力：

- `selectionProfile.intents` 是否包含 `heal`。
- 治疗技能 `currentCooldown <= 1` 时提高镇魂优先级。
- 没有治疗能力时退化为普通 `tide-cycle`，避免战术名与行为不符。

“预计终结足够”不建议在幽都策略中复制完整伤害公式。更稳妥的是增加一个通用只读伤害估算接口，供所有宗门 AI 使用；若本轮不希望扩大战斗架构，应明确将设计稿改成“目标低于45%或魂火已满”的启发式规则。

位置：[strategy.ts](/Users/churcht/daoyou/Daoyou/src/shared/engine/sect/content/youdu/strategy.ts:45)

### 3.2 平衡测试

当前测试只是冒烟，应增加可失败的数值边界：

- 基础终结4层/5层精确倍率。
- 各终极节点允许的理论最高倍率。
- 短、中、长战的合理回合区间。
- 六套战术的终结次数、失魂次数、魂火溢出率。
- 忘川流派的持续魂伤占比。
- 默认攻击占比，防止 AI 因法力或条件错误长期只用《一叹》。
- 同种子结果稳定。
- 两条道途不能同时获得对方节点效果。

## 推荐提交顺序

1. `fix(battle): isolate mixed damage channels and soul-fire timing`
2. `fix(sect): make layered ability presentation domain-neutral`
3. `fix(battle-ui): render layered modifiers and dispel modes`
4. `test(youdu): cover tactics and balance contracts`

前两个提交完成前不建议上线；后两个完成后，《幽都》才基本达到设计稿的可验收状态。