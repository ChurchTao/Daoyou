# NATS 消息基础设施运行手册

## 运行模型

- `DAOYOU_DOMAIN_EVENTS` 使用文件持久化和 Limits retention，保存 `daoyou.domain.>` 事件 14 天，最大占用 2.5 GiB。
- `DAOYOU_DOMAIN_EVENT_DLQ` 保存终止失败消息 30 天，最大占用 768 MiB。
- `DAOYOU_BACKGROUND_COMMANDS` 使用 WorkQueue retention 保存 `daoyou.command.cron.>`，最大占用 384 MiB；一个 command 只由一个 Worker 实例成功处理。
- `DAOYOU_BACKGROUND_COMMAND_DLQ` 保存后台 command 的终止失败消息，最大占用 128 MiB。
- `DAOYOU_COMBAT_V6_REPLAY_ARCHIVES` 使用 WorkQueue retention 保存回放指针（battle ID），最大占用 64 MiB、单条上限 4 KiB；`combat-v6-replay-postgres-archiver-v1` 从 Redis 读取完整回放并归档后 ACK。
- 五个 Stream 的上限合计约 3.8 GiB；生产 NATS 配置应能容纳这些持久化数据。
- `daoyou.realtime.>` 使用 NATS Core，不进入 JetStream；用于资源变更、世界聊天和宗门聊天的跨实例实时广播。
- 应用启动时以幂等方式校验并创建 Stream 和 durable consumer。
- 业务事务将待发布消息写入通用 PostgreSQL 事务消息表 `wanjiedaoyou_transactional_messages`；领域事件只是当前消息类型之一。
- 事务消息表只保存通用的 `message_key`、`destination`、`payload` 与发布状态，不持有 aggregate、event type 等领域事件专属列。
- 收到 JetStream PubAck 后标记 `published_at`；此后消息的持久化、投递状态、重试与消费进度由 JetStream 负责。
- 消费者在同一 PostgreSQL 事务中写入通用消费幂等记录并更新业务数据，提交后才 ACK JetStream。
- 单条事件处理失败 10 次后转入 DLQ；DLQ 发布失败时继续重试原事件。

## 实时战斗回放归档

Redis 是当前 V6 战斗运行态和回放 outbox 的权威。`CombatV6RuntimeStore` 保存终局与回放，`combatV6Messaging` 向 `daoyou.combat-v6.replay.archive.v1` 发布 battle ID 指针，以 `${battleId}:combat-v6-replay` 作为 `Nats-Msg-Id`。消费者读取 Redis outbox，写入 `combat_replay_archives` / `combat_replay_participants`，确认 Redis replay ACK 后才 ACK JetStream。

合法重复归档由来源和幂等唯一约束保护；幂等冲突属于永久错误，暂时失败按现有重试流程处理。运行细节以 `apps/api/src/runtime/messaging/combatV6Messaging.ts` 和 `apps/api/src/lib/mq/natsTopology.ts` 为准。旧完整 V5 回放 Stream、consumer 和 DLQ 不属于当前运行拓扑，不恢复其消费链。

## 当前事件

| 事件 | Subject | 消费者 |
| --- | --- | --- |
| `sect.construction.donated` | `daoyou.domain.sect.construction-donated.v1` | `sect-facility-projector-v1` |
| `alchemy.craft.completed` | `daoyou.domain.activity.alchemy-craft-completed.v1` | `task-projector-v1` |
| `ranking.challenge.completed` | `daoyou.domain.activity.ranking-challenge-completed.v1` | `task-projector-v1` |
| `dungeon.run.settled` | `daoyou.domain.activity.dungeon-run-settled.v1` | `task-projector-v1` |
| `yield.claimed` | `daoyou.domain.activity.yield-claimed.v1` | `yield-reward-projector-v1` |
| `cultivator.realm.changed` | `daoyou.domain.gameplay.cultivator-realm-changed.v1` | `world-rumor-projector-v1`、`ranking-realm-projector-v1` |
| `cultivator.mail-audience.observed` | `daoyou.domain.system-mail.audience-observed.v1` | `system-mail-projector-v1` |
| `mail.created` | `daoyou.domain.communication.mail-created.v1` | `mail-notification-projector-v1` |
| `craft.item.created` | `daoyou.domain.gameplay.craft-item-created.v1` | `world-rumor-projector-v1` |
| `equipment.forged` | `daoyou.domain.gameplay.equipment-forged.v1` | `world-rumor-projector-v1`（带器诀或器蕴时推送装备预览） |
| `market.material.revealed` | `daoyou.domain.gameplay.market-material-revealed.v1` | `world-rumor-projector-v1` |
| `ranking.position.changed` | `daoyou.domain.gameplay.ranking-position-changed.v1` | `world-rumor-projector-v1` |

`ranking.challenge.completed` 仍保留为战斗完成事实，但当前任务定义没有对应计数目标，任务投影器会显式忽略它。

