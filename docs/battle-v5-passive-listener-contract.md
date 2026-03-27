# Battle V5 Passive Listener Contract

本文档定义 battle-v5 中被动监听器（Passive + Buff 通用）的配置契约。

## 1. ListenerConfig 必填字段

- `eventType`: 监听事件名，对应 `CombatEvent.type`
- `scope`: 触发范围
- `priority`: 订阅优先级（数值越大越先执行）
- `effects`: 触发后执行的原子效果链

## 2. Scope 语义

- `owner_as_target`: 仅当 `event.target.id === owner.id` 时触发
- `owner_as_caster`: 仅当 `event.caster.id === owner.id` 时触发
- `owner_as_actor`: 语义等同于当前行动者为 owner（底层匹配 `event.caster`）
- `global`: 不限制 owner 与事件参与者关系

## 3. Mapping 语义

`mapping` 用于将事件参与者映射到效果上下文：

- `mapping.caster`: `owner | event.caster | event.target | event.source`
- `mapping.target`: `owner | event.caster | event.target | event.source`

未显式配置时，系统按 `eventType + scope` 推导默认 mapping。

## 4. Guard 语义

- `guard.requireOwnerAlive`: 是否要求 owner 存活
- `guard.allowLethalWindow`: 是否允许濒死窗口触发（常用于 `DamageTakenEvent` + 免死）
- `guard.skipReflectSource`: 反伤来源是否跳过（`damageSource === 'reflect'`）

## 5. 推荐配置模板

### 5.1 受击反制

```ts
{
  eventType: 'DamageTakenEvent',
  scope: 'owner_as_target',
  priority: 50,
  mapping: {
    caster: 'owner',
    target: 'event.caster',
  },
  guard: {
    requireOwnerAlive: false,
    allowLethalWindow: true,
    skipReflectSource: true,
  },
  effects: [/* ... */],
}
```

### 5.2 施法后追击

```ts
{
  eventType: 'SkillCastEvent',
  scope: 'owner_as_caster',
  priority: 70,
  mapping: {
    caster: 'owner',
    target: 'event.target',
  },
  effects: [/* ... */],
}
```

### 5.3 回合内自疗

```ts
{
  eventType: 'RoundPreEvent',
  scope: 'global',
  priority: 45,
  mapping: {
    caster: 'owner',
    target: 'owner',
  },
  effects: [/* ... */],
}
```

## 6. 已有回归用例

- 回合 mapping: `round trigger should honor explicit owner->owner mapping`
- 施法 mapping: `skill cast trigger should honor explicit owner->event.target mapping`
- 受击 mapping: `damage taken trigger should honor owner_as_target + event.caster mapping`
- 日志聚合: `mapping-driven counter mark should keep player log as single line`

详见测试文件：

- `engine/battle-v5/tests/integration/PassiveListenerMappingIntegration.test.ts`

## 7. 常见错误与排查清单

### 7.1 scope 缺失或错误

现象：工厂创建技能/Buff 时直接抛错，提示 listener 缺少 scope。

排查：

1. 检查配置是否显式填写 `scope`。
2. 对照事件语义确认 scope 是否匹配。
: `DamageTakenEvent` 通常使用 `owner_as_target`。
: `SkillCastEvent` 通常使用 `owner_as_caster`。

### 7.2 priority 配置不当导致时序异常

现象：日志顺序与预期不一致，或效果晚于关键事件执行。

排查：

1. 检查 listener 的 `priority` 是否与事件阶段一致。
2. 对照 `EventPriorityLevel` 选择合理数值。
: 受击反应建议不低于 `DAMAGE_TAKEN`。
: 回合前结算建议不低于 `ROUND_PRE`。

### 7.3 mapping 指向事件缺失字段

现象：效果目标错误，退化为作用在 owner 身上。

原因：当 `mapping` 指向不存在的事件字段时，运行时会回退到 owner。

排查：

1. 检查目标事件是否真的带有 `caster/target/source`。
2. 在回合事件上避免使用 `event.target` 或 `event.source` 作为关键目标。
3. 对于全局回合效果，优先使用 `owner -> owner` 的显式 mapping。

### 7.4 免死类效果未触发

现象：受击致死后未触发免死。

排查：

1. `scope` 是否为 `owner_as_target`。
2. guard 是否允许濒死窗口。
: `requireOwnerAlive: false`
: `allowLethalWindow: true`

### 7.5 反伤链式回弹

现象：反伤触发后继续反弹，出现异常连锁。

排查：

1. guard 中开启 `skipReflectSource: true`。
2. 确认效果实现对 `damageSource === 'reflect'` 有二次防护。

### 7.6 日志出现多行并非必然回归

现象：同一行动日志包含换行。

解释：当一个行动作用于多个目标时，玩家日志会按目标拆分为多行。

排查：

1. 确认是否是多目标语义导致（而非格式回归）。
2. 若业务要求单行，确保被动附加效果与主效果指向同一目标。
