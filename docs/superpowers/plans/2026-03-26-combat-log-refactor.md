# Combat Log Refactor Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 重构战斗日志系统，实现"一次行动一行"精简聚合输出

**Architecture:** 分离数据收集(LogCollector)、分组(LogAggregator)、呈现(LogPresenter)三层，门面模式协调

**Tech Stack:** TypeScript, Jest, EventBus (GAS+EDA)

---

## File Structure

```
engine/battle-v5/systems/log/
├── types.ts              # 强类型定义
├── LogAggregator.ts      # Span 生命周期管理（重构）
├── LogCollector.ts       # 事件收集器（新增）
├── LogPresenter.ts       # 聚合呈现（新增）
├── CombatLogSystem.ts    # 门面（简化）
├── index.ts              # 导出

engine/battle-v5/tests/systems/log/
├── LogAggregator.test.ts   # 已存在
├── LogCollector.test.ts   # 新增
├── LogPresenter.test.ts   # 新增
├── integration/
│   └── FullLogFlow.test.ts  # 新增
```

---

## Chunk 1: 类型定义

### Task 1: 重写 types.ts

**Files:**
- Modify: `engine/battle-v5/systems/log/types.ts`

- [ ] **Step 1: 写 types 测试**

```typescript
// tests/systems/log/types.test.ts
import { LogEntryType, EntryDataMap, LogEntry, LogSpan, LogSpanType } from '../systems/log/types';

describe('LogEntryType', () => {
  it('should define all entry types', () => {
    const types: LogEntryType[] = [
      'damage',
      'heal',
      'shield',
      'buff_apply',
      'buff_remove',
      'buff_immune',
      'dodge',
      'resist',
      'death',
      'mana_burn',
      'resource_drain',
      'dispel',
      'reflect',
      'tag_trigger',
      'death_prevent',
      'skill_cast',
      'skill_interrupt',
      'cooldown_modify',
    ];
    expect(types).toHaveLength(1);
  });
});

describe('EntryDataMap', () => {
  it('should map entry types to data interfaces', () => {
    const map: EntryDataMap = {
      damage: DamageEntryData,
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
      skill_interrupt: SkillInterruptEntryData;
      cooldown_modify: CooldownModifyEntryData;
    };
    expect(Object.keys(map)).toEqual([
      'damage',
      'heal',
      'shield',
      'buff_apply',
    ]);
  });
});

describe('LogEntry', () => {
  it('should have id, type, data, timestamp', () => {
    const entry: LogEntry = {
      id: 'test-entry-1',
      type: 'damage',
      data: { value: 100, remainHp: 50, isCritical: false, targetName: 'Target', sourceBuff: undefined, shieldAbsorbed: 0, remainShield: 0 },
      timestamp: Date.now(),
    };
    expect(entry.id).toBe('test-entry-1');
    expect(entry.type).toBe('damage');
    expect(entry.data).toEqual({ value: 100, remainHp: 50, isCritical: false, targetName: 'Target' });
    expect(entry.timestamp).toBeDefined();
  });
});
```

Run: `npm test engine/battle-v5/tests/systems/log/types.test.ts`
Expected: PASS

- [ ] **Step 2: 实现类型定义**

```typescript
// engine/battle-v5/systems/log/types.ts

// ===== LogEntryType =====
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
  | 'skill_cast'
  | 'skill_interrupt'
  | 'cooldown_modify';

// ===== Entry Data Interfaces =====
export interface DamageEntryData {
  value: number;
  remainHp: number;
  isCritical: boolean;
  targetName: string;
  sourceBuff?: string;
  shieldAbsorbed?: number;
  remainShield?: number;
}

export interface HealEntryData {
  value: number;
  remainHp: number;
  targetName: string;
  sourceBuff?: string;
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

export interface SkillInterruptEntryData {
  skillName: string;
  reason: string;
}

export interface CooldownModifyEntryData {
  value: number;
  affectedSkillName: string;
  targetName: string;
}

// ===== EntryDataMap =====
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
  skill_interrupt: SkillInterruptEntryData;
  cooldown_modify: CooldownModifyEntryData;
}

// ===== LogEntry =====
export interface LogEntry<T extends LogEntryType = LogEntryType> {
  id: string;
  type: T;
  data: EntryDataMap[T];
  timestamp: number;
}

// ===== LogSpanType =====
export type LogSpanType =
  | 'action'
  | 'action_pre'
  | 'round_start'
  | 'battle_init'
  | 'battle_end';

// ===== LogSpan =====
export interface LogSpan {
  id: string;
  type: LogSpanType;
  turn: number;
  actor?: { id: string; name: string };
  ability?: { id: string; name: string };
  entries: LogEntry[];
  timestamp: number;
}

// ===== 辅助类型 =====
export interface CombatLogSummary {
  totalDamage: number;
  totalHeal: number;
  criticalCount: number;
  deaths: string[];
  turns: number;
}

export interface CombatLogAIView {
  spans: Array<{
    turn: number;
    type: LogSpanType;
    actor?: { id: string; name: string };
    ability?: { id: string; name: string };
    entries: Array<{ type: LogEntryType; data: unknown }>;
    description: string;
  }>;
  summary: CombatLogSummary;
}
```

- [ ] **Step 3: Run测试验证通过**