## 后台 Command

Bun Cron 只负责把以下 command 发布到 WorkQueue Stream，实际 job runner 由 durable consumer `background-command-worker-v1` 执行：

- `auction.expire`
- `ranking.rewards.distribute`
- `market.refresh`
- `tower.enemy-sets.refresh`
- `resource-replay.cleanup`
- `expired-data.cleanup`
- `material-library.generate`

调度器按 command 类型和时间槽生成 JetStream `Nats-Msg-Id`。多个应用实例同时注册相同 Cron 时，同一时间槽只保留一个 command；业务 job 原有 Redis 锁和幂等检查继续作为执行层保护。

JetStream 只能保证“已经发布成功”的 command 持久化；如果所有应用实例在 Cron 触发时都处于停机状态，则不会自动补发该时间槽。每日任务需要通过 `/internal/cron/*` 人工补跑，或在需要自动补偿时改由外部持久化调度器发布 command。

## 实时 Subject

- `daoyou.realtime.resource-state.<scope-kind>.<base64url-scope-id>`
- `daoyou.realtime.world-chat`
- `daoyou.realtime.sect-chat.<base64url-sect-id>`

这些消息只负责唤醒当前在线连接。聊天历史仍由原 Redis list 保存，玩家资源变化仍以 PostgreSQL resource event/replay log 为权威数据，因此 NATS Core 丢失一条实时消息不会造成业务数据丢失。

## 必需环境变量

```dotenv
NATS_SERVERS=nats://nats-host:4222
NATS_USER=app
NATS_PASSWORD=replace-with-production-secret
```

多个 NATS 地址使用逗号分隔。不要把生产密码写入仓库或 URL；通过运行环境的 secret/env 文件注入。

## 停机硬切部署顺序

1. 停止旧应用，确保不会再产生 BullMQ 消息。
2. 确认旧 BullMQ 队列已经处理完需要保留的作业。
3. 在生产 env 文件中配置全部 `NATS_*` 变量。
4. 使用选定目标环境分别执行业务和认证迁移，核对实际账本；命令形式见 [本地开发](local-development.md)。迁移会新增通用事务消息表和消费幂等表，并删除已确认废弃的 `wanjiedaoyou_local_transaction_messages`。注意现有 `0025` 还会删除 `wanjiedaoyou_sect_contribution_ledger` 与 `wanjiedaoyou_sect_daily_commissions`，上线前应单独确认这两张宗门旧表的数据无需保留。
5. 启动新应用；启动成功意味着 NATS 连接、领域事件 Stream、Command WorkQueue 和全部 consumer 初始化成功。
6. 检查 `/api/health-check` 返回 `redis: up`、`nats: up` 和 `messaging: up`；`messaging` 同时覆盖 JetStream consumer 与当前活跃的 NATS Core subscription。
7. 检查 NATS `8222` 监控端点与应用日志，确认无 Outbox/consumer 错误。

## 本地 NATS

```bash
pnpm run services up -d --wait
pnpm run services ps
```

开发配置使用 `env/local.env`，模板见 `env/local.example.env`。停止容器不会删除 JetStream volume；需要重置本地事件时应显式删除 `nats-data` volume。

## 故障检查

- 事务消息积压：查询 `wanjiedaoyou_transactional_messages` 中 `published_at IS NULL` 的数量、最早 `created_at` 和 `last_publish_error`。
- Consumer 积压：查看 JetStream consumer 的 `num_pending`、 `num_ack_pending` 和 `num_redelivered`。
- 毒消息：查看 `DAOYOU_DOMAIN_EVENT_DLQ`，subject 为 `daoyou.dead-letter.<consumer-name>`。
- 后台命令失败：查看 `DAOYOU_BACKGROUND_COMMAND_DLQ`，subject 为 `daoyou.command-dead-letter.background-command-worker-v1`。
- 回放归档积压：查看 `DAOYOU_COMBAT_V6_REPLAY_ARCHIVES` 的 `combat-v6-replay-postgres-archiver-v1` consumer，并核对 Redis replay outbox 与归档日志。
- 手工重放前必须确认 `wanjiedaoyou_message_consumptions` 中对应消费记录是否仍存在；消费记录保留 30 天，长于主 Stream 的 14 天保留期。

## 事件演进规则

- 事件名称使用已发生事实的过去式，不使用 `apply`、`update`、`process` 等命令式名称。
- 不兼容 payload 变更必须创建新的事件版本和 subject，旧版本消费者独立退役。
- 新事件在业务数据的同一 PostgreSQL 事务中写入通用事务消息表。
- 消费者必须写入通用消费幂等记录，禁止只依赖 JetStream 去重。原因是 PostgreSQL 提交成功但 ACK 未到达 NATS 时仍会发生合法重投。
- NATS 消息携带完整事件，不发布数据库记录指针。
