# 多人实时战斗架构 v2

本文是自研多人回合制战斗的当前约束，不是历史方案或迁移兼容说明。游戏尚未正式上线，旧 Redis runtime 和旧协议数据直接丢弃，不增加双轨兼容。

## 权威边界

1. Redis battle Hash 是进行中对局的唯一权威状态。
2. Redis ZSET、SET、反向占用索引均为可重建的派生索引。
3. NATS Core 只提供低延迟“状态已变化”通知，允许乱序、重复和永久丢失。
4. JetStream 承载必须最终完成的可靠任务，消息允许重复。
5. PostgreSQL 只保存完成后的持久回放，不参与房间和玩家释放。
6. WebSocket 只连接玩家客户端，不是消息队列，也不保存事件历史。

## 系统不变量

以下规则必须由运行时断言、Redis 原子提交或 E2E 证明，而不能只存在于 TypeScript 类型中：

1. 任意客户端命令都可重复提交；相同 requestId 和相同 payload 返回相同语义结果。
2. 任意 JetStream 任务都可重复投递；过期任务必须安全 ACK。
3. 任意 NATS Core 通知都可丢失；客户端必须在有限心跳周期内恢复到 Redis 权威快照。
4. 任意非终态必须在有限时间内推进或转为 `cancelled`。
5. `finished` 和 `cancelled` 是吸收态，不能返回活动状态。
6. 任意非终态均允许经过统一终止命令进入 `cancelled`。
7. 终态提交必须原子写入 terminal outbox；房间释放不得依赖回放归档。
8. 派生索引中的孤儿记录不能阻塞其他对局，且必须被对账器清理。
9. 同一个 commandSet 只能有一个结果成功 CAS；跨实例演算必须由可靠任务分配主要执行者。
10. 客户端动画不得修改权威战斗状态；Ready 只记录客户端演出完成，不改变权威演出边界。
11. Redis runtime 必须通过完整结构和状态不变量校验；损坏数据直接终止并清理，不迁移。
12. 任意进程可以在任意 `await` 之间退出，重启后仍必须最终推进或清理。

## 状态转换矩阵

| 当前状态 | 玩家接受 | 提交操作 | Ready | 截止时间 | 演算成功 | 演算失败 | 技术终止 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `waiting` | 全员后进入 `planning` | 拒绝 | 拒绝 | `cancelled/accept_timeout` | 拒绝 | 拒绝 | `cancelled` |
| `planning` | 幂等 | 收齐后进入 `resolving` | 拒绝 | 补默认操作并进入 `resolving` | 拒绝 | 拒绝 | `cancelled` |
| `resolving` | 拒绝 | 拒绝 | 拒绝 | 重新投递演算任务或超限终止 | `presenting` | 可重试或 `resolution_failed` | `cancelled` |
| `presenting` | 拒绝 | 拒绝 | 只记录客户端演出完成，不推进状态 | 到达 `scheduledEndsAt` 后进入下一回合或 `finished` | 拒绝 | 拒绝 | `cancelled` |
| `resolution_failed` | 拒绝 | 拒绝 | 拒绝 | 最大冻结时间后 `cancelled` | 管理重试后重新演算 | 幂等 | `cancelled` |
| `finished` | 幂等拒绝 | 拒绝 | 拒绝 | 无变化 | 无变化 | 无变化 | 无变化 |
| `cancelled` | 幂等拒绝 | 拒绝 | 拒绝 | 无变化 | 无变化 | 无变化 | 无变化 |

## 单一提交协议

业务规则在共享状态机中计算 next state。Redis Lua 只负责比较 storage revision，并在一次原子提交中完成：

- 写权威 runtime；
- 更新 deadline/waiting/resolving 派生索引；
- 增加需要的 `clientEventSeq`；
- 追加小型可靠任务 outbox；
- 在进入终态时写 terminal outbox。

业务代码不得直接删除活动对局 Hash 来表示状态转换，也不得在状态提交后临时决定是否写终态任务。

客户端命令幂等回执不嵌入 runtime。每场对局使用独立 Redis Hash，字段由 `playerId + requestId` 唯一确定；成功回执与状态 CAS 原子写入，拒绝回执只在 storage revision 未变化时以 `HSETNX` 写入。回执保存到对局生命周期结束，并在 terminal finalizer 中与对局状态使用相同 TTL 回收，因此不存在滚动窗口淘汰后旧 requestId 再次生效的问题，也不会让回执历史持续放大权威状态 payload。