Run: `npm test engine/battle-v5/tests/systems/log/types.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add engine/battle-v5/systems/log/types.ts engine/battle-v5/tests/systems/log/types.test.ts
git commit -m "feat(log): add strong typing for log entry types

- Remove message/highlight fields
- Add EntryDataMap for type-safe data
- Add LogSpan with actor/ability fields

- Add CombatLogSummary and CombatLogAIView interfaces

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>

---

## Chunk 2: LogAggregator 重构

### Task 2: 重构 LogAggregator

**Files:**
- Modify: `engine/battle-v5/systems/log/LogAggregator.ts`
- Modify: `engine/battle-v5/tests/systems/LogAggregator.test.ts`

- [ ] **Step 1: 更新测试用例**

```typescript
// tests/systems/LogAggregator.test.ts
import { LogAggregator } from '../systems/log/LogAggregator';

describe('LogAggregator Refactored', () => {
  let aggregator: LogAggregator;

  beforeEach(() => {
    aggregator = new LogAggregator();
  });

  describe('currentTurn', () => {
    it('should return current turn', () => {
      aggregator.beginSpan('battle_init', { turn: 0 });
      expect(aggregator.currentTurn).toBe(0);

      aggregator.beginSpan('round_start', { turn: 1 });
      expect(aggregator.currentTurn).toBe(1);
    });
  });

  describe('beginSpan with actor/ability', () => {
    it('should create span with actor and ability', () => {
      aggregator.beginSpan('action', {
        turn: 1,
        actor: { id: 'unit-1', name: '张三' },
        ability: { id: 'skill-1', name: '火球术' },
      });

      const spans = aggregator.getSpans();
      expect(spans).toHaveLength(1);
      expect(spans[0].actor).toEqual({ id: 'unit-1', name: '张三' });
      expect(spans[0].ability).toEqual({ id: 'skill-1', name: '火球术' });
    });
  });

  describe('addEntry', () => {
    it('should add entry to active span', () => {
      aggregator.beginSpan('action', { turn: 1, actor: { id: 'u1', name: '张三' } });
      aggregator.addEntry({
        id: 'entry-1',
        type: 'damage',
        data: { value: 100, remainHp: 50, isCritical: false, targetName: '李四' },
        timestamp: Date.now(),
      });

      const spans = aggregator.getSpans();
      expect(spans[0].entries).toHaveLength(1);
    });
  });
});

Run: `npm test engine/battle-v5/tests/systems/LogAggregator.test.ts`
Expected: PASS

- [ ] **Step 2: 重构 LogAggregator 实现**

```typescript
// engine/battle-v5/systems/log/LogAggregator.ts
import { LogEntry, LogSpan, LogSpanType } from './types';

export class LogAggregator {
  private _spans: LogSpan[] = [];
  private _activeSpan: LogSpan | null = null;
  private _turn: number = 0;
  private _spanCounter: number = 0;

  /**
   * 获取当前回合数
   */
  get currentTurn(): number {
    return this._turn;
  }

  beginSpan(
    type: LogSpanType,
    options: {
      turn: number;
      actor?: { id: string; name: string };
      ability?: { id: string; name: string };
    }
  ): void {
    // 自动结束前一个 Span
    this._activeSpan = null;

    this._turn = options.turn;

    const span: LogSpan = {
      id: `span_${++this._spanCounter}_${Date.now()}`,
      type,
      turn: options.turn,
      actor: options.actor,
      ability: options.ability,
      entries: [],
      timestamp: Date.now(),
    };

    this._spans.push(span);
    this._activeSpan = span;
  }

  addEntry(entry: LogEntry): void {
    if (!this._activeSpan) {
      console.warn('[LogAggregator] No active span, entry dropped:', entry.type);
      return;
    }
    this._activeSpan.entries.push(entry);
  }

  endSpan(): void {
    this._activeSpan = null;
  }

  getSpans(): LogSpan[] {
    return [...this._spans];
  }

  clear(): void {
    this._spans = [];
    this._activeSpan = null;
    this._turn = 0;
    this._spanCounter = 0;
  }
}
```

- [ ] **Step 3: Run测试验证通过**

Run: `npm test engine/battle-v5/tests/systems/LogAggregator.test.ts`
Expected: PASS

- [ ] **Step 4: 提交**

