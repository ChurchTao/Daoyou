# Combat Log System Refactor Design

## 概述

重构战斗日志系统，实现"既精简又完备"的目标：
- **精简**：一次行动 = 一行聚合文案
- **完备**：数值完整 + 因果链 + 时序

## 需求总结

| 维度 | 需求 |
|------|------|
| **消费者** | 玩家（战斗后复盘）+ AI（生成战报输入） |
| **精简** | 单行聚合，一次行动一行 |
| **完备** | 数值完整 + 因果链 + 时序 |
| **格式** | 带上下文的语义化描述，AI 润色 |
| **聚合边界** | 按行动聚合（一次技能施放的所有效果） |
| **当前问题** | 冗余重复、缺少上下文 |
| **因果展示** | 扁平列出，通过数据字段关联 |

## 架构设计

### 文件结构

```
engine/battle-v5/systems/log/
├── types.ts              # 类型定义（强类型）
├── LogCollector.ts       # 事件收集器
├── LogAggregator.ts      # Span 生命周期管理
├── LogPresenter.ts       # 多视图输出
├── CombatLogSystem.ts    # 门面（简化）
└── index.ts
```

### 组件职责

| 组件 | 职责 | 输入 | 输出 |
|------|------|------|------|
| `LogCollector` | 监听 EventBus，转换为结构化 LogEntry | CombatEvent | LogEntry |
| `LogAggregator` | 管理 Span 生命周期，Entry 分组 | LogEntry | LogSpan[] |
| `LogPresenter` | 聚合文案生成，多视图输出 | LogSpan[] | Text/JSON |
| `CombatLogSystem` | 门面，协调组件 | - | - |

### 数据流

```
EventBus
   │
   ▼
LogCollector.subscribe()
   │
   ▼ LogEntry (纯数据，无message)
LogAggregator.addEntry()
   │
   ▼ LogSpan (分组后)
LogPresenter.present()
   │
   ├─► getPlayerView()  → 精简聚合文案
   ├─► getAIView()      → 结构化 JSON
   └─► getDebugView()   → 完整调试数据
```

## 数据模型

### LogEntry 强类型设计

```typescript
// 日志条目类型
export type LogEntryType =
  | 'damage'
  | 'heal'
  | 'shield'
  | 'buff_apply'
  | 'buff_remove'
  | 'buff_immune'
  | 'dodge'
  | 'resist'
  | 'death'
  | 'mana_burn'
  | 'resource_drain'
  | 'dispel'
  | 'reflect'
  | 'tag_trigger'
  | 'death_prevent'
  | 'skill_cast';

// 各类型数据定义
export interface DamageEntryData {
  value: number;
  remainHp: number;
  isCritical: boolean;
  isLethal: boolean;
  targetName: string;
  sourceBuff?: string;
  shieldAbsorbed?: number;
  remainShield?: number;
}

export interface HealEntryData {
  value: number;
  remainHp: number;
  targetName: string;
}

export interface ShieldEntryData {
  value: number;
  targetName: string;
}

export interface BuffApplyEntryData {
  buffName: string;
  buffType: 'buff' | 'debuff' | 'neutral';
  targetName: string;
  duration: number;
}

export interface BuffRemoveEntryData {
  buffName: string;
  targetName: string;
  reason: 'manual' | 'expired' | 'dispel' | 'replace';
}

export interface BuffImmuneEntryData {
  buffName: string;
  targetName: string;
}

export interface DodgeEntryData {
  targetName: string;
}

export interface ResistEntryData {
  targetName: string;
}

export interface DeathEntryData {
  targetName: string;
  killerName?: string;
}

export interface ManaBurnEntryData {
  value: number;
  targetName: string;
}

export interface ResourceDrainEntryData {
  value: number;
  drainType: 'hp' | 'mp';
  targetName: string;
}

export interface DispelEntryData {
  buffs: string[];
  targetName: string;
}

export interface ReflectEntryData {
  value: number;
  targetName: string;
}

export interface TagTriggerEntryData {
  tag: string;
  targetName: string;
}

export interface DeathPreventEntryData {
  targetName: string;
}

export interface SkillCastEntryData {
  skillName: string;
}

// 类型映射
export interface EntryDataMap {
  damage: DamageEntryData;
  heal: HealEntryData;
  shield: ShieldEntryData;
  buff_apply: BuffApplyEntryData;
  buff_remove: BuffRemoveEntryData;
  buff_immune: BuffImmuneEntryData;
  dodge: DodgeEntryData;
  resist: ResistEntryData;
  death: DeathEntryData;
  mana_burn: ManaBurnEntryData;
  resource_drain: ResourceDrainEntryData;
  dispel: DispelEntryData;
  reflect: ReflectEntryData;
  tag_trigger: TagTriggerEntryData;
  death_prevent: DeathPreventEntryData;
  skill_cast: SkillCastEntryData;
}

// 统一 Entry 结构
export interface LogEntry<T extends LogEntryType = LogEntryType> {
  id: string;
  type: T;
  data: EntryDataMap[T];
  timestamp: number;
}
```

