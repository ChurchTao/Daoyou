# 词缀三角重构设计规格（Creation-V2）

> 基于 `2026-04-16-affix-balanced-triangle-design.md` 原始设计方案，经过完整 brainstorming 确认后的实现规格。
> 实施路径：**类型层先行**（TypeScript 编译错误驱动迁移）。

---

## 1. 核心决策

| 决策点 | 选择 |
|---|---|
| `AffixCategory` 结构 | **彻底重构**为 9 个产物专属池值，完全替换旧的 7 个通用分类 |
| 稀有度表达 | **新增 `rarity` 字段**（`common / uncommon / rare / legendary`），与 category 正交 |
| 实施顺序 | **类型层先行**：先改类型，TypeScript 编译错误驱动三个词缀文件全量重写 |
| 历史兼容 | **无**，不保留旧 category 值，不做渐进迁移 |

---

## 2. 类型层变更

### 2.1 `AffixCategory`（`engine/creation-v2/types.ts`）

```ts
export type AffixCategory =
  | 'skill_core'         // Skill 核心池  — 即时施法成立
  | 'skill_variant'      // Skill 变招池  — 改变本次出手形态
  | 'skill_rare'         // Skill 稀有技池 — 神技感（仅 rare/legendary）
  | 'gongfa_foundation'  // Gongfa 根基池 — 百分比底盘
  | 'gongfa_school'      // Gongfa 流派池 — 元素/状态/节奏规则
  | 'gongfa_secret'      // Gongfa 稀有诀池 — 流派身份（仅 rare/legendary）
  | 'artifact_panel'     // Artifact 面板池 — 固定值出货
  | 'artifact_defense'   // Artifact 防守池 — 受击/保命/对策
  | 'artifact_treasure'; // Artifact 稀有宝池 — 极品法宝（仅 rare/legendary）
```

旧值（`prefix / suffix / core / resonance / synergy / signature / mythic`）全部删除。

### 2.2 `AffixDefinition` 新增 `rarity` 字段（`engine/creation-v2/affixes/types.ts`）

```ts
export type AffixRarity = 'common' | 'uncommon' | 'rare' | 'legendary';

export interface AffixDefinition {
  // ... 现有字段不变 ...
  rarity: AffixRarity; // 新增，必填
}
```

### 2.3 两维正交关系

- `category` = 属于哪个功能池（决定解锁时机、配额上限、平衡身份）
- `rarity` = 稀有度（决定玩家感知价值、出货概率权重参考）

**稀有池约束**：`skill_rare / gongfa_secret / artifact_treasure` 只接受 `rare` 或 `legendary`。

---

## 3. 配置层变更

### 3.1 解锁阈值（`CREATION_AFFIX_UNLOCK_THRESHOLDS`）

```ts
export const CREATION_AFFIX_UNLOCK_THRESHOLDS = {
  skill_core:        0,   // 核心池：永远可用
  gongfa_foundation: 0,
  artifact_panel:    0,

  skill_variant:     20,  // 中层池：中等材料解锁
  gongfa_school:     20,
  artifact_defense:  20,

  skill_rare:        40,  // 稀有池：高投入材料才解锁
  gongfa_secret:     40,
  artifact_treasure: 40,
} as const;
```

### 3.2 Category 配额上限（`CategoryQuotaRules`）

每件产物每个池最多抽取数量：

| 产物 | 核心池上限 | 中层池上限 | 稀有池上限 |
|---|---|---|---|
| Skill | `skill_core: 1` | `skill_variant: 2` | `skill_rare: 1` |
| Gongfa | `gongfa_foundation: 2` | `gongfa_school: 2` | `gongfa_secret: 1` |
| Artifact | `artifact_panel: 1` | `artifact_defense: 2` | `artifact_treasure: 1` |

稀有池上限固定为 **1**。

### 3.3 高层池标记

```ts
highTierCategories: ['skill_rare', 'gongfa_secret', 'artifact_treasure']
```

替换原来的 `['signature', 'mythic']`，用于 PBU 评分和稀有率统计。

---

## 4. 边界校验规则（`AffixRegistry.validateBoundary()`）

### 规则一：池与产物类型强绑定

- `skill_*` 池 → `applicableTo` 只能含 `'skill'`
- `gongfa_*` 池 → `applicableTo` 只能含 `'gongfa'`
- `artifact_*` 池 → `applicableTo` 只能含 `'artifact'`

### 规则二：稀有池只接受 rare/legendary

- `category` 为 `skill_rare / gongfa_secret / artifact_treasure` 时，`rarity` 必须为 `'rare'` 或 `'legendary'`

### 规则三：产物类型专属内容约束

