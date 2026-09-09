# V5 历史战斗表弃用与删除计划

2026-09-09 用户决定：本次退役版本只标记弃用并保留历史表；该版本上线后的下一版本执行物理删除。此处按发布顺序定义版本，不绑定仓库当前 package.json 的版本号。

## 本版弃用清单

| 数据库表 | Schema 导出 | 当前情况 | 下一版本删除前的代码处理 |
| --- | --- | --- | --- |
| `wanjiedaoyou_battle_replay_archives` | `battleReplayArchives` | 10H 已删除读写仓储、归档消费者及定期清理，仅保留历史 schema／JSON 类型 | 删除 schema 及仅供该表使用的 `BattleReplayV1` 历史类型 |
| `wanjiedaoyou_bet_battles` | `betBattles` | 10D 已删除业务读写及自动清理；外键引用 V3 战绩表 | 删除 schema；物理删除顺序在 V3 战绩表之前 |
| `wanjiedaoyou_battle_records_v3` | `battleRecordsV3` | 历史战绩，仍有 `chatMessageApplication` 的旧战报分享、`battleRecordV3Repository` 及 retention 清理引用 | 解除分享读写与旧仓储、清理任务引用；处理历史分享展示引用后删除 schema |

`@deprecated` 标记已加在 Drizzle 导出声明上，本版不改表结构、不删除数据、不生成 DROP 迁移，也不新增运行时迁移／兼容逻辑。V3 表的残余引用尚未清理，弃用标记不等同于当前可以直接删表。

## 下一版本实施边界

1. 解除清单中的全部运行时引用；旧分享入口停止访问旧表，历史消息不得继续请求已删除的数据源。无需迁移旧战绩到 V6。
2. 删除对应 schema 声明及孤立类型，生成新的 Drizzle 迁移。保留历史迁移文件，不改写已发布迁移。
3. 明确删除顺序：先赌战表，再 V3 战绩表；在线回放表独立删除。核对实际外键，仅删除清单内对象，不使用无边界的 CASCADE 扩大删除范围。
4. 检查迁移 SQL、snapshot 和 journal；在本地验证迁移及新版本启动，确认 V6 战绩、回放、聊天和清理任务正常。

此计划不要求为旧在线战斗保留消费者、排空或待结算补偿流程；10H 的停机硬切决定继续有效。本轮没有执行物理删除。

## 不属于弃用清单

- `wanjiedaoyou_combat_v6_replay_archives` 及其 V6 参与者、资源、任务相关表继续使用。
- 共享消息、邮件、角色、宗门和物品表不因 V5 退役而删除。
- 更早的 `wanjiedaoyou_battle_records`、`wanjiedaoyou_battle_records_v2` 已在历史迁移 `0022_modern_winter_soldier.sql` 中安排删除，不重复新增删除计划；具体环境是否执行过该迁移在下一版本部署核对时确认。

本轮验证仅检查注释、Markdown、引用和 `git diff --check`，未修改运行逻辑或结构，未重跑应用测试与构建。