参与者列表和邀请索引在创建对局的同一条 Lua 中生成；玩家接受时，权威 `acceptedPlayerIds`、参与者投影和邀请索引在同一次 CAS 中更新。终态 finalizer 按 cleanup manifest 删除所有邀请索引，因此进程在任意 `await` 退出都不会留下“权威状态已接受但访问投影仍未接受”或永久邀请残留。

完整回放同样不嵌入 battle Hash。各回合材料保存在 Redis replay-rounds 列表；终局 CAS 只原子写入 archive revision 指针。JetStream 消费者按 revision 从 Redis 读取初始状态、回合列表和最终状态后组装回放；terminal outbox 和玩家/房间释放可独立完成。 `finished` 对局的回放源材料在归档成功前不设置过期时间，归档确认后统一缩短 TTL；因此 PostgreSQL 或 NATS 长时间故障不会先删除唯一的回放源材料。客户端演出窗口另设序列化体积上限，为完整 snapshot 与 WebSocket envelope 预留空间。完整战报存放在独立 Redis presentation key，runtime 只保存 `match.presentation` 的 resultId、回合和服务端时间窗；生成结果时由同一条 CAS Lua 原子写入轻量 runtime 与战报 blob，离开 `presenting` 时原子删除。服务端在提交前还会按所有玩家构建完整 WebSocket snapshot 验证最终字节数。任一层超限都作为确定性演算失败进入有 deadline 的失败态，不能生成客户端永远无法接收的 `presenting` 状态。

演算任务的 Redis outbox 同时保存发布代际。JetStream `msgID` 由 taskId 与发布代际组成：同一次发布失败可安全去重；消息标记 published 后超过租约仍未被消费时，恢复器递增代际并重新进入 pending，避免落入 JetStream duplicate window 后永久丢任务。

对账器不能只扫描“当前仍在 pending 集合中的任务”，因为 pending 集合本身也是可丢失的派生索引。它会分别扫描权威 battle Hash、terminal outbox Hash 和 replay archive pointer Hash，重建活动调度、终态清理和回放归档 tracking。所有全局 SET/ZSET 在对账前校验 Redis 类型；错误类型直接删除后由权威 Hash 逐页重建。单场 battle、terminal outbox、presentation、replay pointer、replay source 或 arena 反向索引若变成错误 Redis 类型，也必须进入确定性的替换、终止或清理路径，不能成为永久重试的 poison item。

## 可靠任务

JetStream 消息只携带指针，不传完整 battle save、战报或回放：

```ts
type BattleTaskPointer = {
  matchId: string;
  storageRevision: number;
  taskType: 'resolve_round' | 'finalize_terminal' | 'archive_replay';
  commandSetId?: string;
};
```

消费者从 Redis 读取权威状态并校验 revision、status 和 commandSetId。任务已过期或已经完成时直接 ACK；当前任务幂等执行。

## 客户端同步

1. WebSocket 节点先建立 NATS 订阅并 flush，再读取初始 Redis 快照。
2. 状态 CAS 成功后只向 NATS Core 发布小型 `state_changed` 提示；提示只包含 `matchId/revision/eventSeq`，不携带 checkpoint、blueprint、战报或玩家视图。
3. WebSocket 节点收到提示后从 Redis 重新构建权威 snapshot；同一节点、同一 match 和 eventSeq 的并发连接共享一次 runtime/战报读取，再按玩家投影视图。
4. `time.pong` 只读取与 runtime CAS 同步维护的 `match_revision/client_event_seq` 和小型 participants 投影，不解析完整 runtime。
5. 客户端发现序号不一致立即发送 `battle.resume`。
6. 页面恢复前台时立即执行时间和序号校验。
7. 最后一条通知永久丢失时，客户端仍必须在一个心跳周期内恢复。

NATS Core 订阅的 ready 屏障在首次订阅和订阅监督器重建后都重新生效；`battle.resume` 读取快照前必须等待当前订阅已经完成 flush，避免在“旧 ready Promise 已完成、但新订阅尚未生效”的窗口永久漏掉快照之后的状态提示。

## 阶段验收门禁

每个重构阶段必须同时满足：

- 代码路径符合本文不变量；
- 针对性共享逻辑测试通过；
- Redis/NATS 行为由隔离 E2E 验证；
- `bun run lint`、`bun run build` 通过；
- `git diff --check` 通过；
- 未通过阶段验收前不得进入下一阶段。
