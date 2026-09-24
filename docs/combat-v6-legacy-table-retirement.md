# V5 历史战斗表弃用与删除计划

2026-09-09 用户决定：本次退役版本只标记弃用并保留历史表；该版本上线后的下一版本执行物理删除。此处按发布顺序定义版本，不绑定仓库当前 package.json 的版本号。

## 本版弃用清单

| 数据库表 | Schema 导出 | 当前情况 | 下一版本删除前的代码处理 |
| --- | --- | --- | --- |
| `wanjiedaoyou_battle_replay_archives` | `battleReplayArchives` | 10H 已删除读写仓储、归档消费者及定期清理，仅保留历史 schema／JSON 类型 | 删除 schema 及仅供该表使用的 `BattleReplayV1` 历史类型 |
| `wanjiedaoyou_bet_battles` | `betBattles` | 10D 已删除业务读写及自动清理；外键引用 V3 战绩表 | 删除 schema；物理删除顺序在 V3 战绩表之前 |
| `wanjiedaoyou_battle_records_v3` | `battleRecordsV3` | 10J 已删除聊天分享创建、旧仓储及 retention 清理；历史消息只显示内嵌摘要，不再读表 | 删除 schema 及独占历史类型；物理删除顺序在赌战表之后 |

`@deprecated` 标记已加在 Drizzle 导出声明上，本版不改表结构、不删除数据、不生成 DROP 迁移，也不新增运行时迁移／兼容逻辑。10J 后三张表均只保留 schema 引用；物理删除仍遵循下一版本安排。

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

最初标记弃用时仅检查注释、Markdown、引用和 `git diff --check`。10J 已完成运行时消费者清理及 lint、共享测试、构建与重点页面验收，详见 [10J 实施记录](./combat-v6-phase-10j-legacy-battle-consumers.md)。物理删除迁移尚未执行。

## 管理后台适配追加弃用（2026-09-23）

| 数据库表 | Schema 导出 | 退役范围 | 后续删除前处理 |
| --- | --- | --- | --- |
| `wanjiedaoyou_tower_enemy_floors` | `towerEnemyFloors` | 旧 AI 敌人仓储、空转刷新任务、cron 入口及消息命令已删除 | 删除 schema 与仅供历史 JSON 使用的 `TowerPreparedEnemy` |
| `wanjiedaoyou_admin_message_templates` | `adminMessageTemplates` | 模板中心页面、API、渲染工具与游戏邮件模板引用已删除 | 删除 schema |

两张表仅保留历史结构与数据，并标注 `@deprecated`；本次无结构变更或 DROP 迁移。实际 V6 周配置由 `wanjiedaoyou_tower_weeks` 管理，不能随旧敌人表删除。

后台「蜃楼敌人」读取已发布周配置，通过正式 `publishedTowerEncounter` 编译所选境界／楼层；支持本周与下周重新生成并发布，历史周只读。重生成复用正式生成器及此前三周配置，保持确定性，不承诺随机换一套阵容。通过事务行锁、配置指纹及首次插入冲突检查拒绝过期提交；不会清除挑战状态、奖励领取记录或战斗快照。新配置用于后续进入的楼层。

部署时同步停用外部 `/internal/cron/tower-enemy-sets` 调度和 `tower.enemy-sets.refresh` 消息生产端；旧接口不再提供空转成功响应。邮箱群发已移除，账号验证／重置密码等 SMTP 功能继续保留；游戏邮件保留手填正文、筛选与奖励发放。

### 本次验证

- `bun run lint`、`bun run build` 通过；构建保留已有的大 chunk／混合静动态导入提示。
- `bun run test src/shared/engine/combat-v6/tower src/shared/lib/tower src/shared/contracts/backgroundCommands.test.ts`：155 项通过，1 项战斗矩阵超出默认 5 秒限制；随后 `bun run test src/shared/engine/combat-v6/tower/phase-two.test.ts --testTimeout=30000`，该文件 10 项全部通过。未运行全仓测试。
- 纯本地服务与现有管理员账号验证：本周配置重生成并发布成功，切换境界与首领层正常，历史周没有发布按钮，下周未发布空态正确；1280px／360px 页面无横向溢出，浏览器无 error／warn 日志。
- 游戏邮件仅执行人数预览（9 名活跃角色），未发送邮件；菜单及表单已移除邮箱群发和模板入口。匿名读取／重生成接口返回 401，已删除模板与邮箱群发 API 返回 404。
- 验收后恢复原本地登录账号与浏览器尺寸。未执行数据库迁移、生产操作或外部调度变更；多管理员并发冲突分支经代码检查，未进行多人运行验收。