### LogSpan 结构

```typescript
export type LogSpanType =
  | 'action'
  | 'action_pre'
  | 'round_start'
  | 'battle_init'
  | 'battle_end';

export interface LogSpan {
  id: string;
  type: LogSpanType;
  turn: number;
  actor?: { id: string; name: string };
  ability?: { id: string; name: string };
  entries: LogEntry[];
  timestamp: number;
}
```

## LogCollector 设计

**职责**：监听 EventBus 事件，转换为结构化 LogEntry，不生成文案。

```typescript
export class LogCollector {
  private _aggregator: LogAggregator;
  private _handlers: Map<string, (event: any) => void> = new Map();

  constructor(aggregator: LogAggregator) {
    this._aggregator = aggregator;
  }

  subscribe(eventBus: EventBus): void {
    // Span 管理事件（高优先级）
    this._addHandler(eventBus, 'BattleInitEvent', (e) => {
      this._aggregator.beginSpan('battle_init', { turn: 0 });
    }, EventPriorityLevel.ACTION_TRIGGER + 1);

    this._addHandler(eventBus, 'SkillCastEvent', (e) => {
      this._aggregator.beginSpan('action', {
        turn: this._aggregator.currentTurn,
        actor: { id: e.caster.id, name: e.caster.name },
        ability: { id: e.ability.id, name: e.ability.name },
      });
    }, EventPriorityLevel.ACTION_TRIGGER + 1);

    // 数据收集事件（默认优先级）
    this._addHandler(eventBus, 'DamageTakenEvent', (e) => {
      this._aggregator.addEntry({
        id: generateId(),
        type: 'damage',
        data: {
          value: Math.round(e.damageTaken),
          remainHp: Math.round(e.remainHealth),
          isCritical: e.isCritical ?? false,
          isLethal: e.isLethal,
          targetName: e.target.name,
          sourceBuff: e.buff?.name,
          shieldAbsorbed: e.shieldAbsorbed,
          remainShield: e.remainShield,
        },
        timestamp: Date.now(),
      });

      if (e.isLethal) {
        this._aggregator.addEntry({
          id: generateId(),
          type: 'death',
          data: {
            targetName: e.target.name,
            killerName: e.caster?.name,
          },
          timestamp: Date.now(),
        });
      }
    });

    // ... 其他事件处理
  }

  unsubscribe(eventBus: EventBus): void {
    for (const [type, handler] of this._handlers) {
      eventBus.unsubscribe(type, handler);
    }
    this._handlers.clear();
  }
}
```

**关键点**：
- 只收集结构化数据，不生成 message
- data 字段严格按类型定义
- 击杀作为独立 entry 记录

## LogPresenter 聚合逻辑

**职责**：将 Span 内的多个 Entry 聚合成一行人类可读的文案。

