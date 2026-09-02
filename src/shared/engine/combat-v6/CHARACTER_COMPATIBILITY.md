# combat-v6 与现有角色数据兼容性

> 本文记录字段级兼容分析。已确认的新体系边界、炼体五轨迁移方案和实施顺序，
> 以 `docs/combat-v6-mhxy-redesign-roadmap.md` 为准。
> 六维职责和正式面板公式以 `docs/combat-v6-character-panel-design.md` 为准。
> 宗门心法、技能、特色机制和经脉迁移以
> `docs/combat-v6-sect-skill-meridian-system-design.md` 为准。
> 炼体五轨、肉身位阶和修炼数值以
> `docs/combat-v6-training-system-design.md` 为准。

## 结论

现有 `Cultivator` 可以继续作为战斗外持久化模型，六维属性也可以继续保留，
但不能直接作为 combat-v6 的 `LineupUnit` 使用。二者之间必须新增一个明确的
`Cultivator -> CombatV6LineupUnit` 入场投影层。

兼容程度分为三档：

- 六维、当前/最大气血法力、物攻、物防、法伤、法防、速度：可以稳定投影。
- 命中、闪避、暴击、治疗、封印：旧数值单位不兼容；`character_panel_v1` 已锁定新的六维公式和点数单位。
- 修炼、法术暴击、狂暴、技能等级：combat-v6 需要，现有角色没有统一权威来源。
- 穿透、暴击抵抗、暴伤减免、境界压制：现有系统有，combat-v6 核心没有直接槽位。
- 种族、灵根、命格：持久数据继续存在，但已确认首版完全不进入 combat-v6 投影。

因此不需要先修改角色表或把派生战斗属性写回数据库；需要先确定面板编译规则。

## 数据边界

现有角色持久化的基础属性只有：

| Cultivator 字段 | 含义 | combat-v6 处理 |
| --- | --- | --- |
| `attributes.vitality` | 体魄 | 参与 `maxHp`、`healPower` |
| `attributes.strength` | 力道 | 参与 `physicalAtk` |
| `attributes.spirit` | 灵力 | 参与 `magicAtk`、`maxMp`、`sealHit` |
| `attributes.endurance` | 根骨 | 参与 `physicalDef`、`maxHp` |
| `attributes.speed` | 身法 | 参与 `speed`、`hit`、`dodge` |
| `attributes.willpower` | 神识 | 参与 `magicDef`、`maxMp`、`healPower`、`sealResist` |

combat-v6 不理解这六个字段。它接收的是已经编译完成的战斗面板 `Attrs`。

## combat-v6 面板逐项对应

### 可以直接或公式投影

| combat-v6 字段 | 当前来源 | 当前 v5 公式/语义 | 兼容判断 |
| --- | --- | --- | --- |
| `maxHp` | 六维、装备/功法/宗门/炼体、持久伤势 | `floor(400 + vitality×20 + endurance×3)` 后应用 modifier | 可投影 |
| `hp` | `condition.resources.hp.current` | 持久世界战斗取当前值；满状态场景取 `maxHp` | 可投影，但必须由战斗场景决定 |
| `maxMp` | 六维、装备/功法/宗门/炼体 | `floor(200 + spirit×4 + willpower×10)` 后应用 modifier | 可投影 |
| `mp` | `condition.resources.mp.current` | 持久世界战斗取当前值；满状态场景取 `maxMp` | 可投影，但必须由战斗场景决定 |
| `physicalAtk` | 力道及各类 modifier | `floor(40 + strength×3.5)` 后应用 modifier | 可投影 |
| `physicalDef` | 根骨及各类 modifier | `floor(10 + endurance×1.75)` 后应用 modifier | 可投影 |
| `magicAtk` | 灵力及各类 modifier | `floor(40 + spirit×3.5)` 后应用 modifier | 可投影 |
| `magicDef` | 神识 | `character_panel_v1`: `floor(10 + willpower×1.75)` | 已锁定正式投影 |
| `speed` | 身法及各类 modifier | 当前 `actionSpeed = speed` | 可投影 |

这里的“可投影”不代表必须沿用 v5 数值公式。全面梦幻化时可以替换公式，
但字段含义没有结构冲突。

### 旧概念存在，但已重新定义数值语义