```bash
git add engine/battle-v5/systems/log/LogAggregator.ts
git commit -m "refactor(log): improve LogAggregator

- Add currentTurn getter
- Rename source to actor
- Add ability field
- Remove title generation

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Chunk 3: LogCollector 实现

### Task 1: 创建 LogCollector

**Files:**
- Create: `engine/battle-v5/systems/log/LogCollector.ts`
- Create: `engine/battle-v5/tests/systems/log/LogCollector.test.ts`

- [ ] **Step 1: 写 LogCollector 测试**

```typescript
// tests/systems/log/LogCollector.test.ts
import { EventBus } from '../../core/EventBus';
import { LogCollector } from '../systems/log/LogCollector';
import { LogAggregator } from '../systems/log/LogAggregator';
import { DamageTakenEvent, from '../../core/events';

describe('LogCollector', () => {
  let collector: LogCollector;
  let aggregator: LogAggregator;
  let eventBus: EventBus;

  beforeEach(() => {
    eventBus = EventBus.instance;
    eventBus.reset(); // 清理之前的订阅
    aggregator = new LogAggregator();
    collector = new LogCollector(aggregator);
  });

  afterEach(() => {
    collector.unsubscribe(eventBus);
    eventBus.reset();
  });

  describe('subscribe', () => {
    it('should create battle_init span', () => {
      collector.subscribe(eventBus);
      eventBus.publish<BattleInitEvent>({
        type: 'BattleInitEvent',
        player: { id: 'p1', name: '张三' } as any,
        opponent: { id: 'o1', name: '李四' } as any,
        timestamp: Date.now(),
      });
      const spans = aggregator.getSpans();
      expect(spans).toHaveLength(1);
      expect(spans[0].type).toBe('battle_init');
    });

    it('should create damage entry', () => {
      collector.subscribe(eventBus);
      // 先创建 action span
      eventBus.publish<SkillCastEvent>({
        type: 'SkillCastEvent',
        caster: { id: 'p1', name: '张三', id: 'p1', name: '张三' } as Unit,
        target: { id: 'o1', name: '李四', id: 'o1', name: '李四' } as Unit,
        ability: { id: 'skill-1', name: '火球术', id: 'skill-1', name: '火球术', type: 'active' } as any,
        timestamp: Date.now(),
      });
      // 再发布伤害事件
      eventBus.publish<DamageTakenEvent>({
        type: 'DamageTakenEvent',
        caster: { id: 'p1', name: '张三', id: 'p1', name: '张三' } as Unit,
        target: { id: 'o1', name: '李四', id: 'o1', name: '李四', currentHp: 50, maxHp: 100 } as Unit,
        ability: { id: 'skill-1', name: '火球术' } as any,
        damageTaken: 100,
        remainHealth: 50,
        isCritical: false,
        isLethal: false,
        timestamp: Date.now(),
      });
      const spans = aggregator.getSpans();
      const actionSpan = spans.find(s => s.type === 'action');
      expect(actionSpan?.entries).toHaveLength(1);
      expect(actionSpan?.entries[0].type).toBe('damage');
    });
  });
});
```

- [ ] **Step 2: 实现 LogCollector**

```typescript
// engine/battle-v5/systems/log/LogCollector.ts
import { EventBus } from '../../core/EventBus';
import { EventPriorityLevel } from '../../core/events';
import { LogAggregator } from './LogAggregator';
import { LogEntry } from './types';

export class LogCollector {
  private _aggregator: LogAggregator;
  private _handlers: Map<string, (event: unknown) => void> = new Map();

  constructor(aggregator: LogAggregator) {
    this._aggregator = aggregator;
  }

  private _addHandler(
    eventBus: EventBus,
    eventType: string,
    handler: (event: unknown) => void,
    priority: number = EventPriorityLevel.COMBAT_LOG
  ): void {
    eventBus.subscribe(eventType, handler, priority);
    this._handlers.set(eventType, handler);
  }

  subscribe(eventBus: EventBus): void {
    const highPriority = EventPriorityLevel.ACTION_TRIGGER + 1;

    // Span 管理事件
    this._addHandler(eventBus, 'BattleInitEvent', (e: any) => {
      this._aggregator.beginSpan('battle_init', { turn: 0 });
    }, highPriority);

    this._addHandler(eventBus, 'RoundStartEvent', (e: any) => {
      this._aggregator.beginSpan('round_start', { turn: (e as any).turn });
    }, highPriority);

    this._addHandler(eventBus, 'ActionPreEvent', (e: any) => {
      const event = e as any;
      this._aggregator.beginSpan('action_pre', {
        turn: this._aggregator.currentTurn,
        actor: { id: event.caster.id, name: event.caster.name },
      });
    }, highPriority);

    this._addHandler(eventBus, 'SkillCastEvent', (e: any) => {
      const event = e as any;
      this._aggregator.beginSpan('action', {
        turn: this._aggregator.currentTurn,
        actor: { id: event.caster.id, name: event.caster.name },
        ability: { id: event.ability.id, name: event.ability.name },
      });
    }, highPriority);

    this._addHandler(eventBus, 'BattleEndEvent', (e: any) => {
      const event = e as any;
      this._aggregator.beginSpan('battle_end', {
        turn: event.turns,
        actor: event.winner ? { id: event.winner, name: event.winner } : undefined,
      });
    }, highPriority);

    // 数据收集事件
    this._addHandler(eventBus, 'DamageTakenEvent', (e: any) => {
      const event = e as any;
      this._aggregator.addEntry({
        id: this._generateId(),
        type: 'damage',
        data: {
          value: Math.round(event.damageTaken),
          remainHp: Math.round(event.remainHealth),
          isCritical: event.isCritical ?? false,
          targetName: event.target.name,
          sourceBuff: event.buff?.name,
          shieldAbsorbed: event.shieldAbsorbed,
          remainShield: event.remainShield,
        },
        timestamp: Date.now(),
      });
      if (event.isLethal) {
        this._aggregator.addEntry({
          id: this._generateId(),
          type: 'death',
          data: {
            targetName: event.target.name,
            killerName: event.caster?.name,
          },
          timestamp: Date.now(),
        });
      }
    });

    this._addHandler(eventBus, 'HealEvent', (e: any) => {
      const event = e as any;
      this._aggregator.addEntry({
        id: this._generateId(),
        type: 'heal',
        data: {
          value: Math.round(event.healAmount),
          remainHp: Math.round(event.target.currentHp),
          targetName: event.target.name,
        },
        timestamp: Date.now(),
      });
    });

    this._addHandler(eventBus, 'ShieldEvent', (e: any) => {
      const event = e as any;
      this._aggregator.addEntry({
        id: this._generateId(),
        type: 'shield',
        data: {
          value: Math.round(event.shieldAmount),
          targetName: event.target.name,
        },
        timestamp: Date.now(),
      });
    });

    this._addHandler(eventBus, 'BuffAppliedEvent', (e: any) => {
      const event = e as any;
      this._aggregator.addEntry({
        id: this._generateId(),
        type: 'buff_apply',
        data: {
          buffName: event.buff.name,
          buffType: event.buff.type,
          targetName: event.target.name,
          duration: event.buff.getMaxDuration(),
        },
        timestamp: Date.now(),
      });
    });

    this._addHandler(eventBus, 'BuffRemovedEvent', (e: any) => {
      const event = e as any;
      this._aggregator.addEntry({
        id: this._generateId(),
        type: 'buff_remove',
        data: {
          buffName: event.buff.name,
          targetName: event.target.name,
          reason: event.reason,
        },
        timestamp: Date.now(),
      });
    });

    this._addHandler(eventBus, 'BuffImmuneEvent', (e: any) => {
      const event = e as any;
      this._aggregator.addEntry({
        id: this._generateId(),
        type: 'buff_immune',
        data: {
          buffName: event.buff.name,
          targetName: event.target.name,
        },
        timestamp: Date.now(),
      });
    });

    this._addHandler(eventBus, 'HitCheckEvent', (e: any) => {
      const event = e as any;
      if (event.isDodged) {
        this._aggregator.addEntry({
          id: this._generateId(),
          type: 'dodge',
          data: { targetName: event.target.name },
          timestamp: Date.now(),
        });
      } else if (event.isResisted) {
        this._aggregator.addEntry({
          id: this._generateId(),
          type: 'resist',
          data: { targetName: event.target.name },
          timestamp: Date.now(),
        });
      }
    });

    this._addHandler(eventBus, 'SkillInterruptEvent', (e: any) => {
      const event = e as any;
      this._aggregator.addEntry({
        id: this._generateId(),
        type: 'skill_interrupt',
        data: {
          skillName: event.ability.name,
          reason: event.reason,
        },
        timestamp: Date.now(),
      });
    });

    this._addHandler(eventBus, 'ManaBurnEvent', (e: any) => {
      const event = e as any;
      this._aggregator.addEntry({
        id: this._generateId(),
        type: 'mana_burn',
        data: {
          value: Math.round(event.burnAmount),
          targetName: event.target.name,
        },
        timestamp: Date.now(),
      });
    });

    this._addHandler(eventBus, 'CooldownModifyEvent', (e: any) => {
      const event = e as any;
      this._aggregator.addEntry({
        id: this._generateId(),
        type: 'cooldown_modify',
        data: {
          value: event.cdModifyValue,
          affectedSkillName: event.affectedAbilityName,
          targetName: event.target.name,
        },
        timestamp: Date.now(),
      });
    });

    this._addHandler(eventBus, 'ResourceDrainEvent', (e: any) => {
      const event = e as any;
      this._aggregator.addEntry({
        id: this._generateId(),
        type: 'resource_drain',
        data: {
          value: Math.round(event.amount),
          drainType: event.drainType,
          targetName: event.target.name,
        },
        timestamp: Date.now(),
      });
    });

    this._addHandler(eventBus, 'ReflectEvent', (e: any) => {
      const event = e as any;
      this._aggregator.addEntry({
        id: this._generateId(),
        type: 'reflect',
        data: {
          value: Math.round(event.reflectAmount),
          targetName: event.target.name,
        },
        timestamp: Date.now(),
      });
    });

    this._addHandler(eventBus, 'DispelEvent', (e: any) => {
      const event = e as any;
      this._aggregator.addEntry({
        id: this._generateId(),
        type: 'dispel',
        data: {
          buffs: event.removedBuffNames,
            targetName: event.target.name,
          },
        timestamp: Date.now(),
        });
      });
    });

    this._addHandler(eventBus, 'TagTriggerEvent', (e: any) => {
      const event = e as any;
      this._aggregator.addEntry({
        id: this._generateId(),
        type: 'tag_trigger',
        data: {
          tag: event.tag,
          targetName: event.target.name,
        },
        timestamp: Date.now(),
      });
    });

    this._addHandler(eventBus, 'DeathPreventEvent', (e: any) => {
      const event = e as any;
      this._aggregator.addEntry({
        id: this._generateId(),
        type: 'death_prevent',
        data: { targetName: event.target.name },
        timestamp: Date.now(),
      });
    });
  }

  unsubscribe(eventBus: EventBus): void {
    for (const [type, handler] of this._handlers) {
      eventBus.unsubscribe(type, handler);
    }
    this._handlers.clear();
  }

  private _generateId(): string {
    return `entry_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
```

- [ ] **Step 3: 运行测试**

Run: `npm test engine/battle-v5/tests/systems/log/LogCollector.test.ts`
Expected: PASS

- [ ] **Step 4: 提交**

```bash
git add engine/battle-v5/systems/log/LogCollector.ts engine/battle-v5/tests/systems/log/LogCollector.test.ts
git commit -m "feat(log): add LogCollector for event collection

- Subscribe to all combat events
- Convert event data to structured LogEntry
- No message generation

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Chunk 4: LogPresenter 实现

### Task 1: 创建 LogPresenter

**Files:**
- Create: `engine/battle-v5/systems/log/LogPresenter.ts`
- Create: `engine/battle-v5/tests/systems/log/LogPresenter.test.ts`

- [ ] **Step 1: 写 LogPresenter 测试**

```typescript
// tests/systems/log/LogPresenter.test.ts
import { LogPresenter } from '../systems/log/LogPresenter';
import { LogSpan, LogEntry } from '../systems/log/types';

describe('LogPresenter', () => {
  let presenter: LogPresenter;

  beforeEach(() => {
    presenter = new LogPresenter();
  });

  describe('formatSpan', () => {
    it('should format round_start', () => {
      const span: LogSpan = {
        id: 'span-1',
        type: 'round_start',
        turn: 1,
        entries: [],
        timestamp: Date.now(),
      };
      expect(presenter.formatSpan(span)).toBe('【第 1 回合】');
    });

    it('should format action with damage', () => {
      const span: LogSpan = {
        id: 'span-1',
        type: 'action',
        turn: 1,
        actor: { id: 'u1', name: '张三' },
        ability: { id: 'basic_attack', name: '普通攻击' },
        entries: [
          {
            id: 'e1',
            type: 'damage',
            data: { value: 100, remainHp: 50, isCritical: false, targetName: '李四' },
            timestamp: Date.now(),
          },
        ],
        timestamp: Date.now(),
      };
      expect(presenter.formatSpan(span)).toBe('张三发起攻击，对 李四造成 100 点伤害');
    });

    it('should format action with critical damage', () => {
      const span: LogSpan = {
        id: 'span-1',
        type: 'action',
        turn: 1,
        actor: { id: 'u1', name: '张三' },
        ability: { id: 'skill-1', name: '火球术' },
        entries: [
          {
            id: 'e1',
            type: 'damage',
            data: { value: 150, remainHp: 0, isCritical: true, targetName: '李四' },
            timestamp: Date.now(),
          },
          {
            id: 'e2',
            type: 'death',
            data: { targetName: '李四', killerName: '张三' },
            timestamp: Date.now(),
          },
        ],
        timestamp: Date.now(),
      };
      expect(presenter.formatSpan(span)).toBe('张三施放【火球术】，对 李四造成 150 点伤害（暴击！），李四被击败！');
    });

    it('should format action with dodge', () => {
      const span: LogSpan = {
        id: 'span-1',
        type: 'action',
        turn: 1,
        actor: { id: 'u1', name: '张三' },
        ability: { id: 'skill-1', name: '火球术' },
        entries: [
          {
            id: 'e1',
            type: 'dodge',
            data: { targetName: '李四' },
            timestamp: Date.now(),
          },
        ],
        timestamp: Date.now(),
      };
      expect(presenter.formatSpan(span)).toBe('张三施放【火球术】，被目标闪避了！');
    });

    it('should format action_pre with DOT', () => {
      const span: LogSpan = {
        id: 'span-1',
        type: 'action_pre',
        turn: 1,
        actor: { id: 'u1', name: '李四' },
        entries: [
          {
            id: 'e1',
            type: 'damage',
            data: { value: 50, remainHp: 50, isCritical: false, targetName: '李四', sourceBuff: '毒' },
            timestamp: Date.now(),
          },
        ],
        timestamp: Date.now(),
      };
      expect(presenter.formatSpan(span)).toBe('【持续】李四身上的「毒」发作，造成 50 点伤害');
    });
  });

  describe('getPlayerView', () => {
    it('should filter empty action spans', () => {
      const spans: LogSpan[] = [
        { id: 's1', type: 'battle_init', turn: 0, entries: [], timestamp: Date.now() },
        { id: 's2', type: 'round_start', turn: 1, entries: [], timestamp: Date.now() },
        { id: 's3', type: 'action_pre', turn: 1, entries: [], timestamp: Date.now() }, // 空 action_pre
        { id: 's4', type: 'action', turn: 1, actor: { id: 'u1', name: '张三' }, ability: { id: 'basic_attack', name: '攻击' }, entries: [{ id: 'e1', type: 'damage', data: { value: 100, remainHp: 50, isCritical: false, targetName: '李四' }, timestamp: Date.now() }], timestamp: Date.now() },
      ];
      const result = presenter.getPlayerView(spans);
      expect(result).toHaveLength(3); // battle_init, round_start, action
      expect(result[2]).toContain('【持续】'); // 空 action_pre 不显示
    });
  });
});
```

- [ ] **Step 2: 实现 LogPresenter**

```typescript
// engine/battle-v5/systems/log/LogPresenter.ts
import {
  LogSpan,
  LogEntry,
  LogEntryType,
  LogSpanType,
  CombatLogSummary,
  CombatLogAIView,
  DamageEntryData,
} from './types';

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

  private formatEmptySpan(span: LogSpan): string {
    switch (span.type) {
      case 'battle_init':
        return '【战斗开始】';
      case 'battle_end':
        const winner = span.actor?.name ?? '未知';
        return `【战斗结束】${winner} 获胜！`;
      case 'round_start':
        return `【第 ${span.turn} 回合】`;
      default:
        return '';
    }
  }

  private formatBattleInit(span: LogSpan): string {
    return '【战斗开始】';
  }

  private formatBattleEnd(span: LogSpan): string {
    const winner = span.actor?.name ?? '未知';
    return `【战斗结束】${winner} 获胜!`;
  }

  private formatAction(span: LogSpan): string {
    const actor = span.actor?.name ?? '未知';
    const ability = span.ability;
    const entries = span.entries;

    const targets = this.extractTargets(entries);
    if (targets.length > 1) {
      return this.formatMultiTargetAction(span, actor, ability, targets);
    }
    return this.formatSingleTargetAction(span, actor, ability, entries);
  }

  private formatSingleTargetAction(
    span: LogSpan,
    actor: string,
    ability: { id: string; name: string } | undefined,
    entries: LogEntry[]
  ): string {
    const damage = this.findEntry(entries, 'damage');
    const heal = this.findEntry(entries, 'heal');
    const shield = this.findEntry(entries, 'shield');
    const buffApply = this.findEntry(entries, 'buff_apply');
    const dodge = this.findEntry(entries, 'dodge');
    const resist = this.findEntry(entries, 'resist');
    const death = this.findEntry(entries, 'death');
    const dispel = this.findEntry(entries, 'dispel');
    const interrupt = this.findEntry(entries, 'skill_interrupt');
    const deathPrevent = this.findEntry(entries, 'death_prevent');
    const reflect = this.findEntry(entries, 'reflect');
    const manaBurn = this.findEntry(entries, 'mana_burn');
    const resourceDrain = this.findEntry(entries, 'resource_drain');
    const cooldownModify = this.findEntry(entries, 'cooldown_modify');
    const tagTrigger = this.findEntry(entries, 'tag_trigger');

    const isBasicAttack = ability?.id === 'basic_attack';
    const actionDesc = isBasicAttack ? '发起攻击' : `施放【${ability?.name}】`;

    if (dodge || resist) {
      const reason = dodge ? '闪避' : '抵抗';
      return `${actor} ${actionDesc}，被目标${reason}了！`;
    }

    if (interrupt) {
      return `${actor} ${actionDesc}，打断了目标的【${interrupt.data.skillName}】：${interrupt.data.reason}！`;
    }

    let result = `${actor} ${actionDesc}`;

    if (damage) {
      result += `，对 ${damage.data.targetName}`;
      result += ` 造成 ${damage.data.value} 点伤害`;
      if (damage.data.isCritical) result += '（暴击！）      if (damage.data.shieldAbsorbed && damage.data.shieldAbsorbed > 0) {
        result += `（抵扣护盾 ${Math.round(damage.data.shieldAbsorbed)} 点`;
        if (damage.data.remainShield && damage.data.remainShield <= 0) {
          result += '，护盾已破碎';
        }
        result += '）';
      }
      if (buffApply && buffApply.data.targetName === damage.data.targetName) {
        result += `并施加「${buffApply.data.buffName}」`;
      }
      if (death) {
        result += `，${death.data.targetName}被击败!`;
      } else if (deathPrevent) {
        result += `，${deathPrevent.data.targetName}触发免死效果保住了性命!`;
      }
    } else if (heal) {
      result += `，为 ${heal.data.targetName} 恢复 ${heal.data.value} 点气血`;
    }

    if (shield && !damage) {
      result += `，为 ${shield.data.targetName} 施加 ${shield.data.value} 点护盾`;
    }

    if (dispel) {
      const buffsText = dispel.data.buffs.map(n => `「${n}」`).join('、');
      result += `，清除了 ${dispel.data.targetName} 身上的 ${buffsText}`;
    }

    if (manaBurn) {
      result += `，削减了 ${manaBurn.data.targetName} ${manaBurn.data.value} 点真元`;
    }

    if (resourceDrain) {
      const typeText = resourceDrain.data.drainType === 'hp' ? '气血' : '真元';
      result += `，从 ${resourceDrain.data.targetName} 身上夺取了 ${resourceDrain.data.value} 点${typeText}`;
    }

    if (reflect) {
      result += `，反弹 ${reflect.data.value} 点伤害给 ${reflect.data.targetName}`;
    }

    if (cooldownModify) {
      const action = cooldownModify.data.value > 0 ? '增加' : '减少';
      result += `，使 ${cooldownModify.data.targetName} 的【${cooldownModify.data.affectedSkillName}】冷却${action}${Math.abs(cooldownModify.data.value)} 回合`;
    }

    if (tagTrigger) {
      result += `，触发了 ${tagTrigger.data.targetName} 身上的「${tagTrigger.data.tag}」标记`;
    }

    return result;
  }

  private formatMultiTargetAction(
    span: LogSpan,
    actor: string,
    ability: { id: string; name: string } | undefined,
    targets: string[]
  ): string {
    const lines: string[] = [];
    for (const target of targets) {
      const targetEntries = span.entries.filter(e => {
        const data = e.data as { targetName?: string };
        return data.targetName === target;
      });
      lines.push(this.formatSingleTargetAction(span, actor, ability, targetEntries));
    }
    return lines.join('\n');
  }

  private extractTargets(entries: LogEntry[]): string[] {
    const targets = new Set<string>();
    for (const entry of entries) {
      const data = entry.data as { targetName?: string };
      if (data.targetName) {
        targets.add(data.targetName);
      }
    }
    return Array.from(targets);
  }

  private formatActionPre(span: LogSpan): string {
    const actor = span.actor?.name ?? '未知';
    const entries = span.entries;

    const damage = this.findEntry(entries, 'damage');
    const heal = this.findEntry(entries, 'heal');
    const buffRemove = this.findEntry(entries, 'buff_remove');

    if (damage && damage.data.sourceBuff) {
      let result = `【持续】${actor}身上的「${damage.data.sourceBuff}」发作`;
      result += `，造成 ${damage.data.value} 点伤害`;
      if (damage.data.shieldAbsorbed && damage.data.shieldAbsorbed > 0) {
        result += `（抵扣护盾 ${Math.round(damage.data.shieldAbsorbed)} 点）`;
      }
      const death = this.findEntry(span.entries, 'death');
      if (death && death.data.targetName === actor) {
        result += `，${actor}被击败!`;
      }
      return result;
    }

    if (heal) {
      return `【持续】${actor}身上的治疗效果生效，恢复 ${heal.data.value} 点气血`;
    }

    if (buffRemove && buffRemove.data.reason === 'expired') {
      return `【持续】${actor}身上的「${buffRemove.data.buffName}」时效已过`;
    }

    return `${actor} 持续效果触发`;
  }

  private findEntry<T extends LogEntryType>(
    entries: LogEntry[],
    type: T
  ): LogEntry<T> | undefined {
    return entries.find(e => e.type === type) as LogEntry<T> | undefined;
  }

  getPlayerView(spans: LogSpan[]): string[] {
    return spans
      .filter(span => span.entries.length > 0 || this._isStructuralSpan(span))
      .map(span => this.formatSpan(span))
      .filter(text => text.length > 0);
  }

  private _isStructuralSpan(span: LogSpan): boolean {
    return ['battle_init', 'round_start', 'battle_end'].includes(span.type);
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

  getDebugView(spans: LogSpan[]): object {
    return {
      spans,
      eventCount: spans.reduce((sum, s) => sum + s.entries.length, 0),
      summary: this.generateSummary(spans),
    };
  }

  private generateSummary(spans: LogSpan[]): CombatLogSummary {
    let totalDamage = 0;
    let totalHeal = 0;
    let criticalCount = 0;
    const deaths: string[] = [];
    let maxTurn = 0;

    for (const span of spans) {
      maxTurn = Math.max(maxTurn, span.turn);
      for (const entry of span.entries) {
        if (entry.type === 'damage') {
          const data = entry.data as DamageEntryData;
          totalDamage += data.value;
          if (data.isCritical) criticalCount++;
        }
        if (entry.type === 'heal') {
          const data = entry.data as { value: number };
          totalHeal += data.value;
        }
        if (entry.type === 'death') {
          const data = entry.data as { targetName: string };
          deaths.push(data.targetName);
        }
      }
    }
    return { totalDamage, totalHeal, criticalCount, deaths, turns: maxTurn };
  }
}
```

- [ ] **Step 2: 运行测试**

Run: `npm test engine/battle-v5/tests/systems/log/LogPresenter.test.ts`
Expected: PASS

- [ ] **Step 3: 提交**

```bash
git add engine/battle-v5/systems/log/LogPresenter.ts engine/battle-v5/tests/systems/log/LogPresenter.test.ts
git commit -m "feat(log): add LogPresenter for aggregated output

