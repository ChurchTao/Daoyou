# 效果系统重构计划

## 目标

将游戏效果系统统一为**主动效果**和**被动效果**两大类，取缔原有混乱的法宝词条系统，建立清晰、可扩展的效果架构。

---

## 核心设计

### 1. 主动效果 (ActiveEffect)

保留现有 `StatusEffect` 系统，由技能施放触发：

- **控制类**: stun(眩晕)、silence(沉默)、root(定身)
- **DOT类**: burn(灼烧)、bleed(流血)、poison(中毒)
- **增益类**: armor_up(护体)、speed_up(疾行)、crit_rate_up(锋锐)
- **减益类**: armor_down(破防)、crit_rate_down(暴击压制)

### 2. 被动效果 (PassiveEffect)

新设计，挂载在功法/法宝上：

| 类别           | 示例效果                           | 说明                   |
| -------------- | ---------------------------------- | ---------------------- |
| **属性类**     | 强健体魄、灵力涌动、五行调和       | 五维属性/气血/灵力加成 |
| **元素类**     | 火焰精通、寒冰护体、元素穿透       | 元素伤害/抗性/穿透     |
| **触发类**     | 毒蚀、烈焰迸发、背水一战、荆棘反噬 | 条件触发额外效果       |
| **修仙特色类** | 境界压制、道心坚定、灵泉涌动       | 境界/状态抗性/灵力回复 |

### 3. 词条生成规则

- 词条数量：**随机生成 (0-3个)**
- 品阶影响：高品质法宝/功法有更高概率获得高阶词条
- 词条强度：品阶越高，数值范围越大

---

## 数据结构

### PassiveEffect 核心接口

```typescript
interface PassiveEffect {
  type: PassiveEffectType; // 效果类型
  category: PassiveEffectCategory; // 分类
  value: number; // 数值
  isPercent: boolean; // 是否百分比
  element?: ElementType; // 关联元素
  triggerChance?: number; // 触发几率
  condition?: PassiveCondition; // 触发条件
  triggerEffect?: TriggerEffect; // 触发效果
}
```

### 功法结构更新

```typescript
interface CultivationTechnique {
  // ... 现有字段
  passiveEffects?: PassiveEffectDefinition[]; // 新增
}
```

### 法宝结构更新

```typescript
interface Artifact {
  // ... 保留 bonus
  passiveEffects?: PassiveEffectDefinition[]; // 替代 special_effects
  curseEffects?: PassiveEffectDefinition[]; // 替代 curses
  // 删除: special_effects, curses
}
```

---

## 实现步骤

### 阶段一：基础设施 (新建文件)

| 文件路径 | 说明 |
| --- | --- |
| `engine/passive/types.ts` | 被动效果类型定义 (30种+) |
| `engine/passive/PassiveRegistry.ts` | 被动效果注册表 (预设词条池) |
| `engine/passive/PassiveContainer.ts` | 被动效果容器 (管理/计算) |
| `engine/passive/calculators/PassiveAttributeCalculator.ts` | 属性加成计算器 |
| `engine/passive/calculators/PassiveTriggerCalculator.ts` | 触发效果计算器 |
| `engine/passive/index.ts` | 模块导出 |

### 阶段二：类型更新

| 文件路径 | 修改内容 |
| --- | --- |
| `types/constants.ts` | 添加 `PASSIVE_EFFECT_TYPE_VALUES`、`PASSIVE_EFFECT_CATEGORY_VALUES` |
| `types/cultivator.ts` | 更新 CultivationTechnique 和 Artifact 接口，删除旧 ArtifactEffect 类型 |

### 阶段三：战斗集成

| 文件路径 | 修改内容 |
| --- | --- |
| `engine/battle/BattleUnit.ts` | 添加 `passiveContainer`，扩展属性计算 |
| `engine/battle/BattleEngine.v2.ts` | 添加触发效果处理钩子 (on_hit, on_crit, on_hurt) |
| `engine/battle/SkillExecutor.ts` | 集成暴击伤害加成、吸血效果 |
| `engine/battle/calculators/DamageCalculator.ts` | 集成元素伤害加成、穿透、最终伤害加成 |
| `utils/cultivatorUtils.ts` | 扩展 `calculateFinalAttributes`，添加被动效果计算 |

