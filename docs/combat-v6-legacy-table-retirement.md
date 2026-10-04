# V6 历史表退役边界

2026-10-04：本轮仅标记弃用并清理业务代码、历史 DTO 和维护脚本，不删除数据库表、不生成 DROP 迁移。物理删除留到后续单独安排，代码完成不能证明目标数据库已完成迁移。

| 数据库表 | Schema 导出 | 保留原因 |
| --- | --- | --- |
| `wanjiedaoyou_battle_records_v3` | `battleRecordsV3` | 旧战绩存档，无运行时消费者 |
| `wanjiedaoyou_battle_replay_archives` | `battleReplayArchives` | 旧在线回放存档，无运行时消费者 |
| `wanjiedaoyou_bet_battles` | `betBattles` | 旧赌战存档，外键引用旧战绩表 |
| `wanjiedaoyou_tower_enemy_floors` | `towerEnemyFloors` | 旧 AI 蜃楼敌人存档，当前使用 `towerWeeks` |
| `wanjiedaoyou_admin_message_templates` | `adminMessageTemplates` | 已下线模板中心的历史结构 |
| `wanjiedaoyou_creation_products` | `creationProducts` | 旧藏宝库查询、旧法宝与功法兑换仍使用 |
| `wanjiedaoyou_materials` | `materials` | 旧藏宝库历史材料查询与丢弃仍使用 |
| `wanjiedaoyou_consumables` | `consumables` | 旧藏宝库历史消耗品查询与丢弃仍使用 |

后续删除须重新核对消费者和目标环境备份，单独生成新 Drizzle 迁移。赌战表先于 V3 战绩表删除，不使用无边界 CASCADE。保留已发布 SQL、快照和 journal。旧造物、材料和消耗品在保留入口退役前不能删除。

当前 V6 回放使用 `combatReplayArchives` / `combatReplayParticipants`；当前背包使用 `inventoryItems`。这些表及角色、邮件、宗门、蜃楼周配置均不属于退役对象。早期旧战绩表的历史迁移仍保留，执行状态以目标迁移账本为准。
