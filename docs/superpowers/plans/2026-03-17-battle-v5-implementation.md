# V5 战斗引擎实施计划

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**目标:** 基于 EDA + GAS 思想构建全新的 V5 战斗引擎，解决现有战斗引擎的时序控制、状态管理、扩展性问题

**架构:** 事件驱动架构（EventBus + 优先级队列）+ 战斗状态机（7-9个状态）+ GAS 思想借鉴（6阶段属性修改器）+ 原型模式（镜像PVP）

**技术栈:** TypeScript, Node.js 测试环境, Jest (现有测试框架)

**设计文档:** [docs/superpowers/specs/2026-03-17-battle-v5-design.md](../specs/2026-03-17-battle-v5-design.md)

---

## 文件结构映射

### 核心层 (core/)
```
engine/battle-v5/core/
├── EventBus.ts              # 事件总线（单例 + 优先级队列 + 事件历史）
├── CombatStateMachine.ts    # 战斗状态机（7-9个状态）
└── types.ts                 # 核心类型定义
```

### 单元层 (units/)
```
engine/battle-v5/units/
├── Unit.ts                  # 战斗单元（原型模式）
├── AttributeSet.ts          # 属性集（6阶段修改器）
├── AbilityContainer.ts      # 能力容器
└── BuffContainer.ts         # BUFF容器
```

### 能力层 (abilities/)
```
engine/battle-v5/abilities/
├── Ability.ts               # 能力基类
├── ActiveSkill.ts           # 主动技能基类
├── PassiveAbility.ts        # 被动能力基类
└── examples/
    └── FireballSkill.ts     # 示例：火球术
```

### BUFF层 (buffs/)
```
engine/battle-v5/buffs/
├── Buff.ts                  # BUFF基类
└── examples/
    └── StrengthBuff.ts      # 示例：力量BUFF
```

### 系统层 (systems/)
```
engine/battle-v5/systems/
├── CombatLogSystem.ts       # 战报系统
├── DamageSystem.ts          # 伤害计算系统
└── VictorySystem.ts         # 胜负判定系统
```

### 适配层 (adapters/)
```
engine/battle-v5/adapters/
└── CultivatorAdapter.ts     # 数据适配器
```

### 测试层 (tests/)
```
engine/battle-v5/tests/
├── core/
│   ├── EventBus.test.ts
│   └── CombatStateMachine.test.ts
├── units/
│   ├── AttributeSet.test.ts
│   ├── Unit.test.ts
│   ├── AbilityContainer.test.ts
│   └── BuffContainer.test.ts
├── abilities/
│   ├── Ability.test.ts
│   └── examples/
│       └── FireballSkill.test.ts
├── buffs/
│   ├── Buff.test.ts
│   └── examples/
│       └── StrengthBuff.test.ts
└── integration/
    └── BattleEngineV5.test.ts
```

### 入口文件
```
engine/battle-v5/
└── index.ts                 # 战斗系统入口
```

---

## Chunk 1: 核心框架（阶段一）

### Task 1: 创建目录结构和核心类型定义

**Files:**
- Create: `engine/battle-v5/core/types.ts`
- Create: `engine/battle-v5/core/EventBus.ts`
- Test: `engine/battle-v5/tests/core/EventBus.test.ts`

- [ ] **Step 1: 创建目录结构**

```bash
mkdir -p engine/battle-v5/{core,units,abilities,buffs,systems,adapters,tests/{core,units,abilities,buffs,integration}}
```

- [ ] **Step 2: 写核心类型定义**

创建 `engine/battle-v5/core/types.ts`:

```typescript
// ===== 基础类型 =====
export type UnitId = string;
export type AbilityId = string;
export type BuffId = string;
export type EventPriority = number;

// ===== 战斗事件基类 =====
export interface CombatEvent {
  readonly type: string;
  readonly priority: EventPriority;
  readonly timestamp: number;
}

// ===== 战斗阶段枚举 =====
export enum CombatPhase {
  INIT = 'init',
  DESTINY_AWAKEN = 'destiny_awaken',
  ROUND_START = 'round_start',
  ROUND_PRE = 'round_pre',
  TURN_ORDER = 'turn_order',
  ACTION = 'action',
  ROUND_POST = 'round_post',
  VICTORY_CHECK = 'victory_check',
  END = 'end',
}

// ===== 5维属性类型 =====
export enum AttributeType {
  SPIRIT = 'spirit',
  PHYSIQUE = 'physique',
  AGILITY = 'agility',
  CONSCIOUSNESS = 'consciousness',
  COMPREHENSION = 'comprehension',
}

// ===== 属性修改器类型（6阶段）=====
export enum ModifierType {
  BASE = 'base',
  FIXED = 'fixed',
  ADD = 'add',
  MULTIPLY = 'multiply',
  FINAL = 'final',
  OVERRIDE = 'override',
}

export interface AttributeModifier {
  readonly id: string;
  readonly attrType: AttributeType;
  readonly type: ModifierType;
  readonly value: number;
  readonly source: object;
}

// ===== 能力类型 =====
export enum AbilityType {
  ACTIVE_SKILL = 'active_skill',
  PASSIVE_SKILL = 'passive_skill',
  DESTINY = 'destiny',
}

// ===== 效果类型 =====
export enum EffectType {
  DAMAGE = 'damage',
  HEAL = 'heal',
  SHIELD = 'shield',
  ADD_BUFF = 'add_buff',
  REMOVE_BUFF = 'remove_buff',
  STAT_MODIFIER = 'stat_modifier',
}

// ===== BUFF类型 =====
export enum BuffType {
  BUFF = 'buff',
  DEBUFF = 'debuff',
  CONTROL = 'control',
}

// ===== 战斗结果 =====
export interface BattleResult {
  winner: UnitId;
  loser: UnitId;
  turns: number;
  logs: string[];
}

// ===== 回合快照 =====
export interface TurnSnapshot {
  turn: number;
  phase: CombatPhase;
  units: Map<UnitId, UnitSnapshot>;
}

// ===== 单元快照 =====
export interface UnitSnapshot {
  unitId: UnitId;
  name: string;
  attributes: Record<AttributeType, number>;
  currentHp: number;
  maxHp: number;
  currentMp: number;
  maxMp: number;
  buffs: BuffId[];
  isAlive: boolean;
}

// ===== 战报日志 =====
export interface CombatLog {
  turn: number;
  phase: CombatPhase;
  message: string;
  highlight: boolean;
}
```

- [ ] **Step 3: 写事件总线测试**

创建 `engine/battle-v5/tests/core/EventBus.test.ts`:

```typescript
import { EventBus } from '../../core/EventBus';
import { CombatEvent } from '../../core/types';

describe('EventBus', () => {
  let eventBus: EventBus;

  beforeEach(() => {
    eventBus = EventBus.instance;
    eventBus.reset();
  });

  describe('单例模式', () => {
    it('应该返回同一个实例', () => {
      const instance1 = EventBus.instance;
      const instance2 = EventBus.instance;
      expect(instance1).toBe(instance2);
    });
  });

  describe('订阅和发布', () => {
    it('应该能够订阅和发布事件', () => {
      let received = false;
      const handler = () => { received = true; };

      eventBus.subscribe('TestEvent', handler);
      eventBus.publish({ type: 'TestEvent', priority: 50, timestamp: Date.now() });

      expect(received).toBe(true);
    });

    it('应该按优先级顺序处理事件', () => {
      const order: number[] = [];
      const handler1 = () => order.push(1);
      const handler2 = () => order.push(2);
      const handler3 = () => order.push(3);

      eventBus.subscribe('TestEvent', handler1, 10);
      eventBus.subscribe('TestEvent', handler2, 30);
      eventBus.subscribe('TestEvent', handler3, 20);

      eventBus.publish({ type: 'TestEvent', priority: 0, timestamp: Date.now() });

      expect(order).toEqual([2, 3, 1]);
    });
  });

  describe('取消订阅', () => {
    it('应该能够取消订阅', () => {
      let count = 0;
      const handler = () => { count++; };

      eventBus.subscribe('TestEvent', handler);
      eventBus.publish({ type: 'TestEvent', priority: 0, timestamp: Date.now() });
      expect(count).toBe(1);

      eventBus.unsubscribe('TestEvent', handler);
      eventBus.publish({ type: 'TestEvent', priority: 0, timestamp: Date.now() });
      expect(count).toBe(1);
    });
  });

  describe('事件历史', () => {
    it('应该记录事件历史', () => {
      eventBus.publish({ type: 'Event1', priority: 0, timestamp: Date.now() });
      eventBus.publish({ type: 'Event2', priority: 0, timestamp: Date.now() });

      const history = eventBus.getEventHistory();
      expect(history.length).toBe(2);
      expect(history[0].type).toBe('Event1');
      expect(history[1].type).toBe('Event2');
    });

    it('应该限制历史大小', () => {
      for (let i = 0; i < 1500; i++) {
        eventBus.publish({ type: `Event${i}`, priority: 0, timestamp: Date.now() });
      }

      const history = eventBus.getEventHistory();
      expect(history.length).toBeLessThanOrEqual(1000);
    });
  });
});
```

- [ ] **Step 4: 运行测试验证失败**

```bash
npm test -- engine/battle-v5/tests/core/EventBus.test.ts
```
Expected: FAIL - "EventBus not defined"

- [ ] **Step 5: 实现事件总线**

创建 `engine/battle-v5/core/EventBus.ts`:

```typescript
import { CombatEvent, EventPriority } from './types';

type EventHandler<T extends CombatEvent> = (event: T) => void;

interface EventSubscriber {
  handler: EventHandler<any>;
  priority: EventPriority;
}

export class EventBus {
  private static _instance: EventBus;

  public static get instance(): EventBus {
    if (!this._instance) {
      this._instance = new EventBus();
    }
    return this._instance;
  }

  private _subscribers = new Map<string, EventSubscriber[]>();
  private _eventHistory: CombatEvent[] = [];
  private readonly _maxHistorySize = 1000;

  private constructor() {}

  public subscribe<T extends CombatEvent>(
    eventType: string,
    handler: EventHandler<T>,
    priority: EventPriority = 0,
  ): void {
    if (!this._subscribers.has(eventType)) {
      this._subscribers.set(eventType, []);
    }

    const subscribers = this._subscribers.get(eventType)!;
    subscribers.push({ handler, priority });

    subscribers.sort((a, b) => b.priority - a.priority);
  }

  public unsubscribe<T extends CombatEvent>(
    eventType: string,
    handler: EventHandler<T>,
  ): void {
    const subscribers = this._subscribers.get(eventType);
    if (!subscribers) return;

    this._subscribers.set(
      eventType,
      subscribers.filter((s) => s.handler !== handler),
    );
  }

  public publish<T extends CombatEvent>(event: T): void {
    this._eventHistory.push(event);
    if (this._eventHistory.length > this._maxHistorySize) {
      this._eventHistory.shift();
    }

    const subscribers = this._subscribers.get(event.type);
    if (!subscribers) return;

    for (const subscriber of subscribers) {
      subscriber.handler(event);
    }
  }

  public getEventHistory(): ReadonlyArray<CombatEvent> {
    return this._eventHistory;
  }

  public clearHistory(): void {
    this._eventHistory = [];
  }

  public reset(): void {
    this._subscribers.clear();
    this._eventHistory = [];
  }
}
```

- [ ] **Step 6: 运行测试验证通过**

```bash
npm test -- engine/battle-v5/tests/core/EventBus.test.ts
```
Expected: PASS

- [ ] **Step 7: 提交**

```bash
git add engine/battle-v5/
git commit -m "feat(battle-v5): add EventBus with priority queue and history

- Add core types definition (CombatEvent, CombatPhase, AttributeType, etc.)
- Implement EventBus with singleton pattern
- Support priority-based event processing
- Add event history with max size limit
- Add comprehensive unit tests

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 2: 实现战斗状态机

**Files:**
- Create: `engine/battle-v5/core/CombatStateMachine.ts`
- Test: `engine/battle-v5/tests/core/CombatStateMachine.test.ts`

- [ ] **Step 1: 写状态机测试**

创建 `engine/battle-v5/tests/core/CombatStateMachine.test.ts`:

```typescript
import { CombatStateMachine } from '../../core/CombatStateMachine';
import { CombatPhase } from '../../core/types';

