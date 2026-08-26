# combat-v6 与现有角色数据兼容性

## 结论

现有 `Cultivator` 可以继续作为战斗外持久化模型，六维属性也可以继续保留，
但不能直接作为 combat-v6 的 `LineupUnit` 使用。二者之间必须新增一个明确的
`Cultivator -> CombatV6LineupUnit` 入场投影层。

兼容程度分为三档：

- 六维、当前/最大气血法力、物攻、物防、法伤、法防、速度：可以稳定投影。
- 命中、闪避、暴击、治疗、封印：有近似概念，但数值单位或结算语义不同，必须先定新公式。
- 修炼、法术暴击、狂暴、技能等级：combat-v6 需要，现有角色没有统一权威来源。
- 穿透、暴击抵抗、暴伤减免、灵根共鸣、境界压制：现有系统有，combat-v6 核心没有直接槽位。

因此不需要先修改角色表或把派生战斗属性写回数据库；需要先确定面板编译规则。

## 数据边界

现有角色持久化的基础属性只有：

| Cultivator 字段 | 含义 | combat-v6 处理 |
| --- | --- | --- |
| `attributes.vitality` | 体魄 | 参与 `maxHp`、可选参与 `magicDef` |
| `attributes.strength` | 力道 | 参与 `physicalAtk` |
| `attributes.spirit` | 灵力 | 参与 `magicAtk`、`maxMp`，可选参与 `healPower` |
| `attributes.endurance` | 根骨 | 参与 `physicalDef`、`maxHp` |
| `attributes.speed` | 身法 | 参与 `speed`、`hit`、`dodge` |
| `attributes.willpower` | 神识 | 参与 `magicDef`、`maxMp`、`sealHit`、`sealResist` |

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
| `magicDef` | 神识、体魄及各类 modifier | `floor(10 + willpower×1.75 + vitality×0.25)` 后应用 modifier | 可投影 |
| `speed` | 身法及各类 modifier | 当前 `actionSpeed = speed` | 可投影 |

这里的“可投影”不代表必须沿用 v5 数值公式。全面梦幻化时可以替换公式，
但字段含义没有结构冲突。

### 有对应概念，但数值语义不一致

| combat-v6 字段 | 当前可用来源 | 不一致点 | 需要决策 |
| --- | --- | --- | --- |
| `hit` | v5 `accuracy`、身法 | v5 是 0～1 概率值；梦幻规则把它当面板点数，`0.5 + (hit-dodge)/200` | 定义点数公式，不能直接复制概率 |
| `dodge` | v5 `evasionRate`、身法 | 同上；v5 实际闪避为 `clamp(3%,45%, evasion-accuracy)` | 定义点数公式 |
| `critRate` | v5 `critRate` | v5 同时用于物理/法术，且会扣目标暴击抵抗 | 可先映射为物理必杀率，但会改变法术语义 |
| `spellCritRate` | 无独立字段 | 当前只有共用 `critRate` | 决定是否同源、由门派提供，或初始为 0 |
| `sealHit` | v5 `controlHit`、神识 | v5 是概率点；梦幻公式又叠加技能等级、修炼差和 `sealHit-sealResist` 面板差 | 必须重新标定单位 |
| `sealResist` | v5 `controlResistance`、神识 | 同上 | 必须重新标定单位 |
| `healPower` | 灵力、神识、技能公式、`healAmplify` | v5 治疗通常由技能 `ScalableValue` 计算，`healAmplify` 是乘区；v6 是在技能 `power` 上加固定面板 | 定义治疗面板公式，不能把百分比直接填入 |

### combat-v6 需要、现有角色没有统一权威来源

| combat-v6 字段 | 用途 | 当前情况 | 建议候选来源 |
| --- | --- | --- | --- |
| `attackCultivate` | 物理攻修 | 无统一字段 | 宗门六心法中特定心法等级，或新建四修炼系统 |
| `defenseCultivate` | 物理防修 | 无统一字段 | 宗门心法映射，或新建四修炼系统 |
| `spellCultivate` | 法术攻修及封印公式 | 无统一字段 | 宗门心法映射，或新建四修炼系统 |
| `resistSpellCultivate` | 法防修及封印抗性 | 无统一字段 | 宗门心法映射，或新建四修炼系统 |
| `furyRate` | 物理狂暴概率 | 无统一面板字段 | 由装备/兽诀/技能被动提供，默认 0 |
| `level` | 逃跑、封印、规则公式 | 角色没有普通等级，只有境界阶段和心法等级 | 建立境界阶段到战斗等级的映射 |
| `skillLevels[skillId]` | 技能人数、公式和封印命中 | 普通造物技能没有技能等级；宗门只有六本心法等级 | 宗门技能取所属心法等级；造物技能另定等级规则 |

`getRealmStageRank()` 当前只产生 0～35 的阶段序号，不应不经设计直接当成
梦幻式 0～180 战斗等级。需要确定诸如“每个小境界 5 级”或其他映射。

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
| 灵根元素共鸣 | v6 单位只有字符串 tags，不持有 `spiritualRoots` | 入场编译为被动/技能覆盖，或给 v6 增加灵根规则插件 |
| 灵根失配 | 当前 v5 实际倍率为 1，结构存在但无惩罚 | 可以直接取消，或在 v6 重新设计 |

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
| `playerRace` / `race` | 无直接字段 | 可映射为稳定 unit tag；不要让核心按种族 ID 分支 |
| `realm` / `realm_stage` | 无直接字段 | 只在面板、等级和规则投影时使用 |
| `spiritual_roots` | 不直接兼容 | 映射为元素被动、技能标签或 Ruleset 输入 |
| `pre_heaven_fates` | 当前效果均是非战斗经济/修炼效果 | 不进入 v6；未来战斗命格应显式编译为被动 |
| `sect` | 持久状态可保留 | 现有战斗产物是 v5 `AbilityConfig`，必须重写为 v6 `SkillDef/StatusDef/passives/skillOverrides` |
| `skills` | 元数据可保留 | `abilityConfig` 完全不兼容；需新增 v6 战斗投影 |
| `cultivations` | 元数据可保留 | 属性 modifier 与被动都需重新编译 |
| `inventory.artifacts` / `equipped` | 装备关系可保留 | 属性和能力投影需重写；境界衰减可在面板编译期完成 |
| `condition.resources` | 可兼容 | 作为持久世界战斗的入场 `hp/mp` |
| `condition.statuses` | 数据可保留，运行时定义不兼容 | 伤势可编译为 v6 开场状态或直接修正最终面板 |
| `condition.tracks.bodyCultivation` | 养成状态可保留 | 十类 v5 modifier/被动需要逐项映射或改版 |
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

## 下一步规划前需要确认的决策

1. 六维派生公式继续沿用当前数值，还是整体改成梦幻式面板公式。
2. 境界阶段如何映射人物 `level`；是否采用 0～180 区间。
3. 宗门六心法如何映射技能等级与四项修炼。
4. 物理与法术是否共用暴击率；是否保留暴击抵抗和暴伤减免。
5. 是否保留物理/法术穿透，还是完全服从梦幻式攻防公式。
6. 灵根和境界压制是保留、改版，还是退出战斗系统。
7. 治疗以哪个六维为主，以及 `healPower` 的面板公式。
8. 身法如何换算 `hit/dodge` 点数，神识如何换算 `sealHit/sealResist` 点数。
9. 自造技能是拥有独立等级，还是绑定境界、品质或某本宗门心法。
10. 召唤兽是否进入第一阶段；若进入，需要先建立独立持久模型。
