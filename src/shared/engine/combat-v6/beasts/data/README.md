# 召唤兽与兽诀配置（G3）

策划编辑本目录三份 JSON。各自的 `$schema` 提供字段提示，`../pack.ts` 负责结构与跨包语义校验；非法内容会停止加载，并报告文件、字段和相关 ID。代码仍负责随机顺序、取整、机制执行与状态操作。

## 1. 物种与个体生成：species.json

`species` 每条定义 ID、名称、携带等级 `carryLevel`、定位 `role`、偏好加点 `allocation`、随机技能池 `skills` 、五项资质范围 `aptitudes` 和成长千分范围 `growthMilli`。

物种 ID 引用现有 `wild/content.ts` 中的野外物种。两者共享身份，野外敌人的技能与面板仍使用自己的定义，不用灵兽面板替换。例如野外青灵狐的法术系数仍为 0.85，玩家灵兽灵火仍为 1。新增可捕捉物种须先提供对应野外身份；本轮不迁移野外敌人参数。

| generation 字段 | 含义 | 原值 |
| --- | --- | --- |
| `starterLevel` | 免费伙伴出生等级 | 10 |
| `lifespan` | 新个体初始／最大寿命 | 1000 |
| `captureBonus.chance` | 捕捉时从物种池剩余技能补抽1个的概率 | 0.2 |

各物种分别配置 `aptitudes.{attack,defense,health,mana,speed}.{min,max}` 与 `growthMilli.{min,max}`。2026-09-11 修订 3 按历史手游图鉴校准：青灵狐完整参照花妖，岩甲猪参照龟丞相，疾风狼参照老虎。成长配置为千分整数，生成后除以 1000。详细区间、来源等级、存量边界与面板对比见 [资质校准记录](../../../../../../docs/combat-v6-beast-aptitude-calibration.md)。后续新增物种独立设置范围，不共用全局出生上下限。

资质按攻击、防御、体力、法力、速度的代码顺序抽取，随后抽成长。捕捉额外技能使用原来的独立种子流；不调整顺序与算法。初始技能从各物种池等权抽取，捕捉额外技能从剩余池中抽取，避免重复；高级连击、偷袭等核心不保底。免费伙伴只有一格出生技能，捕捉个体根据实际出生技能数确定格数；不新增扩格、洗炼或合宠。

## 2. 技能与兽诀：skills.json

每条技能配置 ID、名称、是否注册兽诀物品 `book` 和一个 `effect`：

| effect.type | 参数 | 机制 |
| --- | --- | --- |
| `spellHit` | `costMp`、`coefficient`、`powerBase`、`powerPerLevel` | 单体法术攻击，附加威力为基础值加技能等级乘每级值 |
| `physicalHit` | `costMp`、`coefficient` | 单体物理攻击 |
| `barrier` | `costMp`、`barrierId`、`kind`、`name`、`powerBase`、`powerPerLevel`、`duration` | 自身护盾，护盾值为基础值加技能等级乘每级值 |
| `counter` | `chance`、`coefficient` | 受到物理伤害后概率反击，复用钩子抑制规则 |
| `critical` | `kind`、`chance` | 提高物理或法术暴击概率 |
| `regeneration` | `resource`、`levelDivisor` | 回合末恢复等级除以指定整数的气血或法力，向下取整 |
| `spellBoost` | `factor` | 法术伤害倍率 |
| `poison` | `chance`、`duration`、`hpRatio`、`mpRatio`、`immune` | 普攻中毒与高级毒免疫 |
| `miracle` | `immune` | 回合末净化或异常免疫 |
| `concentration` | `physicalFactor`、`dodgeBonus` | 控制免疫、物伤代价与躲避 |
| `ghost` | `delay` | 延迟复起、拒绝气血恢复和常规异常免疫 |
| `exorcism` | `factor` | 对鬼魂物法增伤并阻止其复起 |
| `denial` | `ghostDamageFactor`、`spellFactor` | 拒绝增益、异常免疫、鬼魂伤害及法抗倍率 |
| `eternity` | `factor`、`maxExtra` | 合格增益延长倍率与额外回合上限 |
| `stealth` | `minDuration`、`maxDuration`、`physicalFactor` | 首次出战隐身状态、禁法与物伤代价 |
| `perception` | `dodgeBonus` | 看破隐身，可增加面板躲避 |
| `spellRepeat` | `chance`、`factor` | 直接伤害法术整次追加，原目标、无额外费用、不递归 |
| `spellFluctuation` | `min`、`max`、`suppressReflection` | 替换法术波动区间，可免法术反震 |
| `groupSpell` | `costMp`、`coefficient`、`powerBase`、`powerPerLevel`、`levelsPerTarget`、`maxTargets` | 按技能等级增加目标数的群法 |
| `parry` | `factor` | 每回合首次物理命中减伤 |
| `defenseTraining` | `perLevel`、`spellFactor` | 加物防并降低自身法伤 |
| `strengthTraining` | `perLevel`、`versusDefenseFactor` | 加物攻、忽略招架，对防御技能目标承担伤害代价 |
| `wisdom` | `factor` | 仅法术法力消耗倍率 |
| `sneakAttack` | `factor` | 物理增伤且不触发物理反击／反震 |
| `spellResistance` | `takenFactor`、`physicalFactor` | 所受法伤倍率与自身物伤代价 |
| `lifesteal` | `ratio` | 直接物理命中后按实际扣血精确恢复 |
| `reflection` | `kind`、`chance`、`ratio` | 对应类型受击后按实际扣血概率反震固定伤害 |
| `divineRevival` | `chance`、`hpRatio` | 致命时概率复生，服从禁复活与可恢复上限 |
| `speed` | `factor` | 灵兽共用面板中的速度倍率 |
| `combo` | `chance`、`coefficient`、`physicalFactor` | 仅普攻触发，物理伤害有全局代价，物理反震阻止追加 |