### 聚合规则

| 场景 | 输出示例 |
|------|----------|
| 普攻命中 | `张三发起攻击，对李四造成 100 点伤害` |
| 普攻暴击 | `张三发起攻击，对李四造成 150 点伤害（暴击！）` |
| 普攻+破盾 | `张三发起攻击，对李四造成 100 点伤害（抵扣护盾 50 点，护盾已破碎）` |
| 技能+Buff | `张三施放【火球术】，对李四造成 80 点伤害并施加「灼烧」` |
| 技能+击杀 | `张三施放【致命一击】，对李四造成 200 点伤害，李四被击败！` |
| 被闪避 | `张三施放【火球术】，被目标闪避了！` |
| DOT触发 | `【持续】李四身上的「毒」发作，造成 50 点伤害` |

### 核心方法

```typescript
export class LogPresenter {
  formatSpan(span: LogSpan): string {
    if (span.entries.length === 0) {
      return this.formatEmptySpan(span);
    }

    switch (span.type) {
      case 'battle_init':
        return this.formatBattleInit(span);
      case 'battle_end':
        return this.formatBattleEnd(span);
      case 'round_start':
        return `【第 ${span.turn} 回合】`;
      case 'action_pre':
        return this.formatActionPre(span);
      case 'action':
        return this.formatAction(span);
      default:
        return '';
    }
  }

  private formatAction(span: LogSpan): string {
    const actor = span.actor?.name ?? '未知';
    const ability = span.ability;
    const entries = span.entries;

    const damage = this.findEntry(entries, 'damage');
    const buffApply = this.findEntry(entries, 'buff_apply');
    const dodge = this.findEntry(entries, 'dodge');
    const resist = this.findEntry(entries, 'resist');
    const death = this.findEntry(entries, 'death');

    const isBasicAttack = ability?.id === 'basic_attack';
    const actionDesc = isBasicAttack ? '发起攻击' : `施放【${ability?.name}】`;

    // 闪避/抵抗
    if (dodge || resist) {
      const reason = dodge ? '闪避' : '抵抗';
      return `${actor} ${actionDesc}，被目标${reason}了！`;
    }

    // 构建句子
    let result = `${actor} ${actionDesc}`;

    if (damage?.data.targetName) {
      result += `，对 ${damage.data.targetName}`;
    }

    if (damage) {
      result += ` 造成 ${damage.data.value} 点伤害`;
      if (damage.data.isCritical) result += '（暴击！）';
      if (damage.data.shieldAbsorbed && damage.data.shieldAbsorbed > 0) {
        result += `（抵扣护盾 ${Math.round(damage.data.shieldAbsorbed)} 点`;
        if (damage.data.remainShield && damage.data.remainShield <= 0) {
          result += '，护盾已破碎';
        }
        result += '）';
      }
    }

    if (buffApply && buffApply.data.targetName === damage?.data.targetName) {
      result += `并施加「${buffApply.data.buffName}」`;
    }

    if (death) {
      result += `，${death.data.targetName}被击败！`;
    }

    return result;
  }

  private formatActionPre(span: LogSpan): string {
    const actor = span.actor?.name ?? '未知';
    const damage = this.findEntry(span.entries, 'damage');

    if (damage && damage.data.sourceBuff) {
      let result = `【持续】${actor}身上的「${damage.data.sourceBuff}」发作`;
      result += `，造成 ${damage.data.value} 点伤害`;

      if (damage.data.shieldAbsorbed && damage.data.shieldAbsorbed > 0) {
        result += `（抵扣护盾 ${Math.round(damage.data.shieldAbsorbed)} 点）`;
      }

      return result;
    }

    return `${actor} 持续效果触发`;
  }

  // 辅助方法
  private findEntry<T extends LogEntryType>(
    entries: LogEntry[],
    type: T
  ): LogEntry<T> | undefined {
    return entries.find(e => e.type === type) as LogEntry<T> | undefined;
  }
}
```