- Format spans into single-line player logs
- Support multi-target actions (AoE)
- Provide AI view and debug view

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Chunk 5: CombatLogSystem 门面重构

### Task 1: 重构 CombatLogSystem

**Files:**
- Modify: `engine/battle-v5/systems/log/CombatLogSystem.ts`
- Modify: `engine/battle-v5/tests/systems/CombatLogSystemNew.test.ts`

- [ ] **Step 1: 更新测试用例**

```typescript
// tests/systems/CombatLogSystemNew.test.ts
import { CombatLogSystem } from '../systems/log/CombatLogSystem';
import { EventBus } from '../../core/EventBus';

describe('CombatLogSystem Refactored', () => {
  let system: CombatLogSystem;
  let eventBus: EventBus;

  beforeEach(() => {
    eventBus = EventBus.instance;
    eventBus.reset();
    system = new CombatLogSystem();
    system.subscribe(eventBus);
  });

  afterEach(() => {
    system.unsubscribe(eventBus);
    eventBus.reset();
  });

  describe('getPlayerLogs', () => {
    it('should return aggregated player logs', () => {
    // 模拟战斗流程
    eventBus.publish({ type: 'BattleInitEvent', player: {} as any, opponent: {} as any, timestamp: Date.now() });
    eventBus.publish({ type: 'RoundStartEvent', turn: 1, timestamp: Date.now() });
    eventBus.publish({
      type: 'SkillCastEvent',
      caster: { id: 'p1', name: '张三' } as any,
      target: { id: 'o1', name: '李四' } as any,
      ability: { id: 'basic_attack', name: '攻击' } as any,
      timestamp: Date.now(),
    });
    eventBus.publish({
      type: 'DamageTakenEvent',
      caster: { id: 'p1', name: '张三' } as any,
      target: { id: 'o1', name: '李四', currentHp: 50, maxHp: 100 } as any,
      damageTaken: 100,
      remainHealth: 50,
      isCritical: false,
      isLethal: false,
      timestamp: Date.now(),
    });

    const logs = system.getPlayerLogs();
    expect(logs.length).toBeGreaterThan(0);
    expect(logs.some(l => l.includes('张三'))).toBe(true);
  });
});

describe('getAIData', () => {
  it('should return AI view with summary', () => {
    eventBus.publish({ type: 'BattleInitEvent', player: {} as any, opponent: {} as any, timestamp: Date.now() });
    eventBus.publish({ type: 'RoundStartEvent', turn: 1, timestamp: Date.now() });

    const aiData = system.getAIData();
    expect(aiData.spans).toBeDefined();
    expect(aiData.summary).toBeDefined();
    expect(aiData.summary.totalDamage).toBe(0);
  });
});
```