| combat-v6 字段 | v6 正式来源 | 与 v5 的边界 | 已确认规则 |
| --- | --- | --- | --- |
| `hit` | 身法 | 不复制 v5 概率值 | 点数：`floor(80 + speed)` |
| `dodge` | 身法 | 不复制 v5 概率值 | 点数：`floor(speed)` |
| `critRate` | 裸身基础、后续 v6 build | 不迁移 v5 暴击抵抗语义 | 裸身 5%，六维不增加 |
| `spellCritRate` | 裸身基础、后续 v6 build | 不从 v5 共用字段转换 | 裸身 5%，六维不增加 |
| `sealHit` | 灵力 | 不复制 v5 控制概率 | 点数：`floor(spirit×0.5)` |
| `sealResist` | 神识 | 不复制 v5 控制概率 | 点数：`floor(willpower×0.5)` |
| `healPower` | 体魄、神识 | 不复制 v5 `healAmplify` 百分比 | 固定面板：`floor(vitality×0.25 + willpower)` |

### combat-v6 需要、现有角色没有统一权威来源

| combat-v6 字段 | 用途 | 当前情况 | 已确认的兼容/迁移来源 |
| --- | --- | --- | --- |
| `attackCultivate` | 物理攻修 | 无统一字段 | 炼体 `sinew_bone` 等级迁移为攻法修炼 |
| `defenseCultivate` | 物理防修 | 无统一字段 | 炼体 `skin` 等级迁移为防御修炼 |
| `spellCultivate` | 法术攻修及封印公式 | 无统一字段 | 炼体 `organs` 等级迁移为法术修炼 |
| `resistSpellCultivate` | 法防修及封印抗性 | 无统一字段 | 炼体 `primordial_spirit` 等级迁移为抗法修炼 |
| `physicalFuryRate`（core 暂名 `furyRate`） | 物理狂暴概率 | 无统一面板字段 | 由 v6 道装/功法/技能被动提供，裸身默认 0 |
| `level` | 逃跑、封印、规则公式 | 角色没有普通等级，只有境界阶段和心法等级 | 兼容期按境界阶段映射 5～180 级 |
| `skillLevels[skillId]` | 技能人数、公式和封印命中 | 普通造物技能没有技能等级；宗门只有六本心法等级 | 宗门技能取所属心法等级；缺省兼容期取人物等级并报告诊断 |

兼容期已确定使用
`(getRealmStageRank(realm, realmStage) + 1) * 5`，把 36 个阶段映射为 5～180 级。
后续若调整正式等级公式，必须提升 projection version。

## 现有属性在 combat-v6 中没有直接位置

| 当前 v5 属性/机制 | combat-v6 情况 | 可选处理 |
| --- | --- | --- |
| `critDamageMult` | 暴击倍率在 `Ruleset.formulas.critMultiplier` 中，是全局值 | 全面梦幻化则统一倍率；若保留个体暴伤需扩展核心 |
| `armorPenetration` | 无对应属性 | 删除/改成技能公式特性，或扩展 v6 面板与公式 |
| `magicPenetration` | 无对应属性 | 同上 |
| `critResist` | 无目标侧暴击抵抗 | 改成状态/被动，或扩展暴击公式 |
| `critDamageReduction` | 无目标侧暴伤减免 | 改成承伤状态，或扩展暴击公式 |
| `healAmplify` | v6 没有永久治疗百分比属性 | 编译为永久被动/状态的 `healDealt` 系数 |
| `healReceivedReduction` | v6 没有永久治疗削弱属性 | 编译为永久状态的 `healTaken` 系数 |
| 境界伤害压制 | v6 不读取境界 | 写入 Daoyou Ruleset，或全面梦幻化后删除 |
| 境界控制命中修正 | v6 不读取境界 | 写入 Daoyou Ruleset，或删除 |
| 灵根元素共鸣 | 首版不进入 v6 | 不生成元素标签、被动、技能覆盖或规则插件 |
| 灵根失配 | 首版不进入 v6 | 不生成失配倍率或兼容字段 |

## 六阶段 modifier 的兼容问题

现有装备、功法、宗门心法和炼体不是只保存最终数值，而是生成 v5
`AttributeModifierConfig`：`BASE/FIXED/ADD/MULTIPLY/FINAL/OVERRIDE`。
combat-v6 只保存最终面板，并且战斗状态只支持加法 `attrMods`、`speedMod`
以及承伤/治疗系数。

有两种迁移方式：