describe('CombatStateMachine', () => {
  it('应该按照正确顺序转换状态', () => {
    const phases: CombatPhase[] = [];
    const context = {
      turn: 1,
      maxTurns: 10,
      units: new Map(),
      battleEnded: false,
      winner: null,
    };

    // 订阅所有状态事件来记录转换顺序
    // ... 测试实现

    const stateMachine = new CombatStateMachine(context);
    stateMachine.start();

    // 验证状态转换顺序
    expect(phases).toContain(CombatPhase.INIT);
    expect(phases).toContain(CombatPhase.DESTINY_AWAKEN);
    // ... 更多验证
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

```bash
npm test -- engine/battle-v5/tests/core/CombatStateMachine.test.ts
```
Expected: FAIL - "CombatStateMachine not defined"

- [ ] **Step 3: 实现状态机**

创建 `engine/battle-v5/core/CombatStateMachine.ts`:

```typescript
import { CombatPhase } from './types';
import { EventBus } from './EventBus';

interface CombatState {
  phase: CombatPhase;
  onEnter(): void;
  onUpdate(): void;
  onExit(): void;
}

export interface CombatContext {
  turn: number;
  maxTurns: number;
  units: Map<string, any>;
  battleEnded: boolean;
  winner: string | null;
}

export class CombatStateMachine {
  private _currentState: CombatState | null = null;
  private _states = new Map<CombatPhase, CombatState>();
  private _context: CombatContext;

  constructor(context: CombatContext) {
    this._context = context;
    this._initStates();
  }

  private _initStates(): void {
    // INIT 状态
    this._states.set(CombatPhase.INIT, {
      phase: CombatPhase.INIT,
      onEnter: () => {
        console.log('[状态] 战斗初始化');
        EventBus.instance.publish({
          type: 'BattleInitEvent',
          priority: 100,
          timestamp: Date.now(),
        });
      },
      onUpdate: () => this._switchTo(CombatPhase.DESTINY_AWAKEN),
      onExit: () => {},
    });

    // DESTINY_AWAKEN 状态
    this._states.set(CombatPhase.DESTINY_AWAKEN, {
      phase: CombatPhase.DESTINY_AWAKEN,
      onEnter: () => {
        console.log('[状态] 命格觉醒阶段');
        EventBus.instance.publish({
          type: 'DestinyAwakenEvent',
          priority: 100,
          timestamp: Date.now(),
          data: { turn: this._context.turn },
        });
      },
      onUpdate: () => this._switchTo(CombatPhase.ROUND_START),
      onExit: () => {},
    });

    // ROUND_START 状态
    this._states.set(CombatPhase.ROUND_START, {
      phase: CombatPhase.ROUND_START,
      onEnter: () => {
        console.log('[状态] 回合开始');
        EventBus.instance.publish({
          type: 'RoundStartEvent',
          priority: 90,
          timestamp: Date.now(),
          data: { turn: this._context.turn },
        });
      },
      onUpdate: () => this._switchTo(CombatPhase.ROUND_PRE),
      onExit: () => {},
    });

    // ROUND_PRE 状态
    this._states.set(CombatPhase.ROUND_PRE, {
      phase: CombatPhase.ROUND_PRE,
      onEnter: () => {
        console.log('[状态] 回合前置结算');
        EventBus.instance.publish({
          type: 'RoundPreEvent',
          priority: 85,
          timestamp: Date.now(),
          data: { turn: this._context.turn },
        });
      },
      onUpdate: () => this._switchTo(CombatPhase.TURN_ORDER),
      onExit: () => {},
    });

    // TURN_ORDER 状态
    this._states.set(CombatPhase.TURN_ORDER, {
      phase: CombatPhase.TURN_ORDER,
      onEnter: () => {
        console.log('[状态] 出手顺序判定');
        EventBus.instance.publish({
          type: 'TurnOrderEvent',
          priority: 80,
          timestamp: Date.now(),
          data: { turn: this._context.turn },
        });
      },
      onUpdate: () => this._switchTo(CombatPhase.ACTION),
      onExit: () => {},
    });

    // ACTION 状态
    this._states.set(CombatPhase.ACTION, {
      phase: CombatPhase.ACTION,
      onEnter: () => {
        console.log('[状态] 出手行动');
        EventBus.instance.publish({
          type: 'ActionEvent',
          priority: 70,
          timestamp: Date.now(),
          data: { turn: this._context.turn },
        });
      },
      onUpdate: () => this._switchTo(CombatPhase.ROUND_POST),
      onExit: () => {},
    });

    // ROUND_POST 状态
    this._states.set(CombatPhase.ROUND_POST, {
      phase: CombatPhase.ROUND_POST,
      onEnter: () => {
        console.log('[状态] 回合后置结算');
        EventBus.instance.publish({
          type: 'RoundPostEvent',
          priority: 60,
          timestamp: Date.now(),
          data: { turn: this._context.turn },
        });
      },
      onUpdate: () => this._switchTo(CombatPhase.VICTORY_CHECK),
      onExit: () => {},
    });

    // VICTORY_CHECK 状态
    this._states.set(CombatPhase.VICTORY_CHECK, {
      phase: CombatPhase.VICTORY_CHECK,
      onEnter: () => {
        console.log('[状态] 胜负判定');
        EventBus.instance.publish({
          type: 'VictoryCheckEvent',
          priority: 50,
          timestamp: Date.now(),
          data: { turn: this._context.turn },
        });
      },
      onUpdate: () => {
        if (this._context.battleEnded) {
          this._switchTo(CombatPhase.END);
        } else {
          this._context.turn++;
          // 跳过命格觉醒（仅第1回合）
          this._switchTo(CombatPhase.ROUND_START);
        }
      },
      onExit: () => {},
    });

    // END 状态
    this._states.set(CombatPhase.END, {
      phase: CombatPhase.END,
      onEnter: () => {
        console.log('[状态] 战斗结束');
        EventBus.instance.publish({
          type: 'BattleEndEvent',
          priority: 100,
          timestamp: Date.now(),
          data: {
            winner: this._context.winner,
            turns: this._context.turn,
          },
        });
      },
      onUpdate: () => {},
      onExit: () => {},
    });
  }

  private _switchTo(phase: CombatPhase): void {
    if (this._currentState) {
      this._currentState.onExit();
    }

    this._currentState = this._states.get(phase) || null;

    if (this._currentState) {
      this._currentState.onEnter();
      this._currentState.onUpdate();
    }
  }

  public start(): void {
    this._switchTo(CombatPhase.INIT);
  }

  public getCurrentPhase(): CombatPhase | null {
    return this._currentState?.phase || null;
  }

  public endBattle(winner: string): void {
    this._context.battleEnded = true;
    this._context.winner = winner;
  }
}
```

- [ ] **Step 4: 运行测试验证通过**

```bash
npm test -- engine/battle-v5/tests/core/CombatStateMachine.test.ts
```
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add engine/battle-v5/
git commit -m "feat(battle-v5): add CombatStateMachine with 9 phases

- Implement state machine with 9 combat phases
- Add state transition logic
- Skip DESTINY_AWAKEN after turn 1
- Add unit tests for state transitions
- Integrate with EventBus for phase events

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Chunk 2: 属性与单元（阶段二）

### Task 3: 实现属性集

**Files:**
- Create: `engine/battle-v5/units/AttributeSet.ts`
- Test: `engine/battle-v5/tests/units/AttributeSet.test.ts`

- [ ] **Step 1: 写属性集测试**

创建 `engine/battle-v5/tests/units/AttributeSet.test.ts`:

```typescript
import { AttributeSet } from '../../units/AttributeSet';
import { AttributeType, ModifierType } from '../../core/types';

describe('AttributeSet', () => {
  it('应该正确初始化5维属性', () => {
    const attrs = new AttributeSet({
      [AttributeType.SPIRIT]: 80,
      [AttributeType.PHYSIQUE]: 60,
    });

    expect(attrs.getValue(AttributeType.SPIRIT)).toBe(80);
    expect(attrs.getValue(AttributeType.PHYSIQUE)).toBe(60);
    expect(attrs.getValue(AttributeType.AGILITY)).toBe(10); // 默认值
  });

  it('应该按6阶段顺序计算修改器', () => {
    const attrs = new AttributeSet({ [AttributeType.SPIRIT]: 100 });

    // BASE: 100
    expect(attrs.getBaseValue(AttributeType.SPIRIT)).toBe(100);

    // FIXED: +20
    attrs.addModifier({
      id: 'fixed1',
      attrType: AttributeType.SPIRIT,
      type: ModifierType.FIXED,
      value: 20,
      source: {},
    });

    // ADD: +10%
    attrs.addModifier({
      id: 'add1',
      attrType: AttributeType.SPIRIT,
      type: ModifierType.ADD,
      value: 0.1,
      source: {},
    });

    // MULTIPLY: ×1.2
    attrs.addModifier({
      id: 'mult1',
      attrType: AttributeType.SPIRIT,
      type: ModifierType.MULTIPLY,
      value: 1.2,
      source: {},
    });

    // 计算: (100 + 20) × 1.1 × 1.2 = 120 × 1.1 × 1.2 = 158.4 → 158
    expect(attrs.getValue(AttributeType.SPIRIT)).toBe(158);
  });

  it('应该正确计算派生属性', () => {
    const attrs = new AttributeSet({
      [AttributeType.PHYSIQUE]: 50,
      [AttributeType.SPIRIT]: 30,
    });

    // HP = 100 + 50*10 + 30*2 = 100 + 500 + 60 = 660
    expect(attrs.getMaxHp()).toBe(660);

    // MP = 100 + 30*5 + 10*3 = 100 + 150 + 30 = 280
    expect(attrs.getMaxMp()).toBe(280);
  });

  it('应该支持克隆', () => {
    const attrs1 = new AttributeSet({ [AttributeType.SPIRIT]: 80 });
    attrs1.addModifier({
      id: 'mod1',
      attrType: AttributeType.SPIRIT,
      type: ModifierType.ADD,
      value: 0.1,
      source: {},
    });

    const attrs2 = attrs1.clone();

    expect(attrs2.getValue(AttributeType.SPIRIT)).toBe(88); // 80 × 1.1

    // 修改副本不影响原版
    attrs2.setBaseValue(AttributeType.SPIRIT, 100);
    expect(attrs1.getValue(AttributeType.SPIRIT)).toBe(88);
    expect(attrs2.getValue(AttributeType.SPIRIT)).toBe(110); // 100 × 1.1
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

```bash
npm test -- engine/battle-v5/tests/units/AttributeSet.test.ts
```
Expected: FAIL - "AttributeSet not defined"

- [ ] **Step 3: 实现属性集**

创建 `engine/battle-v5/units/AttributeSet.ts`:

```typescript
import { AttributeType, AttributeModifier, ModifierType } from '../core/types';

class Attribute {
  readonly type: AttributeType;
  private _baseValue: number;
  private _modifiers: AttributeModifier[] = [];

  constructor(type: AttributeType, baseValue: number) {
    this.type = type;
    this._baseValue = baseValue;
  }

  getFinalValue(): number {
    // 6阶段计算: BASE → FIXED → ADD → MULTIPLY → FINAL → OVERRIDE
    let final = this._baseValue;

    // FIXED: 固定值加成
    final += this._modifiers
      .filter((m) => m.type === ModifierType.FIXED)
      .reduce((sum, m) => sum + m.value, 0);

    // ADD: 百分比加成
    const addBonus = this._modifiers
      .filter((m) => m.type === ModifierType.ADD)
      .reduce((sum, m) => sum + m.value, 0);
    final *= (1 + addBonus);

    // MULTIPLY: 乘法叠加
    const multBonus = this._modifiers
      .filter((m) => m.type === ModifierType.MULTIPLY)
      .reduce((product, m) => product * m.value, 1);
    final *= multBonus;

    // FINAL: 最终修正
    const finalMod = this._modifiers.find((m) => m.type === ModifierType.FINAL);
    if (finalMod) {
      final += finalMod.value;
    }

    // OVERRIDE: 覆盖
    const override = this._modifiers.find((m) => m.type === ModifierType.OVERRIDE);
    if (override) {
      final = override.value;
    }

    return Math.max(0, Math.floor(final));
  }

  addModifier(modifier: AttributeModifier): void {
    this._modifiers.push(modifier);
  }

  removeModifier(modifierId: string): void {
    this._modifiers = this._modifiers.filter((m) => m.id !== modifierId);
  }

  clearModifiers(): void {
    this._modifiers = [];
  }

  getBaseValue(): number {
    return this._baseValue;
  }

  setBaseValue(value: number): void {
    this._baseValue = value;
  }
}

export class AttributeSet {
  private _attributes = new Map<AttributeType, Attribute>();

  constructor(baseValues: Partial<Record<AttributeType, number>>) {
    Object.values(AttributeType).forEach((attrType) => {
      const baseValue = baseValues[attrType] ?? 10;
      this._attributes.set(attrType, new Attribute(attrType, baseValue));
    });
  }

  getValue(attrType: AttributeType): number {
    const attr = this._attributes.get(attrType);
    return attr?.getFinalValue() ?? 0;
  }

  getBaseValue(attrType: AttributeType): number {
    const attr = this._attributes.get(attrType);
    return attr?.getBaseValue() ?? 0;
  }

  setBaseValue(attrType: AttributeType, value: number): void {
    const attr = this._attributes.get(attrType);
    if (attr) {
      attr.setBaseValue(value);
    }
  }

  addModifier(modifier: AttributeModifier): void {
    const attr = this._attributes.get(modifier.attrType);
    if (attr) {
      attr.addModifier(modifier);
    }
  }

  removeModifier(modifierId: string): void {
    this._attributes.forEach((attr) => {
      attr.removeModifier(modifierId);
    });
  }

  clearModifiers(): void {
    this._attributes.forEach((attr) => {
      attr.clearModifiers();
    });
  }

  getAllValues(): Record<AttributeType, number> {
    const result = {} as Record<AttributeType, number>;
    this._attributes.forEach((attr, type) => {
      result[type] = attr.getFinalValue();
    });
    return result;
  }

  getMaxHp(): number {
    const physique = this.getValue(AttributeType.PHYSIQUE);
    const spirit = this.getValue(AttributeType.SPIRIT);
    return 100 + physique * 10 + spirit * 2;
  }

  getMaxMp(): number {
    const spirit = this.getValue(AttributeType.SPIRIT);
    const comprehension = this.getValue(AttributeType.COMPREHENSION);
    return 100 + spirit * 5 + comprehension * 3;
  }

  getCritRate(): number {
    const agility = this.getValue(AttributeType.AGILITY);
    const comprehension = this.getValue(AttributeType.COMPREHENSION);
    const baseRate = 0.05;
    const bonusRate = agility * 0.001 + comprehension * 0.0005;
    return Math.min(0.6, baseRate + bonusRate);
  }

  getEvasionRate(): number {
    const agility = this.getValue(AttributeType.AGILITY);
    return Math.min(0.3, agility * 0.0005);
  }

  clone(): AttributeSet {
    const cloned = new AttributeSet({});
    this._attributes.forEach((attr, type) => {
      cloned.setBaseValue(type, attr.getBaseValue());
    });
    return cloned;
  }
}
```

- [ ] **Step 4: 运行测试验证通过**

```bash
npm test -- engine/battle-v5/tests/units/AttributeSet.test.ts
```
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add engine/battle-v5/
git commit -m "feat(battle-v5): add AttributeSet with 6-stage modifiers

- Implement AttributeSet with 6-stage modifier calculation
- Support BASE → FIXED → ADD → MULTIPLY → FINAL → OVERRIDE order
- Add derived attribute calculation (HP, MP, CritRate, EvasionRate)
- Add clone support for prototype pattern
- Add comprehensive unit tests

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 4: 实现战斗单元

**Files:**
- Create: `engine/battle-v5/units/Unit.ts`
- Create: `engine/battle-v5/units/AbilityContainer.ts`
- Create: `engine/battle-v5/units/BuffContainer.ts`
- Test: `engine/battle-v5/tests/units/Unit.test.ts`

- [ ] **Step 1: 写战斗单元测试**

创建 `engine/battle-v5/tests/units/Unit.test.ts`:

```typescript
import { Unit } from '../../units/Unit';
import { AttributeType } from '../../core/types';

describe('Unit', () => {
  it('应该正确初始化战斗单元', () => {
    const unit = new Unit('player', '修仙者', {
      [AttributeType.SPIRIT]: 80,
      [AttributeType.PHYSIQUE]: 60,
    });

    expect(unit.id).toBe('player');
    expect(unit.name).toBe('修仙者');
    expect(unit.currentHp).toBeGreaterThan(0);
    expect(unit.currentMp).toBeGreaterThan(0);
    expect(unit.isAlive()).toBe(true);
  });

  it('应该支持原型克隆', () => {
    const unit1 = new Unit('player', '修仙者', {
      [AttributeType.SPIRIT]: 80,
    });

    unit1.takeDamage(100);
    unit1.consumeMp(50);

    const unit2 = unit1.clone();

    expect(unit2.id).toBe('player_mirror');
    expect(unit2.name).toBe('修仙者的镜像');
    expect(unit2.currentHp).toBe(unit1.currentHp);
    expect(unit2.currentMp).toBe(unit1.currentMp);
  });

  it('应该正确处理伤害和治疗', () => {
    const unit = new Unit('player', '修仙者', {
      [AttributeType.PHYSIQUE]: 50,
    });

    const maxHp = unit.maxHp;
    unit.takeDamage(100);
    expect(unit.currentHp).toBe(maxHp - 100);

    unit.heal(50);
    expect(unit.currentHp).toBe(maxHp - 50);

    unit.heal(1000); // 超治疗
    expect(unit.currentHp).toBe(maxHp);
  });
});
```

- [ ] **Step 2: 实现容器（AbilityContainer 和 BuffContainer 的简化版本）**

创建 `engine/battle-v5/units/AbilityContainer.ts`:

```typescript
import { Unit } from './Unit';
import { Ability } from '../abilities/Ability';

export class AbilityContainer {
  private _abilities = new Map<string, Ability>();
  private _owner: Unit;

  constructor(owner: Unit) {
    this._owner = owner;
  }

  addAbility(ability: Ability): void {
    this._abilities.set(ability.id, ability);
    ability.setActive(true);
  }

  removeAbility(abilityId: string): void {
    const ability = this._abilities.get(abilityId);
    if (ability) {
      ability.setActive(false);
      this._abilities.delete(abilityId);
    }
  }

  getAbility(abilityId: string): Ability | undefined {
    return this._abilities.get(abilityId);
  }

  getAllAbilities(): Ability[] {
    return Array.from(this._abilities.values());
  }

  clone(owner: Unit): AbilityContainer {
    const clone = new AbilityContainer(owner);
    // 深拷贝将在 Ability 系统实现时完成
    return clone;
  }
}
```

创建 `engine/battle-v5/units/BuffContainer.ts`:

```typescript
import { Unit } from './Unit';
import { BuffId } from '../core/types';
import { Buff } from '../buffs/Buff';

export class BuffContainer {
  private _buffs = new Map<BuffId, Buff>();
  private _owner: Unit;

  constructor(owner: Unit) {
    this._owner = owner;
  }

  addBuff(buff: Buff): void {
    const existing = this._buffs.get(buff.id);
    if (existing) {
      existing.refreshDuration();
      return;
    }

    this._buffs.set(buff.id, buff);
    buff.onApply(this._owner);
    this._owner.updateDerivedStats();
  }

  removeBuff(buffId: BuffId): void {
    const buff = this._buffs.get(buffId);
    if (!buff) return;

    buff.onRemove(this._owner);
    this._buffs.delete(buffId);
    this._owner.updateDerivedStats();
  }

  getAllBuffs(): Buff[] {
    return Array.from(this._buffs.values());
  }

  getAllBuffIds(): BuffId[] {
    return Array.from(this._buffs.keys());
  }

  clear(): void {
    for (const id of this._buffs.keys()) {
      this.removeBuff(id);
    }
  }

  clone(owner: Unit): BuffContainer {
    const clone = new BuffContainer(owner);
    // 深拷贝将在 Buff 系统实现时完成
    return clone;
  }
}
```

- [ ] **Step 3: 实现战斗单元**

创建 `engine/battle-v5/units/Unit.ts`:

```typescript
import { UnitId } from '../core/types';
import { AttributeSet } from './AttributeSet';
import { AbilityContainer } from './AbilityContainer';
import { BuffContainer } from './BuffContainer';
import { AttributeType } from '../core/types';

export class Unit {
  readonly id: UnitId;
  readonly name: string;
  readonly attributes: AttributeSet;
  readonly abilities: AbilityContainer;
  readonly buffs: BuffContainer;

  currentHp: number;
  currentMp: number;
  maxHp: number;
  maxMp: number;

  isDefending: boolean = false;
  isControlled: boolean = false;

  constructor(
    id: UnitId,
    name: string,
    baseAttrs: Partial<Record<AttributeType, number>>,
  ) {
    this.id = id;
    this.name = name;

    this.attributes = new AttributeSet(baseAttrs);
    this.abilities = new AbilityContainer(this);
    this.buffs = new BuffContainer(this);

    this.maxHp = this.attributes.getMaxHp();
    this.maxMp = this.attributes.getMaxMp();
    this.currentHp = this.maxHp;
    this.currentMp = this.maxMp;
  }

  updateDerivedStats(): void {
    this.maxHp = this.attributes.getMaxHp();
    this.maxMp = this.attributes.getMaxMp();
    this.currentHp = Math.min(this.currentHp, this.maxHp);
    this.currentMp = Math.min(this.currentMp, this.maxMp);
  }

  takeDamage(damage: number): void {
    this.currentHp = Math.max(0, this.currentHp - damage);
  }

  heal(amount: number): void {
    this.currentHp = Math.min(this.maxHp, this.currentHp + amount);
  }

  consumeMp(amount: number): boolean {
    if (this.currentMp < amount) return false;
    this.currentMp -= amount;
    return true;
  }

  restoreMp(amount: number): void {
    this.currentMp = Math.min(this.maxMp, this.currentMp + amount);
  }

  isAlive(): boolean {
    return this.currentHp > 0;
  }

  getHpPercent(): number {
    return this.maxHp > 0 ? this.currentHp / this.maxHp : 0;
  }

  getMpPercent(): number {
    return this.maxMp > 0 ? this.currentMp / this.maxMp : 0;
  }

  clone(): Unit {
    const clone = new Unit(
      this.id + '_mirror',
      this.name + '的镜像',
      this.attributes.getAllValues(),
    );

    (clone as any).attributes = this.attributes.clone();
    (clone as any).abilities = this.abilities.clone(clone);
    (clone as any).buffs = this.buffs.clone(clone);

    clone.currentHp = this.currentHp;
    clone.currentMp = this.currentMp;
    clone.maxHp = this.maxHp;
    clone.maxMp = this.maxMp;

    return clone;
  }

  getSnapshot(): object {
    return {
      unitId: this.id,
      name: this.name,
      attributes: this.attributes.getAllValues(),
      currentHp: this.currentHp,
      maxHp: this.maxHp,
      currentMp: this.currentMp,
      maxMp: this.maxMp,
      buffs: this.buffs.getAllBuffIds(),
      isAlive: this.isAlive(),
      hpPercent: this.getHpPercent(),
      mpPercent: this.getMpPercent(),
    };
  }

  resetTurnState(): void {
    this.isDefending = false;
    this.isControlled = false;
  }
}
```

- [ ] **Step 4: 运行测试验证通过**

```bash
npm test -- engine/battle-v5/tests/units/Unit.test.ts
```
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add engine/battle-v5/
git commit -m "feat(battle-v5): add Unit with prototype pattern and containers

- Implement Unit with attribute-based HP/MP calculation
- Add AbilityContainer and BuffContainer
- Support prototype cloning for mirror PVP
- Add damage, heal, and MP consumption methods
- Add snapshot generation for combat logs
- Add comprehensive unit tests

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Chunk 3: 能力与BUFF系统（阶段三）

### Task 5: 实现 Ability 基类和 ActiveSkill/PassiveAbility

**Files:**
- Modify: `engine/battle-v5/abilities/Ability.ts`
- Create: `engine/battle-v5/abilities/ActiveSkill.ts`
- Create: `engine/battle-v5/abilities/PassiveAbility.ts`
- Test: `engine/battle-v5/tests/abilities/Ability.test.ts`

- [ ] **Step 1: 写 Ability 测试**

创建 `engine/battle-v5/tests/abilities/Ability.test.ts`:

```typescript
import { Ability } from '../../abilities/Ability';
import { AbilityType } from '../../core/types';
import { Unit } from '../../units/Unit';
import { AttributeType } from '../../core/types';
import { EventBus } from '../../core/EventBus';

describe('Ability', () => {
  let unit: Unit;
  let eventBus: EventBus;

  beforeEach(() => {
    eventBus = EventBus.instance;
    eventBus.reset();
    unit = new Unit('test_unit', '测试单位', {
      [AttributeType.SPIRIT]: 50,
    });
  });

  describe('基础功能', () => {
    it('应该正确初始化能力', () => {
      const ability = new Ability('test_ability', '测试能力', AbilityType.ACTIVE_SKILL);
      expect(ability.id).toBe('test_ability');
      expect(ability.name).toBe('测试能力');
      expect(ability.type).toBe(AbilityType.ACTIVE_SKILL);
      expect(ability.isActive()).toBe(false);
    });

    it('应该支持激活和停用', () => {
      const ability = new Ability('test_ability', '测试能力', AbilityType.ACTIVE_SKILL);
      ability.setOwner(unit);
      ability.setActive(true);
      expect(ability.isActive()).toBe(true);

      ability.setActive(false);
      expect(ability.isActive()).toBe(false);
    });
  });

  describe('事件订阅', () => {
    it('激活时应该订阅事件', () => {
      const ability = new Ability('test_ability', '测试能力', AbilityType.PASSIVE_SKILL);
      ability.setOwner(unit);

      let eventReceived = false;
      ability.onActivate = () => {
        eventReceived = true;
      };

      ability.setActive(true);
      expect(eventReceived).toBe(true);
    });

    it('停用时应该取消订阅事件', () => {
      const ability = new Ability('test_ability', '测试能力', AbilityType.PASSIVE_SKILL);
      ability.setOwner(unit);

      let deactivated = false;
      ability.onDeactivate = () => {
        deactivated = true;
      };

      ability.setActive(true);
      ability.setActive(false);
      expect(deactivated).toBe(true);
    });
  });

  describe('触发条件检查', () => {
    it('默认情况下总是可以触发', () => {
      const ability = new Ability('test_ability', '测试能力', AbilityType.ACTIVE_SKILL);
      expect(ability.canTrigger(undefined as any)).toBe(true);
    });
  });

  describe('冷却管理', () => {
    it('应该支持冷却时间', () => {
      const ability = new Ability('test_ability', '测试能力', AbilityType.ACTIVE_SKILL);
      ability.setCooldown(3);
      expect(ability.getCurrentCooldown()).toBe(0);

      ability.startCooldown();
      expect(ability.getCurrentCooldown()).toBe(3);

      ability.tickCooldown();
      expect(ability.getCurrentCooldown()).toBe(2);

      ability.tickCooldown();
      ability.tickCooldown();
      expect(ability.getCurrentCooldown()).toBe(0);
      expect(ability.isReady()).toBe(true);
    });
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

```bash
npm test -- engine/battle-v5/tests/abilities/Ability.test.ts
```
Expected: FAIL

- [ ] **Step 3: 实现 Ability 基类**

修改 `engine/battle-v5/abilities/Ability.ts`:

```typescript
import { AbilityId, AbilityType, CombatEvent } from '../core/types';
import { Unit } from '../units/Unit';
import { EventBus } from '../core/EventBus';

type EventHandler = (event: CombatEvent) => void;

/**
 * 能力基类
 * 所有技能、命格、被动能力的基类
 */
export class Ability {
  readonly id: AbilityId;
  readonly name: string;
  readonly type: AbilityType;
  private _active: boolean = false;
  private _owner: Unit | null = null;
  private _cooldown: number = 0;
  private _maxCooldown: number = 0;
  private _eventHandlers: Map<string, EventHandler> = new Map();

  constructor(id: AbilityId, name: string, type: AbilityType) {
    this.id = id;
    this.name = name;
    this.type = type;
  }

  setOwner(owner: Unit): void {
    this._owner = owner;
  }

  getOwner(): Unit | null {
    return this._owner;
  }

  setActive(active: boolean): void {
    if (this._active === active) return;

    this._active = active;

    if (active) {
      this.onActivate();
    } else {
      this.onDeactivate();
    }
  }

  isActive(): boolean {
    return this._active;
  }

  /**
   * 能力激活时调用
   * 子类可以订阅事件
   */
  protected onActivate(): void {
    // 子类实现
  }

  /**
   * 能力停用时调用
   * 子类应该取消订阅事件
   */
  protected onDeactivate(): void {
    // 取消所有事件订阅
    for (const [eventType, handler] of this._eventHandlers) {
      EventBus.instance.unsubscribe(eventType, handler);
    }
    this._eventHandlers.clear();
  }

  /**
   * 订阅事件（辅助方法）
   */
  protected subscribeEvent(eventType: string, handler: EventHandler, priority?: number): void {
    EventBus.instance.subscribe(eventType, handler, priority);
    this._eventHandlers.set(eventType, handler);
  }

  /**
   * 检查是否可以触发
   * 子类可以重写此方法实现自定义条件
   */
  canTrigger(context: unknown): boolean {
    return true;
  }

  /**
   * 执行能力效果
   * 子类必须实现此方法
   */
  execute(context: unknown): void {
    // 子类实现
  }

  /**
   * 冷却管理
   */
  setCooldown(cooldown: number): void {
    this._maxCooldown = cooldown;
  }

  startCooldown(): void {
    this._cooldown = this._maxCooldown;
  }

  getCurrentCooldown(): number {
    return this._cooldown;
  }

  tickCooldown(): void {
    if (this._cooldown > 0) {
      this._cooldown--;
    }
  }

  isReady(): boolean {
    return this._cooldown === 0;
  }

  resetCooldown(): void {
    this._cooldown = 0;
  }
}
```

- [ ] **Step 4: 实现 ActiveSkill 基类**

创建 `engine/battle-v5/abilities/ActiveSkill.ts`:

```typescript
import { Ability, AbilityId } from './Ability';
import { AbilityType } from '../core/types';
import { Unit } from '../units/Unit';

/**
 * 主动技能基类
 * 有MP消耗、冷却时间、触发条件
 */
export abstract class ActiveSkill extends Ability {
  protected _mpCost: number;
  protected _cooldown: number;

  constructor(id: AbilityId, name: string, mpCost: number = 0, cooldown: number = 0) {
    super(id, name, AbilityType.ACTIVE_SKILL);
    this._mpCost = mpCost;
    this._cooldown = cooldown;
    this.setCooldown(cooldown);
  }

  canExecute(unit: Unit): boolean {
    // 检查冷却
    if (!this.isReady()) return false;

    // 检查MP
    if (unit.currentMp < this._mpCost) return false;

    // 检查自定义条件
    return this.canTrigger({ unit });
  }

  execute(unit: Unit, target: Unit): void {
    if (!this.canExecute(unit)) {
      return;
    }

    // 消耗MP
    unit.consumeMp(this._mpCost);

    // 开始冷却
    this.startCooldown();

    // 执行技能效果
    this.executeSkill(unit, target);
  }

  /**
   * 子类实现具体技能效果
   */
  protected abstract executeSkill(caster: Unit, target: Unit): void;

  getMpCost(): number {
    return this._mpCost;
  }

  getCooldown(): number {
    return this._cooldown;
  }
}
```

- [ ] **Step 5: 实现 PassiveAbility 基类**

创建 `engine/battle-v5/abilities/PassiveAbility.ts`:

```typescript
import { Ability, AbilityId } from './Ability';
import { AbilityType, CombatEvent } from '../core/types';
import { Unit } from '../units/Unit';

/**
 * 被动能力基类
 * 通过事件触发，包括被动技能和命格
 */
export abstract class PassiveAbility extends Ability {
  constructor(id: AbilityId, name: string) {
    super(id, name, AbilityType.PASSIVE_SKILL);
  }

  protected onActivate(): void {
    // 子类订阅事件
    this.setupEventListeners();
  }

  /**
   * 子类实现，设置事件监听
   */
  protected abstract setupEventListeners(): void;

  /**
   * 通用事件处理包装器
   */
  protected createEventHandler(handler: (event: CombatEvent) => void): (event: CombatEvent) => void {
    return (event: CombatEvent) => {
      const owner = this.getOwner();
      if (!owner || !owner.isAlive()) return;

      handler(event);
    };
  }
}
```

- [ ] **Step 6: 运行测试验证通过**

```bash
npm test -- engine/battle-v5/tests/abilities/Ability.test.ts
```
Expected: PASS

- [ ] **Step 7: 提交**

```bash
git add engine/battle-v5/
git commit -m "feat(battle-v5): add Ability system with ActiveSkill and PassiveAbility

- Implement Ability base class with event subscription
- Add ActiveSkill base class for MP-cost skills with cooldown
- Add PassiveAbility base class for event-triggered abilities
- Support cooldown management and ready state checking
- Add comprehensive unit tests

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 6: 实现 Buff 基类和生命周期

**Files:**
- Modify: `engine/battle-v5/buffs/Buff.ts`
- Test: `engine/battle-v5/tests/buffs/Buff.test.ts`

- [ ] **Step 1: 写 Buff 测试**

创建 `engine/battle-v5/tests/buffs/Buff.test.ts`:

```typescript
import { Buff } from '../../buffs/Buff';
import { BuffType, BuffId } from '../../core/types';
import { Unit } from '../../units/Unit';
import { AttributeType, ModifierType } from '../../core/types';
import { EventBus } from '../../core/EventBus';

describe('Buff', () => {
  let unit: Unit;
  let eventBus: EventBus;

  beforeEach(() => {
    eventBus = EventBus.instance;
    eventBus.reset();
    unit = new Unit('test_unit', '测试单位', {
      [AttributeType.SPIRIT]: 50,
      [AttributeType.PHYSIQUE]: 50,
    });
  });

  describe('基础功能', () => {
    it('应该正确初始化 Buff', () => {
      const buff = new Buff('test_buff', '测试Buff', BuffType.BUFF, 3);
      expect(buff.id).toBe('test_buff');
      expect(buff.name).toBe('测试Buff');
      expect(buff.type).toBe(BuffType.BUFF);
      expect(buff.getDuration()).toBe(3);
    });

    it('应该支持永久 Buff', () => {
      const buff = new Buff('perm_buff', '永久Buff', BuffType.BUFF, -1);
      expect(buff.isPermanent()).toBe(true);
    });

    it('应该正确计算持续时间', () => {
      const buff = new Buff('temp_buff', '临时Buff', BuffType.BUFF, 3);
      expect(buff.isExpired()).toBe(false);

      buff.tickDuration();
      expect(buff.getDuration()).toBe(2);

      buff.tickDuration();
      buff.tickDuration();
      expect(buff.isExpired()).toBe(true);
    });
  });

  describe('生命周期钩子', () => {
    it('应用时应该调用 onApply', () => {
      const buff = new Buff('test_buff', '测试Buff', BuffType.BUFF, 3);
      let applied = false;
      buff.onApply = (u) => {
        applied = true;
        expect(u).toBe(unit);
      };
      buff.onApply(unit);
      expect(applied).toBe(true);
    });

    it('移除时应该调用 onRemove', () => {
      const buff = new Buff('test_buff', '测试Buff', BuffType.BUFF, 3);
      let removed = false;
      buff.onRemove = (u) => {
        removed = true;
        expect(u).toBe(unit);
      };
      buff.onRemove(unit);
      expect(removed).toBe(true);
    });

    it('刷新时应该重置持续时间', () => {
      const buff = new Buff('test_buff', '测试Buff', BuffType.BUFF, 3);
      buff.tickDuration();
      buff.tickDuration();
      expect(buff.getDuration()).toBe(1);

      buff.refreshDuration();
      expect(buff.getDuration()).toBe(3);
    });
  });

  describe('回合钩子', () => {
    it('应该支持回合开始钩子', () => {
      const buff = new Buff('test_buff', '测试Buff', BuffType.BUFF, 3);
      let called = false;
      buff.onTurnStart = (u) => {
        called = true;
      };
      buff.onTurnStart(unit);
      expect(called).toBe(true);
    });

    it('应该支持回合结束钩子', () => {
      const buff = new Buff('test_buff', '测试Buff', BuffType.BUFF, 3);
      let called = false;
      buff.onTurnEnd = (u) => {
        called = true;
      };
      buff.onTurnEnd(unit);
      expect(called).toBe(true);
    });
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

```bash
npm test -- engine/battle-v5/tests/buffs/Buff.test.ts
```
Expected: FAIL

- [ ] **Step 3: 实现 Buff 基类**

修改 `engine/battle-v5/buffs/Buff.ts`:

```typescript
import { BuffId, BuffType } from '../core/types';
import { Unit } from '../units/Unit';

/**
 * BUFF 基类
 * 支持完整生命周期和持续时间管理
 */
export class Buff {
  readonly id: BuffId;
  readonly name: string;
  readonly type: BuffType;
  private _duration: number;
  private _maxDuration: number;

  // 生命周期钩子（可被子类重写）
  onApply: (unit: Unit) => void = () => {};
  onRemove: (unit: Unit) => void = () => {};
  onTurnStart: (unit: Unit) => void = () => {};
  onTurnEnd: (unit: Unit) => void = () => {};
  onBeforeAct: (unit: Unit) => void = () => {};
  onAfterAct: (unit: Unit) => void = () => {};
  onBattleStart: (unit: Unit) => void = () => {};
  onBattleEnd: (unit: Unit) => void = () => {};

  constructor(id: BuffId, name: string, type: BuffType, duration: number) {
    this.id = id;
    this.name = name;
    this.type = type;
    this._maxDuration = duration;
    this._duration = duration;
  }

  /**
   * 持续时间管理
   */
  getDuration(): number {
    return this._duration;
  }

  tickDuration(): void {
    if (!this.isPermanent()) {
      this._duration = Math.max(0, this._duration - 1);
    }
  }

  refreshDuration(): void {
    this._duration = this._maxDuration;
  }

  isPermanent(): boolean {
    return this._maxDuration === -1;
  }

  isExpired(): boolean {
    return !this.isPermanent() && this._duration <= 0;
  }

  /**
   * 属性修改器（可被子类重写）
   */
  getAttributeModifiers(): [] {
    return [];
  }
}
```

- [ ] **Step 4: 运行测试验证通过**

```bash
npm test -- engine/battle-v5/tests/buffs/Buff.test.ts
```
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add engine/battle-v5/
git commit -m "feat(battle-v5): add Buff system with lifecycle hooks

- Implement Buff base class with duration management
- Support permanent buffs with duration -1
- Add lifecycle hooks: onApply, onRemove, onTurnStart, onTurnEnd, etc.
- Add duration tick and refresh functionality
- Add comprehensive unit tests

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 7: 实现示例技能（火球术）

**Files:**
- Create: `engine/battle-v5/abilities/examples/FireballSkill.ts`
- Test: `engine/battle-v5/tests/abilities/examples/FireballSkill.test.ts`

- [x] **Step 1: 写火球术测试**

创建 `engine/battle-v5/tests/abilities/examples/FireballSkill.test.ts`:

```typescript
import { FireballSkill } from '../../../abilities/examples/FireballSkill';
import { Unit } from '../../../units/Unit';
import { AttributeType } from '../../../core/types';

describe('FireballSkill', () => {
  let caster: Unit;
  let target: Unit;

  beforeEach(() => {
    caster = new Unit('caster', '施法者', {
      [AttributeType.SPIRIT]: 80,
    });
    target = new Unit('target', '目标', {
      [AttributeType.PHYSIQUE]: 50,
    });
  });

  it('应该正确初始化火球术', () => {
    const skill = new FireballSkill();
    expect(skill.id).toBe('fireball');
    expect(skill.name).toBe('火球术');
    expect(skill.getMpCost()).toBe(30);
    expect(skill.getCooldown()).toBe(3);
  });

  it('应该消耗 MP 并造成伤害', () => {
    const skill = new FireballSkill();
    const initialMp = caster.currentMp;
    const initialHp = target.currentHp;

    skill.execute(caster, target);

    expect(caster.currentMp).toBe(initialMp - 30);
    expect(target.currentHp).toBeLessThan(initialHp);
  });

  it('MP 不足时无法施放', () => {
    const skill = new FireballSkill();
    caster.consumeMp(caster.currentMp); // 清空 MP

    const initialHp = target.currentHp;
    skill.execute(caster, target);

    expect(target.currentHp).toBe(initialHp);
  });

  it('冷却中无法施放', () => {
    const skill = new FireballSkill();
    skill.execute(caster, target);

    // 尝试再次施放
    const initialHp = target.currentHp;
    skill.execute(caster, target);

    expect(target.currentHp).toBe(initialHp);
  });
});
```

- [x] **Step 2: 运行测试验证失败**

```bash
npm test -- engine/battle-v5/tests/abilities/examples/FireballSkill.test.ts
```
Expected: FAIL

- [x] **Step 3: 实现火球术**

创建 `engine/battle-v5/abilities/examples/FireballSkill.ts`:

```typescript
import { ActiveSkill } from '../ActiveSkill';
import { AbilityId } from '../../core/types';
import { Unit } from '../../units/Unit';

/**
 * 火球术 - 示例主动技能
 * 消耗 30 MP，造成基于灵力的魔法伤害
 */
export class FireballSkill extends ActiveSkill {
  constructor() {
    super('fireball' as AbilityId, '火球术', 30, 3);
  }

  protected executeSkill(caster: Unit, target: Unit): void {
    // 基础伤害: 灵力 × 2
    const spirit = caster.attributes.getValue('spirit' as any);
    const baseDamage = spirit * 2;

    // 造成伤害
    target.takeDamage(baseDamage);
  }
}
```

- [x] **Step 4: 运行测试验证通过**

```bash
npm test -- engine/battle-v5/tests/abilities/examples/FireballSkill.test.ts
```
Expected: PASS

- [x] **Step 5: 提交**

```bash
git add engine/battle-v5/
git commit -m "feat(battle-v5): add FireballSkill example

- Implement FireballSkill as example active skill
- Damage based on spirit attribute (spirit × 2)
- MP cost: 30, Cooldown: 3 turns
- Add comprehensive unit tests

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 8: 实现示例 Buff（力量提升）

**Files:**
- Create: `engine/battle-v5/buffs/examples/StrengthBuff.ts`
- Test: `engine/battle-v5/tests/buffs/examples/StrengthBuff.test.ts`

- [ ] **Step 1: 写力量 Buff 测试**

创建 `engine/battle-v5/tests/buffs/examples/StrengthBuff.test.ts`:

```typescript
import { StrengthBuff } from '../../../buffs/examples/StrengthBuff';
import { Unit } from '../../../units/Unit';
import { AttributeType, ModifierType } from '../../../core/types';

describe('StrengthBuff', () => {
  let unit: Unit;

  beforeEach(() => {
    unit = new Unit('test_unit', '测试单位', {
      [AttributeType.PHYSIQUE]: 50,
    });
  });

  it('应该正确初始化力量 Buff', () => {
    const buff = new StrengthBuff();
    expect(buff.id).toBe('strength_buff');
    expect(buff.name).toBe('力量提升');
    expect(buff.getDuration()).toBe(3);
  });

  it('应用时应该增加体魄属性', () => {
    const buff = new StrengthBuff();
    const originalPhysique = unit.attributes.getValue(AttributeType.PHYSIQUE);

    buff.onApply(unit);
    unit.updateDerivedStats();

    const newPhysique = unit.attributes.getValue(AttributeType.PHYSIQUE);
    expect(newPhysique).toBe(originalPhysique + 10);
  });

  it('移除时应该恢复体魄属性', () => {
    const buff = new StrengthBuff();
    buff.onApply(unit);
    unit.updateDerivedStats();

    const boostedPhysique = unit.attributes.getValue(AttributeType.PHYSIQUE);

    buff.onRemove(unit);
    unit.updateDerivedStats();

    const finalPhysique = unit.attributes.getValue(AttributeType.PHYSIQUE);
    expect(finalPhysique).toBeLessThan(boostedPhysique);
  });

  it('刷新时应该重置持续时间', () => {
    const buff = new StrengthBuff();
    buff.tickDuration();
    buff.tickDuration();
    expect(buff.getDuration()).toBe(1);

    buff.refreshDuration();
    expect(buff.getDuration()).toBe(3);
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

```bash
npm test -- engine/battle-v5/tests/buffs/examples/StrengthBuff.test.ts
```
Expected: FAIL

- [ ] **Step 3: 实现力量 Buff**

创建 `engine/battle-v5/buffs/examples/StrengthBuff.ts`:

```typescript
import { Buff } from '../Buff';
import { BuffId, BuffType, AttributeType, ModifierType, AttributeModifier } from '../../core/types';
import { Unit } from '../../units/Unit';

/**
 * 力量提升 - 示例 Buff
 * 增加 10 点体魄，持续 3 回合
 */
export class StrengthBuff extends Buff {
  private modifierId: string = 'strength_buff_modifier';

  constructor() {
    super('strength_buff' as BuffId, '力量提升', BuffType.BUFF, 3);
  }

  onApply(unit: Unit): void {
    // 添加属性修改器
    const modifier: AttributeModifier = {
      id: this.modifierId,
      attrType: AttributeType.PHYSIQUE,
      type: ModifierType.FIXED,
      value: 10,
      source: this,
    };
    unit.attributes.addModifier(modifier);
  }

  onRemove(unit: Unit): void {
    // 移除属性修改器
    unit.attributes.removeModifier(this.modifierId);
  }
}
```

- [ ] **Step 4: 运行测试验证通过**

```bash
npm test -- engine/battle-v5/tests/buffs/examples/StrengthBuff.test.ts
```
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add engine/battle-v5/
git commit -m "feat(battle-v5): add StrengthBuff example

- Implement StrengthBuff as example buff
- Adds +10 physique attribute modifier
- Duration: 3 turns
- Modifier removed on buff expire
- Add comprehensive unit tests

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## 实施进度跟踪

- [x] Chunk 1: 核心框架
  - [x] Task 1: EventBus + 核心类型
  - [x] Task 2: CombatStateMachine
- [x] Chunk 2: 属性与单元
  - [x] Task 3: AttributeSet
  - [x] Task 4: Unit + 容器
- [ ] Chunk 3: 能力与BUFF系统
  - [ ] Task 5: Ability 基类和 ActiveSkill/PassiveAbility
  - [ ] Task 6: Buff 基类和生命周期
  - [x] Task 7: 示例技能（火球术）
  - [ ] Task 8: 示例 Buff（力量提升）
- [ ] Chunk 4: 系统模块
- [ ] Chunk 5: 入口与集成

---

**下一步:** 完成 Chunk 3 后，继续编写 Chunk 4-5 的详细任务。