- [ ] **Step 2: 重构 CombatLogSystem 实现**

```typescript
// engine/battle-v5/systems/log/CombatLogSystem.ts
import { EventBus } from '../../core/EventBus';
import { CombatPhase } from '../../core/types';
import { LogCollector } from './LogCollector';
import { LogAggregator } from './LogAggregator';
import { LogPresenter } from './LogPresenter';
import { LogSpan, LogSpanType, CombatLog, DamageEntryData } from './types';

export class CombatLogSystem {
  private _collector: LogCollector;
  private _aggregator: LogAggregator;
  private _presenter: LogPresenter;

  constructor() {
    this._aggregator = new LogAggregator();
    this._collector = new LogCollector(this._aggregator);
    this._presenter = new LogPresenter();
  }

  subscribe(eventBus: EventBus): void {
    this._collector.subscribe(eventBus);
  }

  unsubscribe(eventBus: EventBus): void {
    this._collector.unsubscribe(eventBus);
  }

  clear(): void {
    this._aggregator.clear();
  }

  destroy(): void {
    this._collector.unsubscribe(EventBus.instance);
  }

  // ===== 新 API =====
  getPlayerLogs(): string[] {
    return this._presenter.getPlayerView(this._aggregator.getSpans());
  }

  getAIData() {
    return this._presenter.getAIView(this._aggregator.getSpans());
  }

  getDebugData() {
    return this._presenter.getDebugView(this._aggregator.getSpans());
  }

  // ===== 兼容旧 API =====
  /** @deprecated 使用 getPlayerLogs() */
  getLogs(): CombatLog[] {
    const logs: CombatLog[] = [];
    for (const span of this._aggregator.getSpans()) {
      if (span.entries.length === 0 && !this._isStructuralSpan(span)) continue;
      const message = this._presenter.formatSpan(span);
      if (!message) continue;
      logs.push({
        turn: span.turn,
        phase: this._mapSpanTypeToPhase(span.type),
        message,
        highlight: this._hasHighlightEntry(span),
      });
    }
    return logs;
  }

  /** @deprecated 使用 getPlayerLogs().join('\n') */
  generateReport(): string {
    return this.getPlayerLogs().join('\n');
  }

  private _isStructuralSpan(span: LogSpan): boolean {
    return ['battle_init', 'round_start', 'battle_end'].includes(span.type);
  }

  private _mapSpanTypeToPhase(type: LogSpanType): CombatPhase {
    const mapping: Record<LogSpanType, CombatPhase> = {
      battle_init: CombatPhase.INIT,
      round_start: CombatPhase.ROUND_START,
      action_pre: CombatPhase.ROUND_PRE,
      action: CombatPhase.ACTION,
      battle_end: CombatPhase.END,
    };
    return mapping[type] ?? CombatPhase.ROUND_PRE;
  }

  private _hasHighlightEntry(span: LogSpan): boolean {
    return span.entries.some(e =>
      ['death', 'death_prevent', 'skill_interrupt'].includes(e.type) ||
      (e.type === 'damage' && (e.data as DamageEntryData).isCritical)
    );
  }
}
```

