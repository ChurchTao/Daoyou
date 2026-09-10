# V6停机切换操作单（Phase 10W）

2026-09-10。本文是待执行操作单，本轮仅完成本地验收和两个宗门脚本的零记录dry-run，未操作生产。验收结论见 [10W记录](./combat-v6-phase-10w-release-acceptance.md)。

## 1. 发布前准备

1. 补齐10W表中的核心待验项目，记录版本、环境、角色、请求/战斗ID和真实结果。未完成时维持待发布，不把健康检查当业务验收。
2. 固定候选提交、后端镜像digest和匹配的前端产物，留存上一版产物。当前工作流由tag触发构建并推送latest，不能只用可变latest指代候选版本；本操作单不触发构建、推送或上线。
3. 从目标数据库只读取得业务和Better Auth迁移账本，列出实际待执行SQL；分别使用 `drizzle.config.ts` 与 `drizzle.auth.config.ts`，不凭本地已迁移状态推断目标状态。
4. 在隔离副本演练待执行迁移和恢复，记录备份时间点及校验结果。现有迁移不能盲目重跑：0036会清空开发期V6回放；0039先搬迁V6装备身份/事实再删除旧装备实例表；0042校验旧经脉层ID并导入pending构筑养成。必须核对目标数据是否符合前提，异常不得绕过校验。
5. 0022属于更早的战绩表迁移，不与本次延期删除的三张表混同。本版保留 `wanjiedaoyou_battle_replay_archives`、`wanjiedaoyou_bet_battles`、`wanjiedaoyou_battle_records_v3`，下一发布版本才按 [历史表计划](./combat-v6-legacy-table-retirement.md) 删除。不要新增DROP或改写已发布迁移。
6. 准备具有候选源码、Bun、锁定依赖及迁移文件的维护工作目录。生产镜像只有dist，不能假定其中存在scripts、Drizzle配置或迁移目录。环境文件路径必须由发布人员明确填写，检查连接目标时不输出密钥。

## 2. 旧版本维护窗口

1. 入口进入维护状态，阻止普通玩家继续写入；保留维护人员访问旧版本的受控方式。记录维护开始时间，备份数据库和必要的Redis/NATS持久状态。
2. **先用旧版本将全部旧有效货单下架返还**，核对货单数、物品数量及返还邮件；新版本不提供旧货单兼容分支或批量撤单工具。不能仅清空货单表。未全部处理完禁止切换。
3. 核对旧赌战托管、待退还记录，按 [10D记录](./combat-v6-phase-10d-bet-retirement.md) 处理；已结束/已取消/已过期记录不得重复退款。保留历史与核对记录。
4. 盘点旧宗门战斗和道装委托。用户允许撤销未完成任务；已完成奖励、交付记录和历史继续保留。使用下节脚本前先完成旧版返还操作，再停止所有旧应用、旧定时任务及旧消费者，避免维护期间持续产生写入。
5. 按10H硬切决定关闭旧在线战斗运行链，不恢复V5消费者或另造结算兼容层。不执行全局Redis FLUSH或清空NATS；共享邮件、任务及其他消息不能随旧战斗一起删除。

## 3. 宗门任务盘点与撤销

以下命令是模板。先在受控维护终端设置 `RELEASE_ENV_FILE` 为已核对目标的绝对路径；本轮只运行过明确的 `env/local.env --dry-run`。

```bash
bun --env-file="$RELEASE_ENV_FILE" scripts/migrate-sect-task-battles-v6.ts --dry-run
bun --env-file="$RELEASE_ENV_FILE" scripts/retire-sect-artifact-deliveries.ts --dry-run
```

保存盘点输出及备份，逐条核对UUID后才执行。下例 `RECORD_ID_1` 必须是对应脚本盘点出的任务记录UUID，可追加明确核对的UUID；空列表不会允许apply。

```bash
bun --env-file="$RELEASE_ENV_FILE" scripts/migrate-sect-task-battles-v6.ts --apply "$RECORD_ID_1"
bun --env-file="$RELEASE_ENV_FILE" scripts/retire-sect-artifact-deliveries.ts --apply "$RECORD_ID_1"
```