### 阶段四：创建系统适配

| 文件路径 | 修改内容 |
| --- | --- |
| `engine/creation/types.ts` | 更新效果提示类型，添加 PassiveEffectBlueprint |
| `engine/creation/CreationFactory.ts` | 修改 `generateEffects()` 生成新的 PassiveEffect |
| `engine/creation/strategies/RefiningStrategy.ts` | 更新法宝生成逻辑 |

### 阶段五：数据迁移

| 文件路径                | 修改内容                                     |
| ----------------------- | -------------------------------------------- |
| `lib/drizzle/schema.ts` | 更新 artifacts 表结构                        |
| 新建迁移脚本            | 将现有 special_effects 转换为 passiveEffects |

### 阶段六：UI更新

| 文件路径 | 修改内容 |
| --- | --- |
| `app/(main)/inventory/components/ItemDetailModal.tsx` | 更新词条显示逻辑 |
| `types/dictionaries.ts` | 添加新词条的显示名称映射 |

---

## 被动效果词条池 (完整列表)

### 属性类 (8种)

- `attr_vitality` - 体魄加成
- `attr_spirit` - 灵力加成
- `attr_wisdom` - 悟性加成
- `attr_speed` - 速度加成
- `attr_willpower` - 神识加成
- `attr_all` - 全属性加成
- `attr_max_hp` - 气血上限加成
- `attr_max_mp` - 灵力上限加成

### 元素类 (4种)

- `elem_damage_bonus` - 元素伤害加成
- `elem_resistance` - 元素抗性
- `elem_penetration` - 元素穿透
- `elem_affinity` - 元素亲和

### 触发类 (8种)

- `trigger_on_hit` - 命中时触发
- `trigger_on_hurt` - 被击中时触发
- `trigger_on_crit` - 暴击时触发
- `trigger_on_low_hp` - 低血量时触发
- `trigger_on_full_hp` - 满血时触发
- `trigger_on_battle_start` - 战斗开始时触发
- `trigger_on_turn_start` - 回合开始时触发

### 战斗类 (8种)

- `combat_crit_rate` - 暴击率加成
- `combat_crit_damage` - 暴击伤害加成
- `combat_dodge` - 闪避率加成
- `combat_accuracy` - 命中率加成
- `combat_lifesteal` - 吸血效果
- `combat_damage_reduce` - 伤害减免
- `combat_final_damage` - 最终伤害加成
- `combat_healing_boost` - 治疗效果加成

### 修仙特色类 (7种)

- `cult_mp_regen` - 灵力恢复
- `cult_realm_suppress` - 境界压制
- `cult_realm_resist` - 境界抵抗
- `cult_status_resist` - 状态抗性
- `cult_status_duration` - 状态持续时间
- `cult_breakthrough` - 突破加成
- `cult_lifespan` - 寿元加成

---

## 关键文件清单

**新建文件 (6个):**

- `/engine/passive/types.ts`
- `/engine/passive/PassiveRegistry.ts`
- `/engine/passive/PassiveContainer.ts`
- `/engine/passive/calculators/PassiveAttributeCalculator.ts`
- `/engine/passive/calculators/PassiveTriggerCalculator.ts`
- `/engine/passive/index.ts`

**修改文件 (12个):**

- `/types/constants.ts`
- `/types/cultivator.ts`
- `/types/dictionaries.ts`
- `/engine/battle/BattleUnit.ts`
- `/engine/battle/BattleEngine.v2.ts`
- `/engine/battle/SkillExecutor.ts`
- `/engine/battle/calculators/DamageCalculator.ts`
- `/utils/cultivatorUtils.ts`
- `/engine/creation/types.ts`
- `/engine/creation/CreationFactory.ts`
- `/engine/creation/strategies/RefiningStrategy.ts`
- `/app/(main)/inventory/components/ItemDetailModal.tsx`