- [ ] **Step 3: 运行测试**

Run: `npm test engine/battle-v5/tests/systems/CombatLogSystemNew.test.ts`
Expected: PASS

- [ ] **Step 4: 提交**

```bash
git add engine/battle-v5/systems/log/CombatLogSystem.ts engine/battle-v5/tests/systems/CombatLogSystemNew.test.ts
git commit -m "refactor(log): simplify CombatLogSystem facade

- Use new LogCollector, LogAggregator, LogPresenter
- Add new APIs: getPlayerLogs(), getAIData(), getDebugData()
- Deprecate old APIs: getLogs(), generateReport()

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```
---

## Chunk 6: 清理与集成测试

### Task 1: 删除旧文件

**Files:**
- Delete: `engine/battle-v5/systems/log/LogSubscriber.ts`
- Delete: `engine/battle-v5/systems/log/LogFormatter.ts`

- [ ] **Step 1: 删除旧文件**

```bash
rm engine/battle-v5/systems/log/LogSubscriber.ts
rm engine/battle-v5/systems/log/LogFormatter.ts
```

- [ ] **Step 2: 更新 index.ts**

```typescript
// engine/battle-v5/systems/log/index.ts
export * from './types';
export * from './LogAggregator';
export * from './LogCollector';
export * from './LogPresenter';
export * from './CombatLogSystem';
```

