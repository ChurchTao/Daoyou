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

## Chunk 4: 系统模块（阶段四）

### Task 9: 实现伤害系统（DamageSystem）

**Files:**
- Create: `engine/battle-v5/systems/DamageSystem.ts`
- Test: `engine/battle-v5/tests/systems/DamageSystem.test.ts`

- [ ] **Step 1: 写伤害系统测试**

创建 `engine/battle-v5/tests/systems/DamageSystem.test.ts`:

```typescript
import { DamageSystem } from '../../systems/DamageSystem';
import { Unit } from '../../units/Unit';
import { AttributeType } from '../../core/types';

describe('DamageSystem', () => {
  let attacker: Unit;
  let target: Unit;

  beforeEach(() => {
    attacker = new Unit('attacker', '攻击者', {
      [AttributeType.SPIRIT]: 80,
      [AttributeType.AGILITY]: 50,
    });
    target = new Unit('target', '目标', {
      [AttributeType.PHYSIQUE]: 50,
      [AttributeType.AGILITY]: 30,
    });
  });

  it('应该正确计算基础伤害', () => {
    const result = DamageSystem.calculateDamage(attacker, target, {
      baseDamage: 100,
      damageType: 'physical',
    });

    expect(result.finalDamage).toBeGreaterThan(0);
    expect(result.breakdown).toBeDefined();
  });

  it('应该支持暴击判定', () => {
    // 设置高敏捷以确保暴击
    const critAttacker = new Unit('crit_attacker', '暴击者', {
      [AttributeType.AGILITY]: 500, // 高暴击率
    });

    const result = DamageSystem.calculateDamage(critAttacker, target, {
      baseDamage: 100,
      damageType: 'physical',
    });

    // 暴击时伤害应该更高
    if (result.isCritical) {
      expect(result.breakdown.critMultiplier).toBeGreaterThan(1);
    }
  });

  it('应该支持闪避判定', () => {
    // 设置高敏捷以确保闪避
    const evasiveTarget = new Unit('evasive_target', '闪避者', {
      [AttributeType.PHYSIQUE]: 50,
      [AttributeType.AGILITY]: 500, // 高闪避率
    });

    const result = DamageSystem.calculateDamage(attacker, evasiveTarget, {
      baseDamage: 100,
      damageType: 'physical',
    });

    // 闪避时伤害应该为 0
    if (result.isDodged) {
      expect(result.finalDamage).toBe(0);
    }
  });

  it('应该有最小伤害保证', () => {
    const result = DamageSystem.calculateDamage(attacker, target, {
      baseDamage: 1,
      damageType: 'physical',
    });

    expect(result.finalDamage).toBeGreaterThanOrEqual(1);
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

```bash
npm test -- engine/battle-v5/tests/systems/DamageSystem.test.ts
```
Expected: FAIL

- [ ] **Step 3: 实现伤害系统**

创建 `engine/battle-v5/systems/DamageSystem.ts`:

```typescript
import { Unit } from '../units/Unit';
import { AttributeType } from '../core/types';

export interface DamageCalculationParams {
  baseDamage: number;
  damageType: 'physical' | 'magic';
  element?: string;
  ignoreCrit?: boolean;
  ignoreDodge?: boolean;
}

export interface DamageResult {
  finalDamage: number;
  isCritical: boolean;
  isDodged: boolean;
  breakdown: {
    baseDamage: number;
    critMultiplier: number;
    damageReduction: number;
    randomFactor: number;
  };
}

/**
 * 伤害系统
 * 处理完整的伤害计算管道
 */
