# Combat Log System V5 设计文档

## 背景

Battle Engine V5 采用 GAS + EDA 架构，当前 `CombatLogSystem` 存在以下问题：

1. **构造函数副作用** - 在构造函数中直接订阅 EventBus，产生隐式依赖
2. **单例依赖** - 依赖全局 `EventBus.instance`，而非依赖注入
3. **职责混杂** - 同时负责收集事件、格式化消息、存储日志
4. **可测试性差** - 订阅和格式化耦合，难以单独测试
5. **日志分散** - 一次行动产生多条独立日志，阅读体验差

## 设计目标

1. **纯观察者模式** - 日志系统作为 EventBus 的被动订阅者
2. **分层架构** - 分离订阅、聚合、格式化职责
3. **Span 事务** - 将相关日志条目组织成逻辑单元
4. **双输出格式** - 同时支持结构化数据（Span）和聚合文案
5. **可测试性** - 支持完整集成测试

## 架构设计

### 整体架构

```
┌─────────────────────────────────────────────────────────────────┐
│                         EventBus                                 │
│  (DamageTakenEvent, HealEvent, BuffAppliedEvent, ...)          │
└────────────────────────┬────────────────────────────────────────┘
                         │ 订阅
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                     LogSubscriber                                │
│  - 监听事件，转换为 LogEntry                                     │
│  - 根据事件类型路由到当前活跃的 Span                             │
└────────────────────────┬────────────────────────────────────────┘
                         │ 写入
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                      LogAggregator                               │
│  - 管理 Span 生命周期（开始/结束）                               │
│  - 维护 Span 树结构                                              │
│  - 提供 Span 查询接口                                            │
└────────────────────────┬────────────────────────────────────────┘
                         │ 格式化
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                      LogFormatter                                │
│  - Span → 结构化数据 (JSON)                                      │
│  - Span → 聚合文案 (文本)                                        │
│  - 支持多种输出格式                                               │
└─────────────────────────────────────────────────────────────────┘
```

### 文件结构

```
engine/battle-v5/
└── systems/
    └── log/
        ├── index.ts              # 导出
        ├── types.ts              # 类型定义
        ├── LogSubscriber.ts      # 事件订阅器
        ├── LogAggregator.ts      # Span 聚合器
        ├── LogFormatter.ts       # 格式化器
        ├── formatters/           # 具体格式化实现
        │   ├── JsonFormatter.ts  # JSON 格式
        │   └── TextFormatter.ts  # 文本格式
        └── CombatLogSystem.ts    # 门面类（兼容现有 API）
```

## 核心类型

### LogEntry（日志条目）

最小日志单位，对应单个事件。

```typescript
interface LogEntry {
  id: string;

  // 条目类型
  type:
    | 'damage'        // 伤害
    | 'heal'          // 治疗
    | 'shield'        // 护盾
    | 'buff_apply'    // Buff 应用
    | 'buff_remove'   // Buff 移除
    | 'buff_immune'   // Buff 免疫
    | 'dodge'         // 闪避
    | 'resist'        // 抵抗
    | 'death'         // 死亡
    | 'mana_burn'     // 焚元
    | 'resource_drain'// 资源夺取
    | 'dispel'        // 驱散
    | 'reflect'       // 反伤
    | 'tag_trigger'   // 标签触发
    | 'death_prevent' // 免死
    | 'skill_cast'    // 技能释放
    | 'skill_interrupt' // 技能打断
    | 'cooldown_modify'; // 冷却修改

  // 结构化数据（供 AI 消费、前端渲染）
  data: {
    caster?: { id: string; name: string };
    target: { id: string; name: string };
    ability?: { id: string; name: string };
    buff?: { id: string; name: string; type: 'buff' | 'debuff' | 'control' };
    value?: number;
    isCritical?: boolean;
    isLethal?: boolean;
    [key: string]: unknown;
  };

  // 格式化文案（供展示）
  message: string;

  // 是否高亮
  highlight: boolean;
}
```

### LogSpan（日志事务）

将相关的 LogEntry 组织成逻辑单元。