- [ ] **Step 3: 提交**

```bash
git add engine/battle-v5/systems/log/index.ts
git commit -m "refactor(log): update exports and remove LogSubscriber, LogFormatter

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Chunk 7: 集成测试

### Task 1: 创建完整战斗流程测试

**Files:**
- Create: `engine/battle-v5/tests/systems/log/integration/FullLogFlow.test.ts`

- [ ] **Step 1: 写集成测试**

```typescript
// tests/systems/log/integration/FullLogFlow.test.ts
import { BattleEngineV5 } from '../../../../BattleEngineV5';
import { Unit } from '../../../../units/Unit';
import { AttributeSet, from '../../../../units/AttributeSet';
import { AttributeType } from '../../../../core/types';

describe('Full Log Flow Integration', () => {
  it('should generate aggregated player logs', () => {
    // 创建角色
    const player = new Unit({
      id: 'player-1',
      name: '张三',
      attributes: new AttributeSet(),
      abilities: {} as any,
      buffs: {} as any,
    });
    player.attributes.setBaseValue(AttributeType.MAX_HP, 1000);
    player.attributes.setBaseValue(AttributeType.ATTACK, 50);

    const opponent = new Unit({
      id: 'opponent-1',
      name: '李四',
      attributes: new AttributeSet(),
      abilities: {} as any,
      buffs: {} as any,
    });
    opponent.attributes.setBaseValue(AttributeType.MAX_HP, 100);
    opponent.attributes.setBaseValue(AttributeType.DEFENSE, 20);

    // 执行战斗
    const engine = new BattleEngineV5(player, opponent);
    const result = engine.execute();

    // 验证日志
    const logs = engine.logSystem.getPlayerLogs();
    expect(logs.length).toBeGreaterThan(0);

    // 验证聚合效果：一次行动一行
    const actionLogs = logs.filter(l => l.includes('张三') || l.includes('李四'));
    for (const log of actionLogs) {
      // 每条日志应该只描述一个行动
      expect(log.split('，').length).toBeLessThanOrEqual(4);
    }

    engine.destroy();
  });
});
```

- [ ] **Step 2: 运行测试**

Run: `npm test engine/battle-v5/tests/systems/log/integration/FullLogFlow.test.ts`
Expected: PASS

- [ ] **Step 3: 提交**

```bash
git add engine/battle-v5/tests/systems/log/integration/FullLogFlow.test.ts
git commit -m "test(log): add full log flow integration test

- Verify single-line aggregation
- Test complete battle flow

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```
---

## Summary

**Total Files Changed:** 7
- **New Files:** 3 (LogCollector.ts, LogPresenter.ts, types.test.ts)
- **Modified Files:** 4 (types.ts, LogAggregator.ts, CombatLogSystem.ts, index.ts)
- **Deleted Files:** 2 (LogSubscriber.ts, LogFormatter.ts)
- **Test Files:** 5

**Estimated Effort:** 2-3 hours
"
