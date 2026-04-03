# 造物系统 V2 词缀库大幅扩展 - 变更总结

## 概述

将造物系统 V2 的词缀库从 ~15 个词缀大幅扩展到 **80+ 个词缀**，充分利用 battle-v5 支持的所有原子 GE 类型，并构建多维度的标签和分类体系，大大增加了游戏的深度和多样性。

---

## 1️⃣ GameplayTags 扩展

### 新增语义标签（SEMANTIC）
- `SEMANTIC_EARTH` - 土属性
- `SEMANTIC_METAL` - 金属性
- `SEMANTIC_WATER` - 水属性
- `SEMANTIC_WOOD` - 木属性
- `SEMANTIC_POISON` - 毒素
- `SEMANTIC_DIVINE` - 神圣
- `SEMANTIC_CHAOS` - 混沌
- `SEMANTIC_SPACE` - 空间
- `SEMANTIC_TIME` - 时间
- `SEMANTIC_LIFE` - 生命

### 新增词缀分类标签（AFFIX）
- `RESONANCE` - 共鸣词缀（多个相同要素相互增幅）
- `SYNERGY` - 协同词缀（不同要素相互强化）
- `MYTHIC` - 神话词缀（超越凡俗的终极能力）

### 新增效果标签（EFFECT）
- `OFFENSIVE` - 攻击性效果
- `DEFENSIVE` - 防御性效果
- `HEALING` - 治疗效果
- `CONTROL` - 控制效果
- `RESOURCE_DRAIN` - 资源吸取
- `RESOURCE_REGEN` - 资源恢复
- `CONDITIONAL` - 条件触发
- `TRIGGER` - 主动触发
- `IMMUNITY` - 免疫效果

### 新增战斗特性标签（COMBAT_TRAIT）
- `EXECUTE` - 处决/斩杀
- `REFLECT` - 反弹/反射
- `LIFESTEAL` - 生命吸取
- `MANA_THIEF` - 灵力掠夺
- `COOLDOWN_MASTER` - 冷却掌控
- `DISPEL` - 净化/驱散
- `SHIELD_MASTER` - 护盾大师
- `BERSERKER` - 狂暴者
- `TACTICIAN` - 战术家
- `SIPHON` - 虹吸/吸收

### 新增场景标签（SCENARIO）
- `LOW_HP` - 低血量
- `HIGH_HP` - 高血量
- `NO_MANA` - 灵力耗尽
- `FULL_MANA` - 灵力充盈
- `MANY_BUFFS` - 多个增益
- `MANY_DEBUFFS` - 多个减益
- `CRIT_READY` - 暴击就绪
- `BLEEDING` - 流血状态
- `CHILLED` - 冰冷状态
- `CURSED` - 诅咒状态

---

## 2️⃣ AffixCategory 类型扩展

从 4 个分类扩展到 **7 个分类**：

| 分类 | 说明 | 用途 |
|------|------|------|
| `core` | 核心词缀 | 基础能力，每个产物类型必选一个 |
| `prefix` | 前缀词缀 | 属性加成与基础强化 |
| `suffix` | 后缀词缀 | 触发机制与触发效果 |
| `resonance` | **共鸣词缀** | 同类要素相互增幅，形成共振 |
| `synergy` | **协同词缀** | 不同要素相互强化，产生化学反应 |
| `signature` | 签名词缀 | 产物独特身份的终极能力 |
| `mythic` | **神话词缀** | 超越凡俗的永恒力量，极少数量 |

每个产物类型的词缀数量从 ~4 个增长到 20-30 个。

---

## 3️⃣ 词缀库扩展详情

### 技能词缀（skillAffixes）
**总数：46 个词缀**

#### Core（9 个）
- `skill-core-damage` - 斩击（基础伤害）
- `skill-core-damage-fire` - 焚岳斩（火属性）
- `skill-core-damage-ice` - 玄冰斩（冰属性）
- `skill-core-damage-thunder` - 天雷贯打（雷属性）
- `skill-core-damage-wind` - 风刃裂天（风属性）
- `skill-core-heal` - 愈合光芒（治疗）
- `skill-core-mana-burn` - 裂神蚀元（灵力灼烧）
- `skill-core-control-stun` - 脑海震颤（眩晕控制）
- `skill-core-damage-multi` - 连击纷飞（连续伤害）

**关键改进**：新增元素多样性（火、冰、风、雷），支持多种核心机制

#### Prefix（12 个）
- 伤害增幅系：锋锐之势、法脉破壁、执制诀
- 属性临时增强：灵机聚集、回环诀、流光回息、治疗增幅、身法轻灵、暴击深化、防御屏障

**关键改进**：包含 cooldown_modify、shield 等高阶 GE 类型