经典技能第一批新增 18 个、第二批新增 8 个，第三阶段新增 6 个，第四阶段新增 6 个，第六阶段新增 4 个，第七阶段新增 4 个，第八阶段新增 4 个，第九阶段新增 8 个，第十阶段新增 6 个，曾累计69个，本轮移除2个demo技能后共67个可用技能及兽诀，详见 [累计迁移记录与后续队列](../../../../../../docs/combat-v6-beast-classic-skills.md)。新书已加入清溪野外掉落池；物种修订4将三个初始物种改为独立技能池，具体清单见迁移记录。

数值 0.25 表示 25% 概率，1.1 表示 1.1 倍系数。参与表达式的参数最多六位小数；不接受自由公式或脚本。新机制仍须扩展编译器。

`families` 的每一项用 `normal`／`advanced` 指定普通与高级技能。两者同时占有格位时，仅高级效果激活，个体的两个格位事实不变。当前支持互不交叉的二级配对，不支持循环、三级链或一个技能归属多个配对。

`book: true` 自动产生 `book.<技能ID>`、`<技能名称>兽诀`，保持原物品 ID、堆叠上限及列表顺序；不再另写可用技能 ID 清单。连击说明根据配置中的机制类型识别，并读取编译后的概率。打书耗材、随机替换格位与事务仍沿用原实现。

## 3. 培养与面板：progression.json

| 区块 | 含义 |
| --- | --- |
| `pointsPerLevel` | 每级属性点，原值 5；出生、捕捉、升级及个体点数守恒校验共用 |
| `experience` | 升级需求 `base + perLevel × 当前等级`（原值 100＋20×等级）；战胜敌方 NPC 每级奖励系数原值 10 |
| `lifespan` | 死亡损耗 50、出战最低寿命 50、每灵石恢复寿命 10；休养费用向上取整 |
| `capture` | 捕捉耗蓝 `mpBase + mpPerCarryLevel × 携带等级`；成功率的基础值、残血与等级差系数及上下限 |
| `realms` | 灵兽境界名称与最低等级，从 0 起严格递增；不改人物境界 |
| `panel` | 天生属性基数、每级增量和七项面板的等级资质／成长属性系数 |

捕捉概率固定机制为：

```text
夹取到 [minChance, maxChance]：
baseChance + missingHpFactor × (1 - 目标当前气血 / 目标最大气血)
           + levelDifferenceFactor × (人物等级 - 目标等级)
```

2026-09-11 按用户提供的手游公式调整，完整规则见 [召唤兽设计](../../../../../../docs/combat-v6-summoned-beast-system-design.md) 第 4 节。每项五维实际值为 `naturalBase + level × naturalPerLevel + 已分配值`，当前即 `10 + 等级 + 已分配值`。

除法防外，每项采用 `floor(等级 × 对应资质 × aptitudeCoefficient + 属性点 × 成长 × attributeCoefficient)`。法防采用法力资质的等级项，加体质、魔力、力量、耐力各自的成长贡献；四项系数在 `magicDef.attributeCoefficients` 中配置。没有旧版的固定面板底值，也不再将资质乘到属性贡献上。两项先求和，最终向下取整一次。