```typescript
interface LogSpan {
  id: string;

  // Span 类型
  type:
    | 'action'        // 主动行动（普攻/技能释放）
    | 'action_pre'    // 行动前置（DOT/持续效果触发，在角色正式行动之前）
    | 'round_start'   // 回合开始
    | 'battle_init'   // 战斗初始化
    | 'battle_end';   // 战斗结束

  // 回合数
  turn: number;

  // 行动来源（round_settle 等系统事件没有）
  source?: { id: string; name: string };

  // Span 标题
  title: string;

  // 包含的日志条目
  entries: LogEntry[];

  // 聚合文案（由 Formatter 生成）
  summary?: string;

  // 时间戳
  timestamp: number;
}
```

### CombatLogResult（战斗日志结果）

整场战斗的日志汇总。

```typescript
interface CombatLogResult {
  // 战斗 ID
  battleId: string;

  // 所有 Span
  spans: LogSpan[];

  // 按回合分组
  byTurn: Map<number, LogSpan[]>;

  // 全局聚合文案
  fullText: string;

  // 战斗元数据
  metadata: {
    winner: string;
    loser: string;
    turns: number;
    duration: number;
  };
}
```

## 组件设计

### LogSubscriber

**职责**：订阅 EventBus 事件，转换为 LogEntry。

```typescript
class LogSubscriber {
  private _handlers: Map<string, EventHandler> = new Map();

  constructor(private _aggregator: LogAggregator) {}

  // 显式订阅（由外部控制生命周期）
  subscribe(eventBus: EventBus): void;

  // 取消订阅
  unsubscribe(eventBus: EventBus): void;

  // 事件转换方法
  private _onDamageTaken(event: DamageTakenEvent): void;
  private _onHeal(event: HealEvent): void;
  private _onBuffApplied(event: BuffAppliedEvent): void;
  // ... 其他事件类型
}
```

**关键设计点**：
- 不在构造函数中订阅，由外部显式调用 `subscribe()`
- 每个事件类型有独立的转换方法
- 转换后的 LogEntry 写入 LogAggregator

### LogAggregator

**职责**：管理 Span 生命周期，聚合 LogEntry。

```typescript
class LogAggregator {
  private _spans: LogSpan[] = [];
  private _activeSpan: LogSpan | null = null;
  private _turn: number = 0;

  // ===== Span 生命周期 =====

  // 开始行动 Span
  beginActionSpan(caster: Unit, ability: Ability): void;

  // 开始行动前置 Span（DOT/持续效果触发）
  beginActionPreSpan(unit: Unit): void;

  // 开始回合开始 Span
  beginRoundStartSpan(turn: number): void;

  // 开始战斗初始化 Span
  beginBattleInitSpan(player: Unit, opponent: Unit): void;

  // 开始战斗结束 Span
  beginBattleEndSpan(winner: Unit, turns: number): void;

  // 添加日志条目
  addEntry(entry: LogEntry): void;

  // 结束当前 Span
  endSpan(): void;

  // ===== 查询接口 =====

  // 获取所有 Span
  getSpans(): LogSpan[];

  // 按回合获取 Span
  getSpansByTurn(turn: number): LogSpan[];

  // 清空
  clear(): void;
}
```

**Span 路由逻辑**：

| 事件 | 触发动作 |
|------|---------|
| `ActionEvent` | 开始 action Span（普攻） |
| `SkillCastEvent` | 开始 action Span（技能） |
| `ActionPreEvent` | 开始 action_pre Span（DOT/持续效果） |
| `RoundStartEvent` | 开始 round_start Span |
| `BattleInitEvent` | 开始 battle_init Span |
| `BattleEndEvent` | 开始 battle_end Span |
| `DamageTakenEvent` 等 | 添加 entry 到当前 Span |
| 收到下一个开始事件 | 结束当前活跃 Span |

### LogFormatter

**职责**：将 Span 格式化为不同输出格式。

```typescript
interface LogFormatter {
  // 格式化单个 Span
  formatSpan(span: LogSpan): string;

  // 格式化整场战斗
  formatResult(result: CombatLogResult): string;
}

class TextFormatter implements LogFormatter {
  formatSpan(span: LogSpan): string {
    // 生成文本格式的 Span 摘要
  }

  formatResult(result: CombatLogResult): string {
    // 生成完整的战报文本
  }
}

class JsonFormatter implements LogFormatter {
  formatSpan(span: LogSpan): string {
    // 生成 JSON 字符串
  }

  formatResult(result: CombatLogResult): string {
    // 生成完整的 JSON
  }
}
```

### CombatLogSystem（门面类）

保持与现有 API 的兼容性。

