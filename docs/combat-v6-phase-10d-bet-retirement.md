# Phase 10D：旧赌战全面下线

2026-09-08：用户决定旧赌战全面下线、删除代码；新版玩法后续重新设计，不迁移到 v6。

## 代码范围

- 删除赌战列表／发布／应战页面、路由、导航、战斗返回入口。
- 删除 `/api/bet-battles` 路由及专属应用服务、战斗服务、仓储和 Redis 锁键定义。
- 删除过期 Cron、HTTP 内部入口、后台命令及消费者映射。
- 删除赌战领域事件、世界传闻投影及邀请消息类型。历史聊天内容沿用普通文本显示，不提供应战入口。
- 移除赌战专属限制和旧记录自动清理。
- 保留 `wanjiedaoyou_bet_battles` 及 Drizzle schema，作为历史托管核对依据，避免后续自动生成误删迁移。没有运行时读取或写入，不保留旧功能兼容。

不删除被其他玩法使用的 v5 引擎、旧战绩表、邮件或物品公共能力。没有新增表、数据库迁移、功能开关或新版赌战。

## 停机发布步骤

本轮不操作预发布／生产数据。以下为维护窗口执行事项，应用与旧任务调度必须全部停止后再处理。

1. 备份旧赌战表和相关邮件，按 status 统计记录。核查 `pending`、`matched` 及异常状态；`matched` 不能直接按待应战处理，应先核对双方扣款与既有结算邮件。
2. 对正常 `pending` 记录核对 `creator_stake_snapshot`：灵石为正整数；物品包含合法 itemType、正整数 quantity、名称与完整 data。旧服务的退还规则是灵石生成 `{type: 'spirit_stones', name: '灵石', quantity: spiritStones}`，物品生成 `{type: itemType, name, quantity, data}` 邮件附件。不得将旧物品直接转换为新版库存。
3. 在同一数据库事务内锁定待退还记录，按快照写入 `wanjiedaoyou_mails`（角色为 creator_id，type 为 reward），同时将对应记录从 pending 更新为 cancelled。邮件正文保留原赌战 ID 便于核对。仅处理仍为 pending 的记录，事务失败全部回滚；重复执行不得再次发邮件。使用现有邮件领取链路，无需保留旧赌战服务。
4. 确认正常待应战押注全部有退还邮件；异常托管记录逐笔处理完后再开放服务。旧 settled／cancelled／expired 记录不得重复退还。保留核对记录，物理删表另行安排。
5. 核对事务消息表中 message_key 为 `bet-battle.created`／`bet-battle.settled` 的未发布通知，备份后定向清理；这些是旧传闻通知，不是资产结算凭据。
6. 定向处理 JetStream 中旧赌战 subject 的积压消息：`daoyou.domain.gameplay.bet-battle-created.v1`、`daoyou.domain.gameplay.bet-battle-settled.v1`、`daoyou.command.cron.bet-battle-expire.v1`。不得清空共享 Stream 或其他玩法消息。同步移除外部 `bet-battle-expire` 调度。
7. 发布前后端，检查赌战入口消失、旧 API 和内部过期任务为 404、旧页面显示通用不存在页面。邮件退还由玩家在邮件页领取。

只读核对：

```sql
SELECT status, count(*) FROM wanjiedaoyou_bet_battles GROUP BY status;
SELECT id, creator_id, status, creator_stake_snapshot,
       challenger_id, challenger_stake_snapshot
FROM wanjiedaoyou_bet_battles
WHERE status NOT IN ('settled', 'cancelled', 'expired');
```

## 验证记录

- 本地 PostgreSQL 15432 只读查询：旧赌战表为空，无待退还押注；未更改角色资产。
- 本地浏览器 5174：旧列表与应战页面均显示通用 404；已登录洞府正常加载。导航注册中的赌战入口已删除。
- 本地 API 3001：旧列表 GET、发布 POST、应战 v5 POST、过期 Cron GET 均返回 JSON 404；天骄榜 GET 仍为 JSON 200。修复了未知 API／internal 路径原先重定向站点首页的问题；普通网页路径保留原有重定向。
- `bun run lint`、`bun run build`、`bun run test` 通过（222 个文件、2025 项测试；移除退役事件／命令对应参数化用例）。构建仍有原有大 chunk 提示。
- `git diff --check` 通过。Prettier 检查其余触及文件通过；7 个文件在 HEAD 中已有格式差异，保留无关行：game-layout.tsx、gameShellRegistry.ts、cron.router.ts、domainEvents.ts、temporaryRestrictions.ts、retentionRepository.ts、WorldChatMessageItem.tsx。
- 静态检索：除保留的历史表 schema 外，src 中无 betBattles／bet-battle／bet_battle／duel_invite 引用。未新增前端或服务端单元测试，未进行旧物品真实退还联调（本地无托管数据）。
- 预发布／生产的押注核对、退还和消息清理未执行，不视为已完成发布。