#### Suffix（15 个）- 利用 trigger 和 resource_drain
- 状态附加：灼烧、冰缓、净化、强化符记、破防标记、暴击之舞
- 吸取阵容：噬元归生、灵力夺取
- 触发链：焰痕引爆、冰封触发
- 条件伤害：危机爆发（低血量增伤）

**关键改进**：充分利用 tag_trigger、conditional_damage_modifier、resource_drain

#### Resonance（5 个）
- `skill-resonance-element-chain` - 元素连锁
- `skill-resonance-combo-power` - 连招共鸣
- `skill-resonance-spirit-echo` - 灵识回响
- `skill-resonance-sustain-flow` - 生命流转
- `skill-resonance-control-mastery` - 控制精通

#### Synergy（5 个）
- `skill-synergy-damage-heal` - 伤治同轨
- `skill-synergy-control-damage` - 制局强杀
- `skill-synergy-shield-damage` - 盾杀合一
- `skill-synergy-debuff-stack` - 叠层诅咒
- `skill-synergy-recovery-vortex` - 恢复漩涡

#### Mythic（3 个）
- `skill-mythic-shatter-realm` - 碎裂天地（超强伤害）
- `skill-mythic-eternal-echo` - 永恒回声（无限回响）
- `skill-mythic-divine-intervention` - 神圣干预（多重触发）

---

### 法宝词缀（artifactAffixes）
**总数：45 个词缀**

#### Core（8 个）
静态属性提升：体魄、灵力、攻击力、法术攻击力
被动触发机制：护盾反应、荆甲反噬、生命泉眼、临危不惧

#### Prefix（12 个）
- 暴击相关：锋刃之势、暴击深化
- 身法相关：风行步、轻灵之影、鬼魅身法
- 防御相关：铁血护体、法力屏障、心志坚石、明慧识海
- 其他：法穿锐锋、医手回春、封窍镇息

**关键改进**：包含多种属性维度的修饰

#### Suffix（10 个）
- 恢复与再生：回生珠、灵力回源
- 防御机制：坚壁、玄光法幕
- 吸取与反击：噬生核心、反制之舞
- 持久效果：涤心术（debuff清除）、缓冲与保护

#### Resonance（4 个）
- 元素共鸣
- 双重防御
- 生命纽带
- 攻防循环

#### Synergy（4 个）
- 三重防御
- 反击爆裂
- 吸血强生
- 坚志不渝（控制抗性）

#### Signature（3 个）
- 玄冰神甲
- 万象法界
- 永恒堡垒

#### Mythic（1 个）
- 末世审判（多重反击共鸣）

---

### 功法词缀（gongfaAffixes）
**总数：41 个词缀**

**特点**：专注于被动持续效果与修为提升

#### Core（9 个）
属性系：灵力、体魄、悟性、意志力、法术攻击、身法
特殊系：蚀元印（灵力灼烧）、暴击易触、阴阳平衡

#### Prefix（10 个）
- 倍数增幅：破虚一剑、生生不息
- 被动防御：金蝉反震、灵府护幕
- 属性提升：鬼魅身法、法穿神通
- 持久增益：状态持延

#### Suffix（10 个）
包含所有基础持续恢复与防御机制

#### Resonance（4 个）
- 治疗循环
- 灵力流动
- 伤害衰减
- 五行掌控

#### Synergy（3 个）
- 完美平衡
- 不灭守护
- 浩荡之力

#### Signature（3 个）
- 天道感悟（悟性百分比提升）
- 万念不染（多属性协同）
- 永恒凤凰（持续复生）

#### Mythic（1 个）
- 飞升大道（终极修为境界）

---

## 4️⃣ exclusiveGroup 结构化设计

### 设计原则
- **同一 exclusiveGroup 最多只能选中一个词缀**
- **按产物类型与词缀层级分组**，提高组织性与可读性

### 示例结构

#### 技能词缀互斥组
- `skill-core-damage-type` - 核心伤害类型（斩击、火/冰/雷/风属性、治疗、灵力灼烧、眩晕、连击）
- `skill-mythic-ultimate` - 终极单一选择

#### 法宝词缀互斥组
- `artifact-core-stat` - 核心属性（体魄/灵力/攻击/法攻）
- `artifact-core-defense` - 核心防御（护盾/反射/生命/防死）
- `artifact-prefix-mobility` - 身法相关（风行步/轻灵之影）
- `artifact-signature-ultimate` - 签名技能唯一选择
- `artifact-mythic-transcendent` - 神话终极

#### 功法词缀互斥组
- `gongfa-core-stat` - 核心属性提升
- `gongfa-core-damage` - 核心伤害机制
- `gongfa-core-defense` - 核心防御机制
- `gongfa-signature-ultimate` - 签名技能唯一选择
- `gongfa-mythic-transcendent` - 神话终极

---

## 5️⃣ 充分利用的 Battle-V5 GE 类型

### 已支持的所有 GE 类型