**Skill 禁止：**
- `effectTemplate.type === 'attribute_modifier'`（常驻属性修改属于 Gongfa/Artifact 域）
- `apply_buff` 内嵌 listener 且 `duration > 1`（禁止模拟长期被动系统）

**Gongfa 禁止：**
- `attribute_modifier` 使用 `ModifierType.FIXED`（只允许 ADD/PERCENT 百分比倍率）
- `listenerSpec.scope === OWNER_AS_TARGET`（受击防守属于 Artifact 域）

**Artifact 禁止：**
- `listenerSpec.scope === OWNER_AS_CASTER`（主动出手爆发属于 Skill/Gongfa 域）

---

## 5. 词缀内容蓝图

### 5.1 Skill 三池

#### `skill_core`（核心池，保证本次施法即时成立）

| id | 名称 | rarity | 效果类型 |
|---|---|---|---|
| skill-core-damage | 基础伤害 | common | damage（通用） |
| skill-core-damage-fire | 火系伤害 | common | damage |
| skill-core-damage-ice | 冰系伤害 | common | damage |
| skill-core-damage-thunder | 雷系伤害 | common | damage |
| skill-core-damage-wind | 风系伤害 | common | damage（物理） |
| skill-core-damage-metal | 金系伤害 | common | damage（物理） |
| skill-core-damage-water | 水系伤害 | common | damage |
| skill-core-damage-wood | 木系伤害 | common | damage |
| skill-core-damage-earth | 土系伤害 | common | damage（物理） |
| skill-core-heal | 基础治疗 | common | heal |
| skill-core-control-stun | 眩晕控制 | uncommon | apply_buff（stun） |
| skill-core-mp-cost-reduce | 消耗降低 | common | attribute_stat_buff（duration=1） |

**约束**：只含即时效果（damage/heal/shield/apply_buff）或 duration=1 的短效 buff。

#### `skill_variant`（变招池，改变本次出手形态）

| id | 名称 | rarity | 效果类型 |
|---|---|---|---|
| skill-variant-burn-dot | 附加灼烧 | common | apply_buff（burn DOT） |
| skill-variant-chill-slow | 附加冰缓 | common | apply_buff（chill） |
| skill-variant-shock-dot | 附加麻痹 | common | apply_buff（shock） |
| skill-variant-poison-dot | 附加中毒 | common | apply_buff（poison，可叠层） |
| skill-variant-def-break | 破甲标记 | common | apply_buff（def debuff） |
| skill-variant-dispel | 命中驱散 | uncommon | dispel |
| skill-variant-heal-on-cast | 施法回血 | common | heal（即时） |
| skill-variant-mp-on-cast | 施法回蓝 | common | heal（mp，即时） |
| skill-variant-shield-on-cast | 施法护盾 | common | shield（即时） |
| skill-variant-crit-boost | 本次增伤 | common | percent_damage_modifier |
| skill-variant-cd-disrupt | 扰乱冷却 | uncommon | cooldown_modify（对目标） |
| skill-variant-crit-rate-buff | 凝锋 | uncommon | attribute_stat_buff（CRIT_RATE，duration=1） |

#### `skill_rare`（稀有技池，神技感，仅 rare/legendary）

| id | 名称 | rarity | 效果类型 | 触发条件 |
|---|---|---|---|---|
| skill-rare-ignite | 引燃 | rare | tag_trigger（引爆灼烧） | 目标有灼烧 |
| skill-rare-fatal-blow | 封喉 | rare | percent_damage_modifier | 目标被控 |
| skill-rare-cd-curse | 逆脉 | rare | cooldown_modify | 概率延长目标CD |
| skill-rare-true-damage | 魂伤 | rare | damage（无视防御） | — |
| skill-rare-execute | 斩杀 | legendary | damage（极高值） | 目标 HP < 30% |
| skill-rare-burn-sentence | 灼烧终结 | legendary | percent_damage_modifier（大幅） | 目标有灼烧 |

---

### 5.2 Gongfa 三池

#### `gongfa_foundation`（根基池，百分比底盘）

| id | 名称 | rarity | 属性 |
|---|---|---|---|
| gongfa-foundation-spirit | 灵力强化 | common | SPIRIT ADD% |
| gongfa-foundation-vitality | 体魄强化 | common | VITALITY ADD% |
| gongfa-foundation-wisdom | 悟性强化 | common | WISDOM ADD% |
| gongfa-foundation-willpower | 意志强化 | common | WILLPOWER ADD% |
| gongfa-foundation-crit-rate | 暴击提升 | uncommon | CRIT_RATE ADD% |
| gongfa-foundation-heal-amp | 治疗加成 | uncommon | HEAL_BONUS ADD% |
| gongfa-foundation-control-hit | 控制命中 | uncommon | CONTROL_HIT ADD% |
| gongfa-foundation-control-res | 控制抗性 | uncommon | CONTROL_RES ADD% |
| gongfa-foundation-dmg-amp | 通用增伤 | uncommon | percent_damage_modifier（全局 increase） |
| gongfa-foundation-dmg-reduce | 通用减伤 | uncommon | percent_damage_modifier（全局 reduce） |