| 面板 | 资质 | 属性 | aptitudeCoefficient | attributeCoefficient |
| --- | --- | --- | ---: | ---: |
| 气血 | health | constitution | 0.002895 | 7 |
| 法力 | mana | magic | 0.002085 | 5 |
| 物攻 | attack | strength | 0.0025 | 1.6 |
| 法攻 | mana | magic | 0.000845 | 1.3 |
| 物防 | defense | endurance | 0.003345 | 2.4 |
| 速度 | speed | agility | 0.002087 | 1.6 |
| 法防 | mana | 四维 | 0.000611 | 体质 0.3、魔力 0.8、力量 0.48、耐力 0.16 |

七项派生已改为手游参照公式，出生范围已随物种修订 3 校准；技能倍率、升级预算和寿命规则保留。最高等级 180、兽栏 24、携带编组 6、最多 8 个技能格、出生技能生成方式、点数非负与唯一 ID 等结构约束保留在代码，不把整个存储格式变成策划参数。等级仍不能超过主人，经验到达上限后的处理与胜利奖励归属不变。

## 4. 个体事实与配置发布

已有灵兽保存实际资质、成长、技能、加点和寿命；本轮不改实例字段或生成版本，不重掷已有个体。`schema.ts` 的合法资质范围仍为 0～100000，成长仍为 0.1～3，**不会用新的出生范围校验旧个体**。测试覆盖收紧生成范围后旧个体仍然合法。

生成范围、初始等级、初始寿命或附带技能概率变化仅影响新个体。面板系数、技能效果、境界名称、携带要求、寿命门槛及休养费用变化则会影响已有灵兽的后续计算。删除技能ID时直接清理本地测试数据，不保留历史技能读取白名单；改变 `pointsPerLevel` 也会改变已有个体的守恒预算，需另定存量点数处理方案。不要把这些调整视为单纯的文案变更。

`formatVersion` 固定为 1；内容修改递增 `contentRevision`。修订号不自动迁移个体，不参与种子，不替代回放或生成版本。配置经重新构建／发布生效，不提供热更新或后台编辑器。

## 5. 文件职责与验证

- `content.ts`：加载三包并输出物种、生成参数、编译技能及培养参数。
- `schema.ts`：个体、阵容状态与完整性校验。
- `generator.ts`：出生与捕捉个体生成。
- `skill-compiler.ts`：将明确的机制参数编译为内核技能。
- `progression.ts`：捕捉指令、升级、加点、寿命和休养等纯操作。
- `projection.ts`：激活技能筛选、境界、面板、出战资格和阵容投影。
- `index.ts`：保留原对外接口；原 `progression.ts` 的捕捉生成入口也保留转出。

Schema 由 `pack.ts` 中对应的 `*PackShape` 生成；测试检查两者一致。配置基线 fixture 保存原三物种、五技能；生成基线覆盖三物种各 128 种子、免费伙伴及 0／10／90／180 级捕捉个体，并对照培养、面板与阵容。五技能在 32 个种子下逐一对照真实内核状态和事件。

```bash
bun run test src/shared/engine/combat-v6/beasts
bun run lint
bun run test
bun run build
```

经确认的平衡变更才更新基线；不能为了让等价迁移测试通过而覆盖原结果。浏览器实测记录见治理规划书，纯内核测试不代表实际捕捉、领取或打书的服务端闭环已实测。

## 6. 技能图标与内容删除

`skills.json` 的每项必须填写 `icon`（emoji）。普通／高级身份沿用 `families`，不要依靠名称或ID推断。同族可使用相同emoji，也支持分别配置。更新展示配置不改变战斗数值，不需迁移已有个体。

当前仍为本地测试阶段，删除技能时同步删除技能、技能族、物种池和掉落引用，以及本地库中的相应技能项／兽诀数据。不保留停用目录、旧ID读取白名单或物品注册回退。个体技能和物品校验继续严格拒绝未知ID。

玩家技能格仅分普通、高级、失效三类，不显示等级角标或技能冲突；技能详情与兽诀描述保留冲突规则。展示入口为 `shared/combat-v6/beast-skill-presentation.ts`，技能格为 `BeastSkillTile`；各调用方不再按具体技能ID或advanced-拼图标、等级、兼容文案。