两个命令的UUID列表必须分别准备，不能直接复用另一脚本的清单。

| 脚本 | 实际匹配/变更 | 必须额外核对 |
| --- | --- | --- |
| migrate-sect-task-battles-v6 | active、executorKey为sect.battle、battleTarget含旧combatant且activeBattleId为空；改abandoned释放领取次数 | **不覆盖有activeBattleId的旧战斗任务**。另列这些记录，核对旧运行态并形成精确撤销处置后才放行；不能以脚本0条宣称全部旧任务已处理 |
| retire-sect-artifact-deliveries | 匹配旧requirement.kind=artifact；active改abandoned，其余状态保持；移除旧requirement并改executorKey | 盘点包含历史状态。确认奖励快照、交付记录及其他payload字段保持，存档原始盘点供核对；不是简单“只改active记录” |

执行后重做dry-run，核对实际更新UUID、状态及奖励历史；不清空全部宗门任务，不另发领取费用补偿。未匹配的旧任务必须独立列明，不自动扩展脚本条件。

## 4. 配置与迁移

1. 依10V核对天骄宝阁、新手、任务、兑换码、广播等配置，停用不支持的商品及旧抽取专属生产入口。新代码拒绝的奖励可能导致整次发放失败，发现仍需生效的业务必须先明确用途和配置处理；不能静默丢附件或换物。
2. **旧 `gongfa_manual` / `skill_manual` 材料类型、现有生成能力与权重保持。** 不进行全材料库归档、不重分权重；既有专属符箓和秘籍暂不转换、不补偿。历史邮件及宝库库存不批量改写。
3. 旧写入者全部停止后，按已演练的迁移清单执行。仓库 `bun run db:migrate` 写死local.env，不能作为生产命令。下面仅是分别调用配置的形式，是否运行及顺序由实际待执行账本确定：

```bash
bun --env-file="$RELEASE_ENV_FILE" x drizzle-kit migrate --config=drizzle.auth.config.ts
bun --env-file="$RELEASE_ENV_FILE" x drizzle-kit migrate --config=drizzle.config.ts
```

4. 核对迁移账本、装备身份/数量/装配关联、构筑pending/active状态与宗门养成。迁移报错或数量不符即停止；不得直接手填账本或跳过校验继续开服。

## 5. 新版本启动与开服门槛

1. 新版本在维护状态下启动。核对DATABASE_URL、REDIS_URL、NATS_SERVERS/NATS_USER/NATS_PASSWORD的目标与权限；生产不得启用APP_ENV=local。认证、站点源及CRON_SECRET按现有部署配置核对。
2. `src/index.ts` 启动时注册消息基础设施，生产构建注册内部cron；不能把“尚未切流的新实例”理解为只读。现有 `scripts/blue-green-app.sh` 先起新实例再停旧实例，本次硬切必须提前确保旧写入者已停止，不能直接套用默认重叠运行顺序。
3. `/api/health-check` 应200，Redis、NATS、messaging均up。检查消息消费/重试错误、数据库错误和启动日志。健康检查不证明资源结算完成。
4. 仅由发布验收账号完成：登录与构筑读取、背包/宝库、单次物品流转、真实V6战斗胜利、settled及战后释放、回放读取、宗门领奖与重复请求拒绝；核对资产变化和结算收据。客户端产物需与API契约匹配。
5. 核对旧抽取和旧装配入口停用，新货单使用新版库存；确认旧有效货单为零、旧任务处置完成、没有新增DROP本版保留的三张历史表。记录最终核对人、时间及版本后再解除维护。

## 6. 失败处置

任一步发现资产不一致、重复结算、旧写入者仍运行、无法释放战斗占用、待执行迁移未经审查或核心证据缺失，保持维护状态。先停止候选写入者，保留日志和数据库/消息证据，定位具体失败步骤。

迁移或新版本已经产生写入后，不能仅把流量切回旧镜像。先核对schema与数据是否兼容；必要时按已演练的完整恢复方案恢复一致的数据库和相关持久消息状态，避免旧消息重放造成重复发奖。本文不授权实际恢复、删数据或上线操作。