**约束**：只用 `attribute_modifier`（ADD/PERCENT）或全局 `percent_damage_modifier`，无 FIXED。

#### `gongfa_school`（流派池，定义打法）

| id | 名称 | rarity | 效果 |
|---|---|---|---|
| gongfa-school-fire-mastery | 火系专精 | common | 火系技能 percent_damage_modifier |
| gongfa-school-ice-mastery | 冰系专精 | common | 冰系技能增伤 |
| gongfa-school-thunder-mastery | 雷系专精 | common | 雷系技能增伤 |
| gongfa-school-poison-mastery | 毒系专精 | common | 毒系技能增伤 |
| gongfa-school-burn-exploit | 灼烧利用 | uncommon | 对灼烧目标增伤 |
| gongfa-school-chill-exploit | 冰缓利用 | uncommon | 对冰缓目标增伤 |
| gongfa-school-control-exploit | 控制利用 | uncommon | 对受控目标增伤 |
| gongfa-school-crit-mp-regen | 暴击回蓝 | uncommon | 暴击触发 heal(mp)，OWNER_AS_CASTER |
| gongfa-school-low-mp-burst | 低蓝增伤 | uncommon | 灵力 < 40% 时 percent_damage_modifier |
| gongfa-school-dot-amplify | DOT 放大 | uncommon | DOT 伤害倍率，OWNER_AS_CASTER |
| gongfa-school-buff-extend | 增益延长 | uncommon | 新增 buff 时延长 1 回合，GLOBAL（⚠️ 需确认 `buff_duration_modify` GE 类型是否存在；若不存在，暂用 `apply_buff` 包装特殊 listener 实现，或在实现阶段新增该类型到 `AffixEffectTemplate`） |
| gongfa-school-meditation | 周天回转 | uncommon | 每回合首次施法回蓝，OWNER_AS_CASTER |

#### `gongfa_secret`（稀有诀池，流派身份，仅 rare/legendary）

| id | 名称 | rarity | 效果 |
|---|---|---|---|
| gongfa-secret-inferno | 焚天诀 | rare | 火系命中灼烧目标再提升最终伤害 |
| gongfa-secret-frost-soul | 寒魄诀 | rare | 攻击冰缓目标附带最大生命比例伤害 |
| gongfa-secret-cycle-cd | 轮回诀 | rare | 命中后概率减少随机技能 CD |
| gongfa-secret-adaptive | 无相诀 | legendary | 根据当前最高副属性切换强化方向 |

---

### 5.3 Artifact 三池

#### `artifact_panel`（面板池，固定值出货）

| id | 名称 | rarity | slot | 效果 |
|---|---|---|---|---|
| artifact-panel-weapon-dual | 双攻战器 | common | weapon | ATK + MAGIC_ATK FIXED |
| artifact-panel-weapon-phys | 物攻精锻 | common | weapon | ATK FIXED |
| artifact-panel-weapon-magic | 法力精锻 | common | weapon | MAGIC_ATK FIXED |
| artifact-panel-weapon-pen | 穿透淬炼 | uncommon | weapon | 穿透 FIXED |
| artifact-panel-armor-dual | 双防护甲 | common | armor | DEF + MAGIC_DEF FIXED |
| artifact-panel-armor-hp | 厚甲强体 | common | armor | VITALITY FIXED |
| artifact-panel-accessory-roll | 二级属性佩 | common | accessory | random_attribute_modifier × 2 |

**约束**：只用 `attribute_modifier`（FIXED）或 `random_attribute_modifier`，无 listener。

#### `artifact_defense`（防守池，受击反馈）