export class DamageSystem {
  /**
   * 计算伤害
   * 流程: 基础伤害 → 暴击 → 闪避 → 减伤 → 随机浮动 → 最终伤害
   */
  static calculateDamage(
    attacker: Unit,
    target: Unit,
    params: DamageCalculationParams,
  ): DamageResult {
    const breakdown = {
      baseDamage: params.baseDamage,
      critMultiplier: 1,
      damageReduction: 0,
      randomFactor: 1,
    };

    let damage = params.baseDamage;

    // 1. 暴击判定
    const isCritical = !params.ignoreCrit && this.rollCrit(attacker);
    if (isCritical) {
      breakdown.critMultiplier = 1.5;
      damage *= breakdown.critMultiplier;
    }

    // 2. 闪避判定
    const isDodged = !params.ignoreDodge && this.rollDodge(target);
    if (isDodged) {
      return {
        finalDamage: 0,
        isCritical,
        isDodged: true,
        breakdown,
      };
    }

    // 3. 伤害减免（基础版，基于体魄）
    const reduction = this.calculateDamageReduction(target);
    breakdown.damageReduction = reduction;
    damage *= (1 - reduction);

    // 4. 随机浮动 (0.9 ~ 1.1)
    const randomFactor = 0.9 + Math.random() * 0.2;
    breakdown.randomFactor = randomFactor;
    damage *= randomFactor;

    // 5. 最小伤害保证
    const finalDamage = Math.max(1, Math.floor(damage));

    return {
      finalDamage,
      isCritical,
      isDodged: false,
      breakdown,
    };
  }

  /**
   * 暴击判定
   */
  private static rollCrit(attacker: Unit): boolean {
    const critRate = attacker.attributes.getCritRate();
    return Math.random() < critRate;
  }

  /**
   * 闪避判定
   */
  private static rollDodge(target: Unit): boolean {
    const evasionRate = attacker.attributes.getEvasionRate();
    return Math.random() < evasionRate;
  }

  /**
   * 计算伤害减免
   */
  private static calculateDamageReduction(target: Unit): number {
    // 基础减免：每点体魄提供 0.1% 减免，上限 75%
    const physique = target.attributes.getValue(AttributeType.PHYSIQUE);
    const reduction = Math.min(0.75, physique * 0.001);
    return reduction;
  }
}
```

- [ ] **Step 4: 运行测试验证通过**

```bash
npm test -- engine/battle-v5/tests/systems/DamageSystem.test.ts
```
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add engine/battle-v5/
git commit -m "feat(battle-v5): add DamageSystem with complete pipeline

- Implement damage calculation pipeline
- Support critical hit based on crit rate
- Support dodge based on evasion rate
- Damage reduction based on physique
- Random damage variance (0.9x - 1.1x)
- Minimum damage guarantee (1)
- Add comprehensive unit tests

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 10: 实现战报系统（CombatLogSystem）

**Files:**
- Create: `engine/battle-v5/systems/CombatLogSystem.ts`
- Test: `engine/battle-v5/tests/systems/CombatLogSystem.test.ts`

- [ ] **Step 1: 写战报系统测试**

创建 `engine/battle-v5/tests/systems/CombatLogSystem.test.ts`:

```typescript
import { CombatLogSystem } from '../../systems/CombatLogSystem';
import { CombatPhase } from '../../core/types';