1. 过渡方案：入场前调用现有 v5 属性投影，读取最终面板，再转换成 v6。
   开发快，但 combat-v6 的角色投影仍间接依赖 battle-v5，不满足最终隔离目标。
2. 最终方案：在 v6 `projection` 下实现新的 `CombatV6PanelCompiler`，读取六维和
   战斗外来源，按新规则一次性编译最终面板。装备、功法、宗门与炼体逐步改为
   输出 v6 面板贡献或 v6 被动。

建议仅把方案 1 用于数值对照工具，不作为生产长期架构。

## 角色上的其他字段

| 角色数据 | 结构兼容性 | 说明 |
| --- | --- | --- |
| `id`、`name` | 直接兼容 | 分别映射为单位 id/name |
| `gender` | 核心不需要 | 可留给展示和内容条件 |
| `playerRace` / `race` | 首版不进入 v6 | 不映射为 unit tag、面板、技能、被动或条件；宗门准入等战斗外规则不受影响 |
| `realm` / `realm_stage` | 无直接字段 | 只在面板、等级和规则投影时使用 |
| `spiritual_roots` | 首版不进入 v6 | 灵根数据继续服务战斗外玩法，不生成任何 v6 产物 |
| `pre_heaven_fates` | 首版不进入 v6 | 命格的经济、修炼和叙事作用继续存在，不生成任何 v6 产物 |
| `sect` | 社会身份和养成进度可迁移 | 宗门归属继续保留；六心法等级按槽位继承，经脉最高深度和节点位置结构迁移；旧战斗产物全部退出 |
| `skills` | 旧战斗内容不兼容 | 旧 `abilityConfig` 不进入 v6；新版宗门技能由所属心法和当前流派重新编译 |
| `cultivations` | 元数据可保留 | 属性 modifier 与被动都需重新编译 |
| `inventory.artifacts` / `equipped` | 不进入 v6 | 旧装备实例、装配关系、属性和能力均不迁移；v6 使用完全独立的道装领域且无境界衰减 |
| `condition.resources` | 可兼容 | 作为持久世界战斗的入场 `hp/mp` |
| `condition.statuses` | 数据可保留，运行时定义不兼容 | 伤势可编译为 v6 开场状态或直接修正最终面板 |
| `condition.tracks.bodyCultivation` | 原结构继续作为持久真相 | 五轨名称、key、等级、进度和丹药方向原值保留；按新版规则投影四修炼 + 生命根基，旧 modifier、Buff 和位阶战斗效果退出 |
| `inventory.consumables` | 指令结构已有 item 槽位 | combat-v6 核心目前明确返回 unsupported，尚不能使用 |

## 召唤兽和阵容缺口

combat-v6 原生区分 `player/pet/npc`，并支持 `ownerId`、场上宠、板凳宠和召唤指令。
现有 `Cultivator` 没有召唤兽持久模型，因此人物本体可以投影，但完整梦幻式阵容
还缺少：

- 召唤兽实体、资质/成长、等级和属性点。
- 召唤兽技能/兽诀到 v6 passives 的投影。
- 出战宠与板凳宠编组。
- 宠物死亡、忠诚/寿命等战后规则（如果需要）。

这是角色数据兼容中最大的结构空白，但不阻碍先完成纯人物战斗。

## 建议的投影契约

下一步可以先只定义契约，不立即确定所有公式：

```ts
interface CombatV6ProjectionInput {
  cultivator: CultivatorCombatInput;
  side: 0 | 1;
  slot: number;
  resourcePolicy: 'full' | 'persistent';
}

interface CombatV6ProjectionResult {
  unit: LineupUnit;
  skills: SkillDef[];
  statusDefs: StatusDef[];
  diagnostics: string[];
}
```

投影器应坚持：

- 数据库继续只保存六维，不持久化 v6 派生面板。
- 所有 modifier 先结算成开战面板，不把 v5 对象带入 v6。
- 技能等级、修炼等级、命中/闪避点数必须有唯一映射表。
- 无法映射的旧词条必须明确报诊断，不允许静默变成 0。
- 同一角色快照和同一规则版本必须得到完全相同的 v6 入场单位。

## 尚待后续版本确认的平衡决策

1. 是否保留物理/法术穿透，还是完全服从梦幻式攻防公式。
2. 境界压制是保留、改版，还是退出战斗系统。
3. 是否在后续规则版本增加个体暴击抵抗或暴伤减免。
4. 召唤兽进入哪个阶段；进入前需要先建立独立持久模型。
