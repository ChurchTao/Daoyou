# combat-v6 Phase 7B：权威人物构筑持久化与 v6 训练房接入

> 状态：已实现（2026-09-04）

## 1. 阶段定位

Phase 7B 在 Phase 7A 纯逻辑 Encounter Host 之上补齐首个真实玩家纵切：当前活跃角色拥有独立、版本化的 combat-v6 构筑；服务端据此装配 `character_build_v5`，创建短生命周期权威训练会话；`/game/training-room` 只提交受限指令并展示服务端视图和事件。

本阶段不产生奖励、失败成本、condition 回写或正式战斗记录。会话仅存在于当前服务进程，重启或三十分钟无访问即失效。

## 2. 构筑权威

构筑以当前宗门 membership 为归属，profile 保存状态、revision、当前流派和经脉深度；六心法、两条经脉装配、节点、功法槽、道装实例和道装装配分别规范化持久化。道装内部不可变生成结果保留为经过 v6 编译器复核的 JSONB 快照。

数据库不保存 `LineupUnit`、最终面板、技能或被动。每次开战都由角色六维、condition 五轨、当前 active membership 的 v6 进度、v6 功法和 v6 道装重新投影。

## 3. 旧心法单次迁移

业务迁移只处理部署时处于 active 的红尘剑宗、幽都、无相禅宗、天衍圣地和九劫天宫 membership。迁移用显式三十项 ID 表按槽位搬运六心法等级；缺失值为零，等级受人物等级加十和 180 上限约束，五门分支心法不得超过主心法。

迁移后的 profile 为 `pending`，经脉深度为零，且不迁移旧流派、节点、技能栏、功法或装备。没有迁移 profile 的新 membership 在初始化时从六心法一级开始。

## 4. 一次性初始化

练功房读取模型区分 `uninitialized`、`pending` 和 `active`。前两种状态必须选择当前宗门的一条 v6 流派；初始化事务建立两条空经脉装配、空功法状态和空道装装配，并把 profile 激活。Phase 7B 不开放流派切换、升级和重置。

初始化产生 `player.combat-v6-build` cultivator-scope invalidate 事件，并通过统一玩家资源变更响应返回 revision 元数据。

## 5. 权威训练会话

客户端创建训练时只能提交遭遇 ID 和 60/120/180 档位。服务端安全生成 opaque session ID 与 seed，冻结人物构筑和 build revision，并强制使用 `full` 资源策略。每个角色同时最多一个会话；新建前必须显式结束旧会话。

提交、覆盖、推进和结束都校验 `expectedRevision`。revision 冲突不修改 Host、RNG、事件或指令。会话访问会续期；活跃 membership 改变会立即销毁旧会话。无权访问、未知和过期统一表现为 404。

会话视图只公开单位状态、只读指令选项、当前待执行指令和带单调 seq 的事件。完整 Phase 7A trace 只在非生产环境经认证读取，不构成持久录像协议。

## 6. 训练房表现

`/game/training-room` 原位替换为 v6 原生流程：无宗门阻断、一次性流派初始化、六类遭遇和三档选择、当前会话恢复、双方状态面板、服务端指令选项、显式推进及按回合组织的中文事件纪要。

页面不读取或转换旧 localStorage 训练预设，不复用 `BattleRecordV3` 播放器，也不建立 v6 到 battle-v5 的适配层。

## 7. 后续边界

Phase 7C 才处理普通任务 PVE 的奖励权威、失败成本和持久资源回写。Redis、checkpoint、断线重连、WebSocket、观战和正式录像继续属于后续在线战斗与协议阶段。