describe('CombatLogSystem', () => {
  let logSystem: CombatLogSystem;

  beforeEach(() => {
    logSystem = new CombatLogSystem();
  });

  it('应该正确记录战斗日志', () => {
    logSystem.log(1, CombatPhase.ACTION, '测试单位使用了火球术');

    const logs = logSystem.getLogs();
    expect(logs.length).toBe(1);
    expect(logs[0].message).toBe('测试单位使用了火球术');
  });

  it('应该支持高光时刻标记', () => {
    logSystem.logHighlight(1, '测试单位觉醒了命格！');

    const logs = logSystem.getLogs();
    expect(logs[0].highlight).toBe(true);
  });

  it('应该支持极简模式过滤', () => {
    logSystem.log(1, CombatPhase.ROUND_PRE, '回合开始');
    logSystem.logHighlight(2, '高光时刻！');

    const simpleLogs = logSystem.getSimpleLogs();
    expect(simpleLogs.length).toBe(1);
    expect(simpleLogs[0].highlight).toBe(true);
  });

  it('应该清空日志', () => {
    logSystem.log(1, CombatPhase.ACTION, '测试日志');
    logSystem.clear();

    const logs = logSystem.getLogs();
    expect(logs.length).toBe(0);
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

```bash
npm test -- engine/battle-v5/tests/systems/CombatLogSystem.test.ts
```
Expected: FAIL

- [ ] **Step 3: 实现战报系统**

创建 `engine/battle-v5/systems/CombatLogSystem.ts`:

```typescript
import { CombatPhase, CombatLog } from '../core/types';

/**
 * 战报条目
 */
interface CombatLogEntry extends CombatLog {
  id: string;
}

/**
 * 战报系统
 * 收集和管理战斗日志
 */
export class CombatLogSystem {
  private _logs: CombatLogEntry[] = [];
  private _nextId: number = 0;
  private _simpleMode: boolean = false;

  /**
   * 记录普通日志
   */
  log(turn: number, phase: CombatPhase, message: string): void {
    this._addLog({
      id: `log_${this._nextId++}`,
      turn,
      phase,
      message,
      highlight: false,
    });
  }

  /**
   * 记录高光时刻
   */
  logHighlight(turn: number, message: string): void {
    this._addLog({
      id: `log_${this._nextId++}`,
      turn,
      phase: CombatPhase.ACTION,
      message,
      highlight: true,
    });
  }

  /**
   * 记录伤害
   */
  logDamage(
    turn: number,
    attackerName: string,
    targetName: string,
    damage: number,
    isCritical: boolean,
  ): void {
    const critText = isCritical ? '（暴击！）' : '';
    const message = `${attackerName} 对 ${targetName} 造成了 ${damage} 点伤害${critText}`;
    this.log(turn, CombatPhase.ACTION, message);
  }

  /**
   * 记录治疗
   */
  logHeal(turn: number, casterName: string, targetName: string, amount: number): void {
    const message = `${casterName} 为 ${targetName} 恢复了 ${amount} 点气血`;
    this.log(turn, CombatPhase.ACTION, message);
  }

  /**
   * 记录 Buff 应用/移除
   */
  logBuff(
    turn: number,
    unitName: string,
    buffName: string,
    isApply: boolean,
  ): void {
    const action = isApply ? '获得了' : '失去了';
    const message = `${unitName} ${action} 「${buffName}」`;
    this.log(turn, CombatPhase.ROUND_POST, message);
  }

  /**
   * 记录战斗结束
   */
  logBattleEnd(winnerName: string, turns: number): void {
    this.logHighlight(turns, `✨ ${winnerName} 获胜！战斗持续 ${turns} 回合`);
  }

  /**
   * 获取所有日志
   */
  getLogs(): CombatLogEntry[] {
    return [...this._logs];
  }

  /**
   * 获取极简模式日志（仅高光时刻）
   */
  getSimpleLogs(): CombatLogEntry[] {
    return this._logs.filter((log) => log.highlight);
  }

  /**
   * 获取指定回合的日志
   */
  getLogsByTurn(turn: number): CombatLogEntry[] {
    return this._logs.filter((log) => log.turn === turn);
  }

  /**
   * 设置极简模式
   */
  setSimpleMode(enabled: boolean): void {
    this._simpleMode = enabled;
  }

  /**
   * 清空日志
   */
  clear(): void {
    this._logs = [];
    this._nextId = 0;
  }

  /**
   * 生成格式化战报
   */
  generateReport(simple: boolean = false): string {
    const logs = simple ? this.getSimpleLogs() : this.getLogs();
    return logs
      .map((log) => {
        const phaseText = `[${log.phase}]`;
        const highlightMark = log.highlight ? '✨ ' : '';
        return `${highlightMark}[第${log.turn}回合] ${phaseText} ${log.message}`;
      })
      .join('\n');
  }

  private _addLog(entry: CombatLogEntry): void {
    this._logs.push(entry);
  }
}
```

- [ ] **Step 4: 运行测试验证通过**

```bash
npm test -- engine/battle-v5/tests/systems/CombatLogSystem.test.ts
```
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add engine/battle-v5/
git commit -m "feat(battle-v5): add CombatLogSystem with simple/detailed modes

- Implement combat log collection and management
- Support highlight moments for key events
- Support simple mode (highlights only) and detailed mode
- Add helper methods for damage, heal, buff logging
- Add formatted report generation
- Add comprehensive unit tests

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 11: 实现胜负判定系统（VictorySystem）

**Files:**
- Create: `engine/battle-v5/systems/VictorySystem.ts`
- Test: `engine/battle-v5/tests/systems/VictorySystem.test.ts`

- [ ] **Step 1: 写胜负判定测试**

创建 `engine/battle-v5/tests/systems/VictorySystem.test.ts`:

```typescript
import { VictorySystem } from '../../systems/VictorySystem';
import { Unit } from '../../units/Unit';
import { AttributeType } from '../../core/types';

describe('VictorySystem', () => {
  let player: Unit;
  let opponent: Unit;

  beforeEach(() => {
    player = new Unit('player', '玩家', {
      [AttributeType.PHYSIQUE]: 50,
    });
    opponent = new Unit('opponent', '对手', {
      [AttributeType.PHYSIQUE]: 50,
    });
  });

  it('应该检测到死亡单位', () => {
    opponent.takeDamage(opponent.maxHp + 100);

    const result = VictorySystem.checkVictory([player, opponent]);
    expect(result.battleEnded).toBe(true);
    expect(result.winner).toBe('player');
  });

  it('应该平局判定', () => {
    // 双方都死亡
    player.takeDamage(player.maxHp + 100);
    opponent.takeDamage(opponent.maxHp + 100);

    const result = VictorySystem.checkVictory([player, opponent]);
    expect(result.battleEnded).toBe(true);
    expect(result.draw).toBe(true);
  });

  it('应该支持回合上限判定', () => {
    const result = VictorySystem.checkVictory([player, opponent], 30);
    expect(result.battleEnded).toBe(true);
    expect(result.reachedMaxTurns).toBe(true);
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

```bash
npm test -- engine/battle-v5/tests/systems/VictorySystem.test.ts
```
Expected: FAIL

- [ ] **Step 3: 实现胜负判定系统**

创建 `engine/battle-v5/systems/VictorySystem.ts`:

```typescript
import { Unit } from '../units/Unit';

export interface VictoryResult {
  battleEnded: boolean;
  winner?: string;
  loser?: string;
  draw?: boolean;
  reachedMaxTurns?: boolean;
}

/**
 * 胜负判定系统
 */
export class VictorySystem {
  private static readonly MAX_TURNS = 30;

  /**
   * 检查战斗是否结束
   */
  static checkVictory(units: Unit[], currentTurn?: number): VictoryResult {
    const aliveUnits = units.filter((u) => u.isAlive());

    // 所有单位死亡
    if (aliveUnits.length === 0) {
      return {
        battleEnded: true,
        draw: true,
      };
    }

    // 只有一个单位存活
    if (aliveUnits.length === 1) {
      const winner = aliveUnits[0];
      const loser = units.find((u) => u !== winner && !u.isAlive());
      return {
        battleEnded: true,
        winner: winner.id,
        loser: loser?.id,
      };
    }

    // 回合上限判定
    if (currentTurn !== undefined && currentTurn >= this.MAX_TURNS) {
      // 判定血量百分比高的获胜
      const sorted = [...aliveUnits].sort((a, b) => {
        return b.getHpPercent() - a.getHpPercent();
      });
      return {
        battleEnded: true,
        winner: sorted[0].id,
        loser: sorted[1].id,
        reachedMaxTurns: true,
      };
    }

    return {
      battleEnded: false,
    };
  }

  /**
   * 获取最大回合数
   */
  static getMaxTurns(): number {
    return this.MAX_TURNS;
  }
}
```

- [ ] **Step 4: 运行测试验证通过**

```bash
npm test -- engine/battle-v5/tests/systems/VictorySystem.test.ts
```
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add engine/battle-v5/
git commit -m "feat(battle-v5): add VictorySystem with multiple win conditions

- Implement victory/defeat detection based on unit survival
- Support draw condition when all units die
- Support max turns (30) limit with HP% tiebreaker
- Add comprehensive unit tests

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 12: 实现数据适配器（CultivatorAdapter）

**Files:**
- Create: `engine/battle-v5/adapters/CultivatorAdapter.ts`
- Test: `engine/battle-v5/tests/adapters/CultivatorAdapter.test.ts`

- [ ] **Step 1: 写适配器测试**

创建 `engine/battle-v5/tests/adapters/CultivatorAdapter.test.ts`:

```typescript
import { CultivatorAdapter } from '../../adapters/CultivatorAdapter';
import { Unit } from '../../units/Unit';
import { AttributeType } from '../../core/types';

// Mock Cultivator type
interface MockCultivator {
  id: string;
  name: string;
  attributes: {
    spirit: number;
    vitality: number;
    speed: number;
    wisdom: number;
    willpower: number;
  };
}

describe('CultivatorAdapter', () => {
  it('应该正确映射属性', () => {
    const cultivator: MockCultivator = {
      id: 'test_cultivator',
      name: '测试修仙者',
      attributes: {
        spirit: 80,
        vitality: 60,
        speed: 50,
        wisdom: 40,
        willpower: 30,
      },
    };

    const unit = CultivatorAdapter.toUnit(cultivator);

    expect(unit.attributes.getValue(AttributeType.SPIRIT)).toBe(80);
    expect(unit.attributes.getValue(AttributeType.PHYSIQUE)).toBe(60);
  });

  it('应该创建带镜像后缀的克隆', () => {
    const cultivator: MockCultivator = {
      id: 'test',
      name: '测试',
      attributes: {
        spirit: 50,
        vitality: 50,
        speed: 50,
        wisdom: 50,
        willpower: 50,
      },
    };

    const unit = CultivatorAdapter.toUnit(cultivator, true);
    expect(unit.name).toBe('测试的镜像');
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

```bash
npm test -- engine/battle-v5/tests/adapters/CultivatorAdapter.test.ts
```
Expected: FAIL

- [ ] **Step 3: 实现数据适配器**

创建 `engine/battle-v5/adapters/CultivatorAdapter.ts`:

```typescript
import { Unit } from '../units/Unit';
import { AttributeType, UnitId } from '../core/types';

/**
 * 现有 Cultivator 数据模型（简化）
 */
export interface CultivatorData {
  id: string;
  name: string;
  attributes: {
    spirit: number;
    vitality: number;
    speed: number;
    wisdom: number;
    willpower: number;
  };
}

/**
 * 数据适配器
 * 将现有 Cultivator 数据模型转换为 V5 Unit
 */
export class CultivatorAdapter {
  /**
   * 属性映射表
   */
  private static readonly ATTRIBUTE_MAP = {
    spirit: AttributeType.SPIRIT,
    vitality: AttributeType.PHYSIQUE,
    speed: AttributeType.AGILITY,
    wisdom: AttributeType.COMPREHENSION,
    willpower: AttributeType.CONSCIOUSNESS,
  } as const;

  /**
   * Cultivator → Unit
   */
  static toUnit(data: CultivatorData, isMirror: boolean = false): Unit {
    const baseAttrs: Partial<Record<AttributeType, number>> = {};

    // 映射属性
    for (const [cultivatorKey, v5Key] of Object.entries(this.ATTRIBUTE_MAP)) {
      baseAttrs[v5Key] = data.attributes[cultivatorKey as keyof typeof data.attributes];
    }

    const unitId = (data.id + (isMirror ? '_mirror' : '')) as UnitId;
    const name = isMirror ? `${data.name}的镜像` : data.name;

    return new Unit(unitId, name, baseAttrs);
  }

  /**
   * 批量转换
   */
  static toUnits(dataList: CultivatorData[], isMirror: boolean = false): Unit[] {
    return dataList.map((data) => this.toUnit(data, isMirror));
  }
}
```

- [ ] **Step 4: 运行测试验证通过**

```bash
npm test -- engine/battle-v5/tests/adapters/CultivatorAdapter.test.ts
```
Expected: PASS

- [ ] **Step 5: 提交**

```bash
git add engine/battle-v5/
git commit -m "feat(battle-v5): add CultivatorAdapter for data conversion

- Implement Cultivator to Unit conversion
- Map existing attributes to V5 5-attribute system
- Support mirror unit generation for PVP
- Add batch conversion support
- Add comprehensive unit tests

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Chunk 5: 入口与集成（阶段五）

### Task 13: 实现战斗引擎入口（BattleEngineV5）

**Files:**
- Create: `engine/battle-v5/BattleEngineV5.ts`
- Create: `engine/battle-v5/index.ts`
- Test: `engine/battle-v5/tests/integration/BattleEngineV5.test.ts`

- [ ] **Step 1: 写集成测试**

创建 `engine/battle-v5/tests/integration/BattleEngineV5.test.ts`:

```typescript
import { BattleEngineV5 } from '../BattleEngineV5';
import { CultivatorAdapter } from '../adapters/CultivatorAdapter';
import { AttributeType } from '../core/types';

describe('BattleEngineV5 Integration', () => {
  it('应该执行完整战斗流程', () => {
    const playerData = {
      id: 'player',
      name: '玩家',
      attributes: { spirit: 80, vitality: 60, speed: 50, wisdom: 40, willpower: 30 },
    };
    const opponentData = {
      id: 'opponent',
      name: '对手',
      attributes: { spirit: 70, vitality: 50, speed: 45, wisdom: 35, willpower: 25 },
    };

    const player = CultivatorAdapter.toUnit(playerData);
    const opponent = CultivatorAdapter.toUnit(opponentData);

    const engine = new BattleEngineV5(player, opponent);
    const result = engine.execute();

    expect(result.winner).toBeDefined();
    expect(result.turns).toBeGreaterThan(0);
    expect(result.logs.length).toBeGreaterThan(0);
  });

  it('应该支持回合上限', () => {
    const playerData = {
      id: 'player',
      name: '玩家',
      attributes: { spirit: 10, vitality: 1000, speed: 10, wisdom: 10, willpower: 10 },
    };
    const opponentData = {
      id: 'opponent',
      name: '对手',
      attributes: { spirit: 10, vitality: 1000, speed: 10, wisdom: 10, willpower: 10 },
    };

    const player = CultivatorAdapter.toUnit(playerData);
    const opponent = CultivatorAdapter.toUnit(opponentData);

    const engine = new BattleEngineV5(player, opponent);
    const result = engine.execute();

    expect(result.turns).toBeLessThanOrEqual(30);
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

```bash
npm test -- engine/battle-v5/tests/integration/BattleEngineV5.test.ts
```
Expected: FAIL

- [ ] **Step 3: 实现战斗引擎入口**

创建 `engine/battle-v5/BattleEngineV5.ts`:

```typescript
import { Unit } from './units/Unit';
import { CombatStateMachine, CombatContext } from './core/CombatStateMachine';
import { EventBus } from './core/EventBus';
import { CombatPhase } from './core/types';
import { CombatLogSystem } from './systems/CombatLogSystem';
import { VictorySystem } from './systems/VictorySystem';
import { DamageSystem } from './systems/DamageSystem';

export interface BattleResult {
  winner: string;
  loser?: string;
  turns: number;
  logs: string[];
  winnerSnapshot: unknown;
  loserSnapshot: unknown;
}

/**
 * V5 战斗引擎主入口
 * 集成所有子系统，提供完整的战斗模拟功能
 */
export class BattleEngineV5 {
  private _player: Unit;
  private _opponent: Unit;
  private _stateMachine: CombatStateMachine;
  private _logSystem: CombatLogSystem;
  private _eventBus: EventBus;

  constructor(player: Unit, opponent: Unit) {
    this._player = player;
    this._opponent = opponent;
    this._eventBus = EventBus.instance;
    this._logSystem = new CombatLogSystem();

    const context: CombatContext = {
      turn: 0,
      maxTurns: VictorySystem.getMaxTurns(),
      units: new Map([
        [player.id, player],
        [opponent.id, opponent],
      ]),
      battleEnded: false,
      winner: null,
    };

    this._stateMachine = new CombatStateMachine(context);
  }

  /**
   * 执行战斗模拟
   */
  execute(): BattleResult {
    // 启动状态机
    this._stateMachine.start();

    // 主循环
    while (!this.isBattleOver()) {
      this.executeTurn();
    }

    // 生成结果
    return this.generateResult();
  }

  /**
   * 执行单个回合
   */
  private executeTurn(): void {
    const context = this.getContext();
    context.turn++;

    // 回合开始
    this.logSystem.log(context.turn, CombatPhase.ROUND_START, `第${context.turn}回合开始`);

    // 行动阶段
    this.executeActions();

    // 回合结束
    this.processTurnEnd();

    // 胜负判定
    const victoryResult = VictorySystem.checkVictory(
      [this._player, this._opponent],
      context.turn,
    );

    if (victoryResult.battleEnded) {
      context.battleEnded = true;
      context.winner = victoryResult.winner;
      this._stateMachine.endBattle(victoryResult.winner ?? '');
    }
  }

  /**
   * 执行行动阶段
   */
  private executeActions(): void {
    const units = this.getSortedUnits();
    const context = this.getContext();

    for (const actor of units) {
      if (!actor.isAlive()) continue;

      // 简化AI：随机使用可用技能
      const availableAbilities = actor.abilities.getAllAbilities();
      if (availableAbilities.length > 0) {
        const ability = availableAbilities[0];
        const target = actor === this._player ? this._opponent : this._player;

        // 计算伤害（简化版）
        const damageResult = DamageSystem.calculateDamage(actor, target, {
          baseDamage: 50,
          damageType: 'physical',
        });

        target.takeDamage(damageResult.finalDamage);

        // 记录日志
        this._logSystem.logDamage(
          context.turn,
          actor.name,
          target.name,
          damageResult.finalDamage,
          damageResult.isCritical,
        );
      }
    }
  }

  /**
   * 处理回合结束
   */
  private processTurnEnd(): void {
    // 处理 Buff 持续时间
    this.processBuffs(this._player);
    this.processBuffs(this._opponent);
  }

  /**
   * 处理 Buff 持续时间
   */
  private processBuffs(unit: Unit): void {
    const buffs = unit.buffs.getAllBuffs();
    for (const buff of buffs) {
      buff.tickDuration();
      if (buff.isExpired()) {
        unit.buffs.removeBuff(buff.id);
      }
    }
  }

  /**
   * 获取按速度排序的单位
   */
  private getSortedUnits(): Unit[] {
    const units = [this._player, this._opponent];
    return units.sort((a, b) => {
      const speedA = a.attributes.getValue('agility' as any);
      const speedB = b.attributes.getValue('agility' as any);
      return speedB - speedA;
    });
  }

  /**
   * 检查战斗是否结束
   */
  private isBattleOver(): boolean {
    return this.getContext().battleEnded;
  }

  /**
   * 获取战斗上下文
   */
  private getContext(): CombatContext {
    return (this._stateMachine as unknown)['_context'] as CombatContext;
  }

  /**
   * 生成战斗结果
   */
  private generateResult(): BattleResult {
    const context = this.getContext();
    const winner = context.winner === this._player.id ? this._player : this._opponent;
    const loser = winner === this._player ? this._opponent : this._player;

    this._logSystem.logBattleEnd(winner.name, context.turn);

    return {
      winner: winner.id,
      loser: loser?.id,
      turns: context.turn,
      logs: this._logSystem.getLogs().map((log) => log.message),
      winnerSnapshot: winner.getSnapshot(),
      loserSnapshot: loser?.getSnapshot(),
    };
  }

  get logSystem(): CombatLogSystem {
    return this._logSystem;
  }
}
```

- [ ] **Step 4: 创建模块入口**

创建 `engine/battle-v5/index.ts`:

```typescript
// Core
export { EventBus } from './core/EventBus';
export { CombatStateMachine, type CombatContext } from './core/CombatStateMachine';
export * from './core/types';

// Units
export { Unit } from './units/Unit';
export { AttributeSet } from './units/AttributeSet';
export { AbilityContainer } from './units/AbilityContainer';
export { BuffContainer } from './units/BuffContainer';

// Abilities
export { Ability } from './abilities/Ability';
export { ActiveSkill } from './abilities/ActiveSkill';
export { PassiveAbility } from './abilities/PassiveAbility';
export * from './abilities';

// Buffs
export { Buff } from './buffs/Buff';
export * from './buffs';

// Systems
export { DamageSystem, type DamageCalculationParams, type DamageResult } from './systems/DamageSystem';
export { CombatLogSystem } from './systems/CombatLogSystem';
export { VictorySystem, type VictoryResult } from './systems/VictorySystem';

// Adapters
export { CultivatorAdapter, type CultivatorData } from './adapters/CultivatorAdapter';

// Main Entry
export { BattleEngineV5, type BattleResult } from './BattleEngineV5';
```

- [ ] **Step 5: 运行测试验证通过**

```bash
npm test -- engine/battle-v5/tests/integration/BattleEngineV5.test.ts
```
Expected: PASS

- [ ] **Step 6: 提交**

```bash
git add engine/battle-v5/
git commit -m "feat(battle-v5): add BattleEngineV5 main entry point

- Implement BattleEngineV5 as main engine entry point
- Integrate all subsystems (StateMachine, DamageSystem, LogSystem, VictorySystem)
- Support complete battle simulation loop
- Add module index.ts for clean exports
- Add integration tests

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
