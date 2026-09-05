# combat-v6 红尘剑宗纵切设计

> 状态：Phase 3 已实现（2026-09-03）
>
> 上位设计：[宗门心法、技能与经脉系统](./combat-v6-sect-skill-meridian-system-design.md)
>
> 内容版本：`daoyou_sect_content_v1`
>
> 投影版本：`character_sect_v1`

本文锁定红尘剑宗作为 combat-v6 第一个完整宗门纵切。其战术骨架参考“大唐官府”的点杀、休息、蓄势与剑意流派，但名称、数值和内容均按 Daoyou 修仙世界观重建。社会身份继续使用 `lingxiao`，新版内容不读取旧宗门技能、旧经脉或 `CultivatorSectState`。

## 1. 纵切边界

数据流固定为：

```text
角色六维 → 新版五轨修炼 → 六心法 → 当前流派与经脉
→ character_sect_v1 → combat-v6 BattleSession
```

- `斩尘证道`不创建剑意资源；`万剑归一`每场从 0 点剑意开始，范围 0～11。
- 所有已解锁主动技能都可使用，不设置四技能栏和通用冷却。
- 强力技能只使用气血门槛、气血/法力成本、休息、每场一次条件和剑意门槛约束。
- core 只增加资源、资源条件、动态目标数、物理忽防、概率修改和击倒归因等通用原语，不识别宗门、流派、技能或节点 ID。
- 本阶段没有数据库、服务、API、页面、升级消耗、旧数据迁移或 battle-v5 接入。

## 2. 六心法

心法上限为 `min(180, 人物等级 + 10)`；第一本是唯一主心法，分支心法不能高于主心法。技能等级严格等于所属心法等级。

| 槽位 | ID | 心法 | 面板贡献 |
| ---: | --- | --- | --- |
| 1 | `lingxiao.method.canon` | 《问剑证道总纲》 | 物攻 `floor(level × 0.5)` |
| 2 | `lingxiao.method.sword_aura` | 《剑煞破军录》 | 命中 `floor(level × 0.5)` |
| 3 | `lingxiao.method.waiting` | 《伏锋候时篇》 | 物防 `floor(level × 0.4)` |
| 4 | `lingxiao.method.shadow` | 《惊鸿逐影诀》 | 速度 `floor(level × 0.15)` |
| 5 | `lingxiao.method.formation` | 《裂阵沉锋章》 | 最大气血 `floor(level × 2)` |
| 6 | `lingxiao.method.clarity` | 《澄神洗剑经》 | 封禁抵抗 `floor(level × 0.25)` |

## 3. 基础主动技能

| ID | 技能 | 首版规则 |
| --- | --- | --- |
| `lingxiao.skill.triple` | 断尘三叠 | 当前气血至少 50%；耗 10% 最大气血；三段系数 `0.75/0.85/0.95`，每段加 `floor(level×0.5)`；下回合休息 |
| `lingxiao.skill.waiting` | 伏锋待机 | 耗 5% 当前气血；本回合进入伏锋；下回合锁定原目标抢先普攻，获得心法等级对应物攻、物防和命中 |
| `lingxiao.skill.formation` | 裂阵沉舟 | 耗 10% 最大气血；60级作用2目标、120级作用3目标；系数0.85，加 `floor(level×0.4)` |
| `lingxiao.skill.sword_aura` | 剑煞凝罡 | 单体友方增益5回合，命中增加技能等级 |
| `lingxiao.skill.clarity` | 澄神守一 | 自身增益5回合，法防增加技能等级，封禁抵抗增加 `floor(level/2)` |
| `lingxiao.skill.confuse` | 摄心剑印 | 30级解锁；单体混乱2回合，封禁底率50%，进入正常封禁公式 |
| `lingxiao.skill.shadow_strike` | 惊鸿掠影 | 万剑归一专属；0.8系数物理攻击，获得3回合速度增益和2点剑意 |

经脉授予的主动技能：

- `lingxiao.skill.blood_strike` 血锋连斩：两段 `0.7/0.8`，耗8%最大气血，不休息。
- `lingxiao.skill.zhanchen_ultimate` 一剑开天门：1.65系数，耗15%最大气血并休息。
- `lingxiao.skill.guiyi_ultimate` 万锋归一：需要11点剑意，1.8系数，清空剑意并休息。

## 4. 斩尘证道

流派 ID 为 `lingxiao.path.zhanchen`，不使用剑意，围绕三段点杀、低血爆发、击倒追击与群体清场。

