# 灵兽技能名称与说明

现行名称和首句说明以 `packages/shared/src/engine/combat-v6/beasts/data/skills.json` 为准。下表记录本次旧名与现名，效果参数和稳定技能 ID 未改。玩家打开技能详情时，先看到简明效果，再看到由参数生成的概率、数值、代价和限制。

四种群体灵法由上品传承灵印承载：九霄神雷、山崩地裂、翻江倒海、红莲业火。它们仍是单档技能，不新增高级技能版本。普通和高级灵魂体暂时效果相同，保留两个独立技能与灵印，供后续扩展。

| 技能 ID | 旧名 | 现名 | 首句效果说明 |
| --- | --- | --- | --- |
| `beast.spirit-flame` | 灵火 | 灵火 | 以灵火攻击一个目标，造成法术伤害。 |
| `beast.combo` | 连击 | 连击 | 普通攻击命中后有机会追加一击，但自身物理伤害会降低。 |
| `beast.advanced-combo` | 高级连击 | 高级连击 | 普通攻击命中后有机会追加一击，但自身物理伤害会降低。 |
| `beast.counter` | 反扑 | 反击 | 受到物理攻击并损失气血时，有机会反击攻击者。 |
| `beast.advanced-counter` | 高级反扑 | 高级反击 | 受到物理攻击并损失气血时，有机会反击攻击者。 |
| `beast.critical` | 凶猛 | 必杀 | 物理攻击更容易打出暴击。 |
| `beast.advanced-critical` | 高级凶猛 | 高级必杀 | 物理攻击更容易打出暴击。 |
| `beast.spell-critical` | 灵涌 | 灵法会心 | 法术攻击更容易打出暴击。 |
| `beast.advanced-spell-critical` | 高级灵涌 | 高级灵法会心 | 法术攻击更容易打出暴击。 |
| `beast.regeneration` | 自愈 | 自愈 | 每回合结束时恢复自身气血。 |
| `beast.advanced-regeneration` | 高级自愈 | 高级自愈 | 每回合结束时恢复自身气血。 |
| `beast.meditation` | 聚灵 | 回灵 | 每回合结束时恢复自身法力。 |
| `beast.advanced-meditation` | 高级聚灵 | 高级回灵 | 每回合结束时恢复自身法力。 |
| `beast.agility` | 迅捷 | 迅捷 | 提高自身速度。 |
| `beast.advanced-agility` | 高级迅捷 | 高级迅捷 | 提高自身速度。 |
| `beast.spell-mastery` | 灵性 | 灵法精通 | 提高自身造成的法术伤害。 |
| `beast.advanced-spell-mastery` | 高级灵性 | 高级灵法精通 | 提高自身造成的法术伤害。 |
| `beast.sluggish` | 迟钝 | 迟钝 | 降低自身速度。 |
| `beast.thunder` | 雷击 | 雷击 | 以雷光攻击一个目标，造成法术伤害。 |
| `beast.falling-rock` | 落岩 | 落岩 | 以落岩攻击一个目标，造成法术伤害。 |
| `beast.water-attack` | 激流 | 水击 | 以水流攻击一个目标，造成法术伤害。 |
| `beast.lifesteal` | 噬血 | 噬血 | 直接物理攻击命中后，吸取目标损失的气血。 |
| `beast.advanced-lifesteal` | 高级噬血 | 高级噬血 | 直接物理攻击命中后，吸取目标损失的气血。 |
| `beast.reflection` | 反震 | 反震 | 受到物理攻击并损失气血时，有机会将伤害反震给攻击者。 |
| `beast.advanced-reflection` | 高级反震 | 高级反震 | 受到物理攻击并损失气血时，有机会将伤害反震给攻击者。 |
| `beast.divine-revival` | 涅槃重生 | 涅槃重生 | 受到致命伤害时，有机会保住性命并恢复气血。 |
| `beast.advanced-divine-revival` | 高级涅槃重生 | 高级涅槃重生 | 受到致命伤害时，有机会保住性命并恢复气血。 |
| `beast.spell-reflection` | 灵息反震 | 灵法反震 | 受到法术攻击并损失气血时，有机会将伤害反震给施术者。 |
| `beast.advanced-spell-reflection` | 高级灵息反震 | 高级灵法反震 | 受到法术攻击并损失气血时，有机会将伤害反震给施术者。 |
| `beast.wisdom` | 慧根 | 慧根 | 施展法术消耗的法力减少。 |
| `beast.advanced-wisdom` | 高级慧根 | 高级慧根 | 施展法术消耗的法力减少。 |
| `beast.sneak-attack` | 偷袭 | 偷袭 | 提高物理伤害，攻击时不会引发目标的反击或反震。 |
| `beast.advanced-sneak-attack` | 高级偷袭 | 高级偷袭 | 提高物理伤害，攻击时不会引发目标的反击或反震。 |
| `beast.spell-resistance` | 耐法 | 御法 | 降低所受法术伤害，但自身物理伤害也会降低。 |
| `beast.advanced-spell-resistance` | 高级耐法 | 高级御法 | 降低所受法术伤害，但自身物理伤害也会降低。 |
| `beast.parry` | 避锋 | 招架 | 每回合首次受到物理攻击时，减轻该次伤害。 |
| `beast.advanced-parry` | 高级避锋 | 高级招架 | 每回合首次受到物理攻击时，减轻该次伤害。 |
| `beast.defense` | 坚韧 | 铁骨 | 物理防御随等级提高，但自身法术伤害降低。 |
| `beast.advanced-defense` | 高级坚韧 | 高级铁骨 | 物理防御随等级提高，但自身法术伤害降低。 |
| `beast.strength` | 蛮力 | 蛮力 | 物理攻击随等级提高，能够破开招架。 |
| `beast.advanced-strength` | 高级蛮力 | 高级蛮力 | 物理攻击随等级提高，能够破开招架。 |
| `beast.thunderstorm` | 奔雷 | 九霄神雷 | 雷光扫向敌方，随着等级提升可攻击更多目标。 |
| `beast.mountain-crush` | 崩山 | 山崩地裂 | 山石崩落压向敌方，随着等级提升可攻击更多目标。 |
| `beast.flood` | 洪流 | 翻江倒海 | 翻江倒海敌方，随着等级提升可攻击更多目标。 |
| `beast.wildfire` | 焚野 | 红莲业火 | 烈焰席卷敌方，随着等级提升可攻击更多目标。 |
| `beast.spell-combo` | 灵力相续 | 灵法连击 | 直接伤害法术施放后，有机会再次施放同一法术。 |
| `beast.advanced-spell-combo` | 高级灵力相续 | 高级灵法连击 | 直接伤害法术施放后，有机会再次施放同一法术。 |
| `beast.spell-fluctuation` | 灵息不定 | 法威无常 | 造成的法术伤害有高低波动。 |
| `beast.advanced-spell-fluctuation` | 高级灵息不定 | 高级法威无常 | 造成的法术伤害有高低波动，法术攻击还不会触发灵法反震。 |
| `beast.stealth` | 隐身 | 隐身 | 首次出战时隐身数回合，期间不能施法，物理伤害降低。 |
| `beast.advanced-stealth` | 高级隐身 | 高级隐身 | 首次出战时隐身数回合，期间不能施法，物理伤害降低。 |
| `beast.perception` | 灵觉 | 灵觉 | 可以选中隐身目标。 |
| `beast.advanced-perception` | 高级灵觉 | 高级灵觉 | 可以选中隐身目标，并提高自身躲避。 |
| `beast.poison` | 毒性 | 毒性 | 普通攻击造成伤害后，有机会使目标中毒，持续损失气血和法力。 |
| `beast.advanced-poison` | 高级毒性 | 高级毒性 | 普通攻击造成伤害后，有机会使目标中毒；自身免疫此毒。 |
| `beast.miracle` | 清灵 | 解厄 | 每回合结束时解除自身可驱散的控制、减益和持续伤害。 |
| `beast.advanced-miracle` | 高级清灵 | 高级避厄 | 免疫可驱散的控制、减益和持续伤害。 |
| `beast.concentration` | 定神 | 定神 | 免疫可驱散的控制，但自身物理伤害降低。 |
| `beast.advanced-concentration` | 高级定神 | 高级定神 | 免疫可驱散的控制，提高自身躲避，但物理伤害降低。 |
| `beast.eternity` | 灵息绵长 | 灵效绵长 | 自身获得的部分增益持续更久。 |
| `beast.advanced-eternity` | 高级灵息绵长 | 高级灵效绵长 | 自身获得的部分增益持续更久。 |
| `beast.ghost` | 魂生 | 灵魂体 | 死亡后等待数回合复起，但无法接受普通气血恢复。 |
| `beast.advanced-ghost` | 高级魂生 | 高级灵魂体 | 死亡后等待数回合复起，但无法接受普通气血恢复。 |
| `beast.exorcism` | 慑魂 | 镇魂 | 攻击灵魂体目标时伤害提高，击杀后阻止其复起。 |
| `beast.advanced-exorcism` | 高级慑魂 | 高级镇魂 | 攻击灵魂体目标时伤害提高，击杀后阻止其复起。 |
| `beast.denial` | 闭灵 | 绝灵 | 免疫常规异常且无法接受增益，但受到灵魂体的伤害增加。 |
| `beast.advanced-denial` | 高级闭灵 | 高级绝灵 | 免疫常规异常且无法接受增益，所受法术伤害降低，但更易受到灵魂体的伤害。 |

当前数值与限制由 `packages/shared/src/combat-v6/skill-details.ts` 读取技能参数生成；调整文案不能凭名称添加元素克制、持续伤害、物种条件或高级灵魂体的额外收益。