```typescript
class CombatLogSystem {
  private _subscriber: LogSubscriber;
  private _aggregator: LogAggregator;
  private _formatter: LogFormatter;

  constructor() {
    this._aggregator = new LogAggregator();
    this._subscriber = new LogSubscriber(this._aggregator);
    this._formatter = new TextFormatter();
  }

  // 显式订阅 EventBus
  subscribe(eventBus: EventBus): void {
    this._subscriber.subscribe(eventBus);
  }

  // 取消订阅
  unsubscribe(eventBus: EventBus): void {
    this._subscriber.unsubscribe(eventBus);
  }

  // 兼容现有 API
  log(turn: number, phase: CombatPhase, message: string): void;
  logHighlight(turn: number, message: string): void;
  getLogs(): CombatLogEntry[];
  getSimpleLogs(): CombatLogEntry[];
  generateReport(simple?: boolean): string;

  // 新增 API
  getSpans(): LogSpan[];
  getResult(): CombatLogResult;

  // 清理
  clear(): void;
  destroy(): void;
}
```

## 事件到 Span 的映射

### 行动类事件（有施法者）

| 事件 | Span 类型 | Entry 类型 |
|------|----------|-----------|
| `SkillCastEvent` | action | skill_cast |
| `HitCheckEvent` (dodge) | action | dodge |
| `HitCheckEvent` (resist) | action | resist |
| `DamageTakenEvent` | action | damage |
| `HealEvent` | action | heal |
| `BuffAppliedEvent` | action | buff_apply |
| `BuffRemovedEvent` | action | buff_remove |
| `BuffImmuneEvent` | action | buff_immune |
| `ShieldEvent` | action | shield |
| `ManaBurnEvent` | action | mana_burn |
| `ResourceDrainEvent` | action | resource_drain |
| `DispelEvent` | action | dispel |
| `ReflectEvent` | action | reflect |
| `TagTriggerEvent` | action | tag_trigger |
| `DeathPreventEvent` | action | death_prevent |
| `UnitDeadEvent` | action | death |
| `SkillInterruptEvent` | action | skill_interrupt |
| `CooldownModifyEvent` | action | cooldown_modify |

### 系统类事件

| 事件 | Span 类型 | 说明 |
|------|----------|------|
| `RoundStartEvent` | round_start | 回合开始 |
| `ActionPreEvent` | action_pre | DOT/持续效果触发（角色正式行动之前） |
| `BattleInitEvent` | battle_init | 战斗初始化 |
| `BattleEndEvent` | battle_end | 战斗结束 |

**关键点**：
- DOT 伤害（`DamageTakenEvent` 中 `buff` 字段存在）归入 `action_pre` Span
- `action_pre` 在角色行动之前触发，表示持续效果的自动结算

### 不记录日志的事件

以下事件存在于 EventBus 中，但**不生成日志条目**（设计决策）：

| 事件 | 原因 |
|------|------|
| `TurnOrderEvent` | 行动顺序是内部逻辑，对玩家不可见 |
| `DestinyAwakenEvent` | 命格觉醒由其他系统处理，不在战斗日志中展示 |
| `VictoryCheckEvent` | 胜负判定结果由 `BattleEndEvent` 体现 |
| `DamageRequestEvent` | 伤害计算中间态，不对外展示 |
| `DamageEvent` | 伤害应用中间态，最终结果由 `DamageTakenEvent` 体现 |
| `TagAddedEvent` / `TagRemovedEvent` | 标签变更由具体效果日志体现（如 `TagTriggerEvent`） |
| `BuffAddEvent` | Buff 添加中间态，最终结果由 `BuffAppliedEvent` 或 `BuffImmuneEvent` 体现 |

## 输出示例

### Span 结构（前端渲染用）

```json
{
  "id": "span_001",
  "type": "action",
  "turn": 3,
  "source": { "id": "player_1", "name": "林轩" },
  "title": "林轩 施放【火球术】",
  "entries": [
    {
      "id": "entry_001",
      "type": "damage",
      "data": {
        "caster": { "id": "player_1", "name": "林轩" },
        "target": { "id": "enemy_1", "name": "魔狼" },
        "ability": { "id": "fireball", "name": "火球术" },
        "value": 150,
        "isCritical": true
      },
      "message": "【暴击】林轩 使用【火球术】对魔狼造成 150 点伤害！",
      "highlight": true
    },
    {
      "id": "entry_002",
      "type": "buff_apply",
      "data": {
        "caster": { "id": "player_1", "name": "林轩" },
        "target": { "id": "enemy_1", "name": "魔狼" },
        "buff": { "id": "burn", "name": "灼烧", "type": "debuff" }
      },
      "message": "魔狼 获得「灼烧」(3回合)",
      "highlight": false
    }
  ],
  "summary": "林轩 施放火球术，暴击造成 150 点伤害，并施加灼烧",
  "timestamp": 1711450000000
}
```