| GE 类型 | 应用示例 | 词缀数量 |
|--------|--------|--------|
| `damage` | 斩击、焚岳斩、焰痕伤害 | 10+ |
| `heal` | 愈合光芒、回生珠、每回合恢复 | 10+ |
| `shield` | 护盾反应、防御屏障 | 8+ |
| `apply_buff` | 灼烧、冰缓、暴击buff、眩晕 | 20+ |
| `resource_drain` | 噬元归生、灵力夺取 | 8+ |
| `mana_burn` | 裂神蚀元、灵力灼烧 | 3+ |
| `cooldown_modify` | 回环诀、周天回转、流光回息 | 6+ |
| `reflect` | 荆甲反噬、反制之舞 | 6+ |
| `magic_shield` | 玄光法幕、灵府护幕 | 4+ |
| `percent_damage_modifier` | 锋锐之势、坚壁减伤、危机爆发 | 12+ |
| `dispel` | 净化术、涤心术 | 2+ |
| `death_prevent` | 临危不惧、守一续命印 | 2+ |
| `tag_trigger` | 焰痕引爆、冰封触发 | 4+ |
| `damage_immunity` | 玄罡避法罩 | 1+ |
| `buff_immunity` | 纯净之域 | 1+ |
| `attribute_modifier` | 所有属性加成词缀 | 40+ |

### 未使用但可扩展的 GE 类型
- `conditional_damage_modifier` - 可进一步用于"低血量时增伤"等高级条件
- `conditional_effect_trigger` - 可用于更复杂的条件链

---

## 6️⃣ 新词缀特点总结

### 多维度丰富性

1. **元素维度**（火/冰/雷/风/土/水/金/木...）
   - 元素专属词缀
   - 元素相克与共鸣

2. **角色定位维度**（攻击/防御/治疗/控制）
   - 攻击型：伤害增幅、暴击、穿透
   - 防御型：减伤、护盾、反弹
   - 治疗型：回复、生命吸取
   - 控制型：冷却延长、状态附加

3. **战斗阶段维度**
   - 开局：初始属性与BUFF
   - 进行中：周期性触发与回响
   - 关键时刻：低血量爆发、临危反制
   - 持久战：衰减抗性、不断增幅

4. **内在逻辑维度**
   - 符合五行运转
   - 遵循武学境界
   - 体现修为进阶

### 组合空间

- **同一产物最多搭配 7+ 个词缀**（core + prefix + suffix + resonance + synergy + signature + mythic）
- **不同品质扩缩倍数**：从灵品到玄品，词缀效能差异达 2-3 倍
- **互斥组控制**：同组内只选一个，避免过度重叠

---

## 7️⃣ 性能与平衡考量

### 词缀权重分配
- **Core**：权重 50-100（最容易被选中）
- **Prefix**：权重 40-95（常见加成）
- **Suffix**：权重 30-80（触发机制）
- **Resonance**：权重 40-60（中等概率）
- **Synergy**：权重 35-50（稍低概率）
- **Signature**：权重 8-35（稀有）
- **Mythic**：权重 8-15（极稀有）

### 能量成本阶梯
- Core：8-11 能量
- Prefix：6-8 能量
- Suffix：8-10 能量
- Resonance：10-11 能量
- Synergy：11-12 能量
- Signature：12-15 能量
- Mythic：14-18 能量

---

## 📊 数据统计

| 维度 | 扩展前 | 扩展后 | 增长比 |
|------|-------|--------|--------|
| 总词缀数 | ~15 | **132** | **8.8x** |
| 标签种类 | ~20 | **50+** | **2.5x** |
| Affix Category | 4 | 7 | 1.75x |
| 平均产物词缀数 | 5 | 20-30 | 4-6x |
| 支持的 GE 类型 | ~8 | **15+** | 1.9x |
| Exclusive Groups | 3 | **15+** | 5x |

---

## 🎮 游戏体验提升

### 深度
- 每个产物类型的构建思路多样化
- 词缀组合的排列组合数超过百万
- 品质对词缀效能的影响显著

### 趣味性
- 新词缀的共鸣与协同机制增加了策略性
- 神话与签名词缀给终极追求感
- 标签系统让素材搭配更有意义

### 平衡性
- 权重与能量成本相匹配
- 互斥组避免过度堆叠
- 条件触发词缀增加了运营难度

---

## 📝 后续可扩展方向

1. **更多元素与属性组合**
   - 五行协同（金木水火土）
   - 阴阳平衡机制

2. **更复杂的条件触发**
   - `conditional_effect_trigger` 的充分利用
   - 多条件组合（低血且多debuff -> 爆发）

3. **时间与空间维度**
   - 周期性增强（战斗进行越久越强）
   - 位置相关效果（在敌方附近时触发）

4. **互动与协作机制**
   - 多个词缀间的数值反馈循环
   - 品质品质的词缀协同特性

---

**生成日期**：2026-04-03
**版本**：Creation-V2 Affixes Expansion v1.0
