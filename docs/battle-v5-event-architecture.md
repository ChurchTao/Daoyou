# battle-v5 结算事件架构重构

## 目标

战斗引擎必须区分行动、技能施放、命中和伤害段。被动触发语义只能绑定到明确的结算层级，不能把每个伤害段都隐式视为一次完整受击。

本次重构不保留旧事件兼容层。迁移完成后，旧的 `DamageSegmentAppliedEvent`、`DamageSegmentPreparedEvent` 和依赖 marker 去重的监听器实现必须从运行时代码中删除。

## 结算层级

```text
Action
└── AbilityCast
    └── Hit
        ├── DamageSegment 1
        ├── DamageSegment 2
        └── DamageSegment N
```

每次运行中的 Action、Cast、Hit 都必须拥有稳定的运行时 ID。伤害段只能引用所属的 `hitId`，不能自行创建新的技能或行动语义。

## 新事件链

```text
ActionStarted
  → AbilityCastStarted
    → HitResolved
      → DamageSegmentRequested
      → DamageSegmentApplied
      → HitSettled
    → AbilityCastSettled
  → ActionFinished
```

事件职责：

- `DamageSegmentRequested`：请求一段伤害，允许修改最终数值。
- `DamageSegmentApplied`：护盾、免疫和气血结算完成后的不可变结果。
- `HitSettled`：一次命中的所有伤害段都已完成。
- `AbilityCastSettled`：一次技能对所有目标的命中都已完成。

## 触发粒度

监听器必须显式声明触发层级：

- `segment`：每个伤害段一次。
- `hit`：每次命中一次。
- `cast`：每次技能施放一次。
- `action`：每次行动一次。
- `round`：每回合一次。
- `battle`：每场战斗一次。
- `buff_lifetime`：当前 Buff 生命周期一次。

监听器的“条件判断”和“触发 claim”必须在任何效果执行前完成，并由统一 Trigger Ledger 原子记录。marker 只能作为可见状态，不能承担幂等控制职责。

## 重入规则

状态改变型反应不得在当前事件监听器执行栈内递归结算。监听器产生的反伤、追击、治疗和 Buff 变更先进入当前结算帧的 reaction queue；当前事件的监听器全部结束后，再按优先级、因果链和入队序号处理。

## 分阶段实施与验收

### 阶段 0：契约冻结

- 固化上述层级、ID、事件职责和不变量。
- 盘点所有旧事件、旧 listener 和 marker 去重点。
- 验收：架构文档与代码盘点结果一致；未开始迁移实现。

### 阶段 1：运行时上下文与新事件链

- 新增 Action/Cast/Hit/Segment 上下文和事件类型。
- 让主动技能、DOT、反伤、追击统一创建上下文。
- 将 DamageSystem 改为只产生新事件。
- 验收：多段技能能观测到同一 `castId/hitId` 和递增 `segmentIndex`；未迁移模块只能暂时保留旧事件引用，且不得新增旧事件生产者。

### 阶段 2：Trigger Ledger

- 新增统一的原子 claim 存储。
- 所有监听器改用显式 trigger policy。
- 删除 listener budget 的分散实现和 marker 去重逻辑。
- 验收：多段、嵌套反伤、追击矩阵中每种粒度严格只触发规定次数。

### 阶段 3：Reaction Queue

- 将状态改变型反应从同步递归调用改为结算帧队列。
- 固化优先级、因果链和队列顺序。
- `EffectExecutionContext.emit()` 产生的二级事件统一进入 `ReactionQueue`；当前事件的所有订阅者返回后才开始排队事件。
- 队列按 `priority desc + enqueueOrdinal asc` 排序，并保留原事件的 `parentEventId`；超过 1024 个反应步骤直接终止并报告 `BATTLE_REACTION_LIMIT_EXCEEDED`。
- 验收：不存在未完成监听器栈内的嵌套状态结算；反伤/追击结果稳定可复现；队列优先级、FIFO 和因果父链有专门测试覆盖。

### 阶段 4：旧架构清除

- 删除旧事件、旧字段、旧 listener budget、旧 marker 控制逻辑和未使用适配器。
- 更新所有词条、身体修炼、宗门内容和测试。
- 验收：架构扫描不得出现旧事件名、旧字段或兼容分支。

### 阶段 5：全量验收

- 共享引擎测试、类型检查、lint、构建。
- 多段伤害、护盾、免死、吸血、反伤、追击、DOT 和多目标回归矩阵。
- 验收：所有检查通过，并保留可审计的事件序列与触发 claim 记录。

## 不变量

1. 一个伤害段只能属于一个 `hitId`。
2. 一个 `hitId` 的 `segmentIndex` 从 0 开始且不重复。
3. 同一 `castId` 下的多段伤害不能自动产生多个 cast 级触发。
4. 触发 claim 必须先于效果执行。
5. 事件处理顺序不能依赖订阅者注册顺序以外的隐式副作用。
6. 运行时代码不得通过旧事件名或兼容适配器重新解释新事件。
7. 同一 `hitId`、同一伤害来源的某一伤害段触发免死后，剩余伤害段不得继续消耗其他免死来源；保护只覆盖该伤害流，反伤、延迟伤害等二级来源仍独立结算。
8. 未造成气血或护盾变化的伤害段不得发布 `DamageSegmentAppliedEvent`，避免零结果继续触发受击反应链。