## 多视图输出

### 玩家视图

```typescript
getPlayerView(spans: LogSpan[]): string[] {
  return spans
    .filter(span => span.entries.length > 0 || this._isStructuralSpan(span))
    .map(span => this.formatSpan(span))
    .filter(text => text.length > 0);
}
```

### AI 视图

```typescript
interface CombatLogAIView {
  spans: Array<{
    turn: number;
    type: LogSpanType;
    actor?: { id: string; name: string };
    ability?: { id: string; name: string };
    entries: Array<{ type: LogEntryType; data: unknown }>;
    description: string; // 语义化描述
  }>;
  summary: {
    totalDamage: number;
    totalHeal: number;
    criticalCount: number;
    deaths: string[];
  };
}

getAIView(spans: LogSpan[]): CombatLogAIView {
  return {
    spans: spans.map(span => ({
      turn: span.turn,
      type: span.type,
      actor: span.actor,
      ability: span.ability,
      entries: span.entries.map(e => ({ type: e.type, data: e.data })),
      description: this.formatSpan(span),
    })),
    summary: this.generateSummary(spans),
  };
}
```

### 调试视图

```typescript
getDebugView(spans: LogSpan[]): object {
  return {
    spans,
    eventCount: spans.reduce((sum, s) => sum + s.entries.length, 0),
  };
}
```

## CombatLogSystem 门面

```typescript
export class CombatLogSystem {
  private _collector: LogCollector;
  private _aggregator: LogAggregator;
  private _presenter: LogPresenter;

  constructor() {
    this._aggregator = new LogAggregator();
    this._collector = new LogCollector(this._aggregator);
    this._presenter = new LogPresenter();
  }

  // 生命周期
  subscribe(eventBus: EventBus): void;
  unsubscribe(eventBus: EventBus): void;
  clear(): void;
  destroy(): void;

  // 新 API
  getPlayerLogs(): string[];
  getAIData(): CombatLogAIView;
  getDebugData(): object;

  // 兼容旧 API（deprecated）
  /** @deprecated 使用 getPlayerLogs() */
  getLogs(): CombatLog[];
  /** @deprecated 使用 getPlayerLogs().join('\n') */
  generateReport(): string;
}
```

## 测试策略

### 测试文件结构

```
engine/battle-v5/tests/systems/log/
├── LogCollector.test.ts      # 数据收集测试
├── LogAggregator.test.ts     # Span分组测试
├── LogPresenter.test.ts      # 聚合逻辑测试
└── integration/
    └── FullLogFlow.test.ts   # 端到端测试
```

### 测试覆盖

1. **LogCollector 测试**
   - 各类型事件正确转换为 LogEntry
   - data 字段类型正确
   - 不生成 message

2. **LogAggregator 测试**
   - Span 正确开启/关闭
   - Entry 正确归属到当前 Span
   - 空白 Span 处理

3. **LogPresenter 测试**
   - 各种场景的聚合输出正确
   - 边界情况处理
   - 三种视图输出格式正确

4. **集成测试**
   - 完整战斗流程日志输出
   - 验证"一次行动一行"的聚合效果

## 改动清单

| 文件 | 操作 | 改动量 |
|------|------|--------|
| `types.ts` | 重写 | 中 |
| `LogCollector.ts` | 新增 | 大 |
| `LogAggregator.ts` | 重构 | 中 |
| `LogPresenter.ts` | 新增 | 大 |
| `CombatLogSystem.ts` | 简化 | 小 |
| `LogSubscriber.ts` | 删除 | - |
| `LogFormatter.ts` | 删除 | - |

## 设计亮点

1. **类型安全**：判别联合替代 any
2. **职责分离**：收集/分组/呈现 各司其职
3. **单行聚合**：一次行动 = 一行文案
4. **多视图输出**：玩家/AI/调试 三种视图
5. **向后兼容**：旧 API 标记 deprecated