| id | 名称 | rarity | 效果 | scope |
|---|---|---|---|---|
| artifact-defense-dmg-reduce | 受击减伤 | common | percent_damage_modifier（reduce） | OWNER_AS_TARGET |
| artifact-defense-low-hp-shield | 低血护盾 | uncommon | shield（HP<40%触发） | OWNER_AS_TARGET |
| artifact-defense-magic-ward | 灵障 | common | shield（受法术伤害后） | OWNER_AS_TARGET |
| artifact-defense-control-cleanse | 受控解控 | uncommon | dispel（被控时） | OWNER_AS_TARGET |
| artifact-defense-crit-riposte | 被暴击反伤 | uncommon | reflect（被暴击后） | OWNER_AS_TARGET |
| artifact-defense-element-reduce-fire | 火焰减伤 | common | percent_damage_modifier（reduce，火系） | OWNER_AS_TARGET |
| artifact-defense-element-reduce-ice | 寒冰减伤 | common | percent_damage_modifier（reduce，冰系） | OWNER_AS_TARGET |
| artifact-defense-element-reduce-thunder | 雷鸣减伤 | common | percent_damage_modifier（reduce，雷系） | OWNER_AS_TARGET |
| artifact-defense-element-reduce-wind | 风刃减伤 | common | percent_damage_modifier（reduce，风系） | OWNER_AS_TARGET |
| artifact-defense-element-reduce-metal | 金锋减伤 | common | percent_damage_modifier（reduce，金系） | OWNER_AS_TARGET |
| artifact-defense-element-reduce-water | 水流减伤 | common | percent_damage_modifier（reduce，水系） | OWNER_AS_TARGET |
| artifact-defense-element-reduce-wood | 木毒减伤 | common | percent_damage_modifier（reduce，木系） | OWNER_AS_TARGET |
| artifact-defense-element-reduce-earth | 土压减伤 | common | percent_damage_modifier（reduce，土系） | OWNER_AS_TARGET |

**约束**：scope 只允许 `OWNER_AS_TARGET` 或 `GLOBAL`，禁止 `OWNER_AS_CASTER`。

#### `artifact_treasure`（稀有宝池，极品法宝，仅 rare/legendary）

| id | 名称 | rarity | 效果 |
|---|---|---|---|
| artifact-treasure-golden-armor | 金甲 | rare | 受击概率大幅减伤 |
| artifact-treasure-life-guard | 护命 | legendary | 首次濒死保留1血并获得护盾（death_prevent） |
| artifact-treasure-void-mirror | 太虚镜 | rare | 特定元素伤害概率完全免疫 |

---

## 6. 实施路径（类型层先行）

1. **修改类型层**：重写 `AffixCategory`、`AFFIX_CATEGORIES` 常量，在 `AffixDefinition` 加 `rarity` 字段 → 全项目 TypeScript 报错
2. **修复配置层**：更新 `CREATION_AFFIX_UNLOCK_THRESHOLDS`、`CategoryQuotaRules`、`highTierCategories`、`CreationBalance.ts` 中所有 category 引用
3. **重写 Skill 词缀**（`skillAffixes.ts`）：按本规格的三池蓝图全量重写
4. **重写 Gongfa 词缀**（`gongfaAffixes.ts`）：按本规格全量重写
5. **重写 Artifact 词缀**（`artifactAffixes.ts`）：按本规格全量重写
6. **升级 `AffixRegistry.validateBoundary()`**：实现第 4 节的三条硬规则
7. **更新测试**：`AffixBoundaryValidation.test.ts`、`AffixSystem.test.ts` 及相关集成测试
8. **编译 + lint + 测试全绿**

---

## 7. 文件变更清单

### 必改文件

- `engine/creation-v2/types.ts` — AffixCategory 类型 + AFFIX_CATEGORIES 常量
- `engine/creation-v2/affixes/types.ts` — AffixDefinition 加 rarity 字段
- `engine/creation-v2/affixes/exclusiveGroups.ts` — 按新 category 名更新分组
- `engine/creation-v2/affixes/definitions/skillAffixes.ts` — 全量重写
- `engine/creation-v2/affixes/definitions/gongfaAffixes.ts` — 全量重写
- `engine/creation-v2/affixes/definitions/artifactAffixes.ts` — 全量重写
- `engine/creation-v2/affixes/AffixRegistry.ts` — validateBoundary() 升级
- `engine/creation-v2/config/CreationBalance.ts` — 解锁阈值 + highTierCategories
- `engine/creation-v2/config/AffixSelectionConstraints.ts` — CategoryQuotaRules
- `engine/creation-v2/balancing/PBU.ts` — CATEGORY_MULTIPLIER 对应新 9 个 key

### 需检查/更新的测试文件

- `engine/creation-v2/tests/affixes/AffixBoundaryValidation.test.ts`
- `engine/creation-v2/tests/affixes/AffixSystem.test.ts`
- `engine/creation-v2/tests/rules/affix/AffixPoolRuleSet.test.ts`
- `engine/creation-v2/tests/rules/affix/BudgetExhaustionRules.test.ts`
- `engine/creation-v2/tests/rules/affix/CategoryQuotaRules.test.ts`

---

## 8. 不在本次重构范围内

- `AffixEffectTemplate` 效果类型系统（保持不变）
- `AffixMatcher` / `AffixPicker` / `AffixRollEngine`（保持不变）
- `CreationOrchestrator` 主流程（保持不变）
- battle-v5 GE/Listener 底层（保持不变）