| 层 | 节点 ID | 名称 | 效果 |
| ---: | --- | --- | --- |
| 1 | `lingxiao.node.zhanchen.1.1` | 砺锋 | 断尘三叠总伤害提高5% |
| 1 | `lingxiao.node.zhanchen.1.2` | 风刃 | 普攻NPC时溅射另外2个目标，各20%伤害 |
| 1 | `lingxiao.node.zhanchen.1.3` | 固元 | 最大气血提高3% |
| 2 | `lingxiao.node.zhanchen.2.1` | 勇武 | 对低于50%气血目标增伤8% |
| 2 | `lingxiao.node.zhanchen.2.2` | 静岳 | 休息期间物法承伤降低10% |
| 2 | `lingxiao.node.zhanchen.2.3` | 明锋 | 命中增加30 |
| 3 | `lingxiao.node.zhanchen.3.1` | 破血 | 授予血锋连斩 |
| 3 | `lingxiao.node.zhanchen.3.2` | 杀意 | 击倒后下一次物理伤害提高10% |
| 3 | `lingxiao.node.zhanchen.3.3` | 蓄锐 | 防御受击后下一次物理伤害提高12% |
| 4 | `lingxiao.node.zhanchen.4.1` | 神凝 | 断尘三叠气血门槛降至40% |
| 4 | `lingxiao.node.zhanchen.4.2` | 破空 | 第三段系数增加0.15 |
| 4 | `lingxiao.node.zhanchen.4.3` | 拓阵 | 裂阵沉舟额外作用1个目标 |
| 5 | `lingxiao.node.zhanchen.5.1` | 锐心 | 断尘三叠暴击率增加5% |
| 5 | `lingxiao.node.zhanchen.5.2` | 狂狷 | 低于50%气血时增伤10%、承伤增加5% |
| 5 | `lingxiao.node.zhanchen.5.3` | 不惊 | 休息期间封禁抵抗增加20 |
| 6 | `lingxiao.node.zhanchen.6.1` | 连破 | 断尘三叠击倒时在整次出手结束后取消休息 |
| 6 | `lingxiao.node.zhanchen.6.2` | 血勇 | 气血消耗降至5%，门槛降至35% |
| 6 | `lingxiao.node.zhanchen.6.3` | 裂军 | 裂阵沉舟伤害提高10% |
| 7 | `lingxiao.node.zhanchen.7.1` | 四绝 | 断尘三叠增加第四段0.95系数 |
| 7 | `lingxiao.node.zhanchen.7.2` | 乘胜追锋 | 每场首次击倒后追击最低气血敌人一次，系数0.8 |
| 7 | `lingxiao.node.zhanchen.7.3` | 开天 | 授予一剑开天门 |

## 5. 万剑归一

流派 ID 为 `lingxiao.path.guiyi`。剑意资源 ID 为 `lingxiao.resource.sword_intent`：断尘三叠和裂阵沉舟结算后增加1点，惊鸿掠影增加2点；2点以上增加20命中，5点以上所有物理伤害提高5%；剑意不跨战斗保存。

| 层 | 节点 ID | 名称 | 效果 |
| ---: | --- | --- | --- |
| 1 | `lingxiao.node.guiyi.1.1` | 蓄意 | 断尘三叠额外增加1点剑意 |
| 1 | `lingxiao.node.guiyi.1.2` | 飞鸿 | 惊鸿掠影系数增加0.15 |
| 1 | `lingxiao.node.guiyi.1.3` | 固元 | 最大气血提高3% |
| 2 | `lingxiao.node.guiyi.2.1` | 凌厉 | 2点以上额外增伤3% |
| 2 | `lingxiao.node.guiyi.2.2` | 守意 | 防御受击后增加1点剑意 |
| 2 | `lingxiao.node.guiyi.2.3` | 候锋 | 伏锋待机完成后额外增加1点剑意 |
| 3 | `lingxiao.node.guiyi.3.1` | 长虹 | 惊鸿速度状态延长2回合 |
| 3 | `lingxiao.node.guiyi.3.2` | 破甲 | 2点以上断尘三叠忽略5%物防 |
| 3 | `lingxiao.node.guiyi.3.3` | 开阵 | 2点以上裂阵沉舟额外作用1个目标 |
| 4 | `lingxiao.node.guiyi.4.1` | 剑心 | 5点以上物理暴击率增加5% |
| 4 | `lingxiao.node.guiyi.4.2` | 剑息 | 断尘三叠休息期间承伤降低10% |
| 4 | `lingxiao.node.guiyi.4.3` | 影守 | 惊鸿状态期间物理承伤降低5% |
| 5 | `lingxiao.node.guiyi.5.1` | 锋盛 | 5点以上再增伤5% |
| 5 | `lingxiao.node.guiyi.5.2` | 势固 | 5点以上承伤降低5% |
| 5 | `lingxiao.node.guiyi.5.3` | 受锋 | 每回合首次受到直接伤害增加1点剑意 |
| 6 | `lingxiao.node.guiyi.6.1` | 连破 | 8点以上施放断尘三叠消耗3点剑意并取消休息 |
| 6 | `lingxiao.node.guiyi.6.2` | 无前 | 5点以上物理攻击忽略10%物防 |
| 6 | `lingxiao.node.guiyi.6.3` | 鸿意 | 惊鸿掠影额外增加1点剑意 |
| 7 | `lingxiao.node.guiyi.7.1` | 四象归锋 | 11点时断尘三叠增加第四段0.95系数 |
| 7 | `lingxiao.node.guiyi.7.2` | 一剑无双 | 授予万锋归一 |
| 7 | `lingxiao.node.guiyi.7.3` | 剑意不绝 | 11点时物理增伤10%，每次行动后失去1点剑意 |

## 6. 编译与诊断

`compileSectCombatV6` 按“基础技能 → 心法解锁与面板 → 流派根基 → 第一至第七层节点 → grant/patch → 最终校验”编译。`projectCultivatorWithTrainingAndSectToCombatV6` 再将结果叠加到 `character_training_v1`。

阻止投影的错误包括：宗门不符、六心法结构或等级非法、分支高于主心法、技能缺少所属心法、双方案不完整、未知/跨流派/未解锁/同层多选节点、patch 目标缺失或冲突、内容 ID 重复。已解锁层未选只产生 `MERIDIAN_SELECTION_INCOMPLETE` warning。

验收测试覆盖六心法黄金面板、全部42节点的非空贡献、每条流派 `3^7` 种合法组合、技能成本与段数、剑意获得/夹取/消费、动态目标数、条件忽防、击倒取消休息、确定性事件流和版本戳。

## 7. 后续边界

旧宗门等级和经脉的持久迁移、心法升级、经脉解锁/重置、页面、快捷栏与战斗 Host 留到相应服务阶段。后续若改变技能或节点语义，必须提升内容版本；若改变投影输入或组合顺序，必须提升投影版本。