### 聚合文案（简单展示/AI 用）

```
【战斗开始】
林轩（炼气圆满） VS 魔狼（筑基初期）

【第1回合】
林轩 先手行动，使用【火球术】造成 120 点伤害，并施加「灼烧」效果。
魔狼 反击，造成 45 点伤害。

【第2回合】
持续效果触发：魔狼 受到灼烧伤害 25 点。
魔狼 先手行动，造成 50 点伤害。
林轩 使用【治疗术】恢复 80 点气血。

【第3回合】
持续效果触发：魔狼 受到灼烧伤害 30 点，气血耗尽被击败！

【战斗结束】
林轩 获胜！战斗持续 3 回合。
```

## 与 BattleEngineV5 的集成

### 初始化

```typescript
class BattleEngineV5 {
  private _logSystem: CombatLogSystem;

  constructor(player: Unit, opponent: Unit) {
    // 创建日志系统
    this._logSystem = new CombatLogSystem();

    // 显式订阅 EventBus
    this._logSystem.subscribe(EventBus.instance);

    // ... 其他初始化
  }
}
```

### 销毁

```typescript
class BattleEngineV5 {
  destroy(): void {
    // 取消订阅，清理资源
    this._logSystem.unsubscribe(EventBus.instance);
    this._logSystem.destroy();
  }
}
```

### 生成结果

```typescript
class BattleEngineV5 {
  private generateResult(): BattleResult {
    const context = this.getContext();

    return {
      winner: context.winner,
      loser: context.loser,
      turns: context.turn,
      // 获取完整日志结果
      logs: this._logSystem.getResult().fullText,
      // 新增：结构化日志
      logSpans: this._logSystem.getSpans(),
      // ...
    };
  }
}
```

## 测试策略

### 单元测试

1. **LogEntry 转换测试**
   - 测试每个事件类型到 LogEntry 的转换
   - 验证 data 结构和 message 格式

2. **LogAggregator 测试**
   - 测试 Span 生命周期管理
   - 测试 Entry 添加和路由
   - 测试按回合查询

3. **LogFormatter 测试**
   - 测试文本格式化输出
   - 测试 JSON 格式化输出

### 集成测试

1. **完整战斗流程测试**
   - 执行完整战斗
   - 验证 Span 数量和结构
   - 验证日志内容正确性

2. **特殊场景测试**
   - DOT 伤害归入 action_pre（角色行动之前）
   - 暴击/闪避/抵抗等特殊日志
   - 连续行动的 Span 隔离

## 迁移计划

### Phase 1: 新建分层结构

1. 创建 `log/` 目录和类型定义
2. 实现 LogAggregator
3. 实现 LogSubscriber
4. 实现 LogFormatter

### Phase 2: 实现门面类

1. 创建新的 CombatLogSystem（门面类）
2. 保持现有 API 兼容
3. 添加新 API

### Phase 3: 集成测试

1. 编写集成测试
2. 验证与现有战斗流程的兼容性
3. 验证日志输出格式

### Phase 4: 替换

1. 在 BattleEngineV5 中使用新系统
2. 移除旧的 CombatLogSystem
3. 更新相关测试

## 风险和缓解

| 风险 | 缓解措施 |
|------|---------|
| API 不兼容 | 门面类保持现有 API |
| 性能影响 | 初期不做对象池优化，如有性能问题再优化 |
| 内存占用 | 初期不做流式输出，战斗日志量可控（单场战斗 < 1000 条） |
| 测试覆盖 | 每个组件独立测试 + 集成测试 |

**关于性能优化的说明**：

- **对象池**：当前战斗规模下不需要。单场战斗 Span 数量通常 < 100，Entry 数量 < 500，GC 压力可忽略。
- **流式输出**：当前设计是战斗结束后一次性获取结果。如需实时推送日志到前端，可通过 `LogAggregator` 的 `onSpanComplete` 回调实现，但不在本期范围内。
