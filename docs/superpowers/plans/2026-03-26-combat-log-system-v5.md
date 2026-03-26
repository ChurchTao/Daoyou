# Combat Log System V5 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a layered, span-based combat log system for Battle Engine V5 to replace the monolithic CombatLogSystem.

**Architecture:** A layered approach consisting of:
- **LogSubscriber**: Listens to EventBus and converts events into structured `LogEntry` objects.
- **LogAggregator**: Manages the lifecycle of `LogSpan` objects, organizing entries into logical transaction-like units.
- **LogFormatter**: Transforms spans into structured JSON or human-readable text.
- **CombatLogSystem**: A facade class ensuring compatibility with existing APIs while providing new span-based features.

**Tech Stack:** TypeScript, Next.js (Project Context), Event-Driven Architecture (EDA).

---

## File Structure

- `engine/battle-v5/systems/log/types.ts`: Core data structures (`LogEntry`, `LogSpan`, `CombatLogResult`).
- `engine/battle-v5/systems/log/LogAggregator.ts`: Logic for starting/ending spans and collecting entries.
- `engine/battle-v5/systems/log/LogSubscriber.ts`: Event mapping and translation logic.
- `engine/battle-v5/systems/log/LogFormatter.ts`: Interface and `TextFormatter`, `JsonFormatter` implementations.
- `engine/battle-v5/systems/log/CombatLogSystem.ts`: Facade class and entry point.
- `engine/battle-v5/systems/log/index.ts`: Public exports.

---

## Tasks

### Task 1: Core Types and Directory Setup

**Files:**
- Create: `engine/battle-v5/systems/log/types.ts`
- Create: `engine/battle-v5/systems/log/index.ts`

- [ ] **Step 1: Define core interfaces in `types.ts`**
  ```typescript
  export type LogEntryType = 'damage' | 'heal' | 'shield' | 'buff_apply' | 'buff_remove' | 'buff_immune' | 'dodge' | 'resist' | 'death' | 'mana_burn' | 'resource_drain' | 'dispel' | 'reflect' | 'tag_trigger' | 'death_prevent' | 'skill_cast' | 'skill_interrupt' | 'cooldown_modify';
  
  export interface LogEntry {
    id: string;
    type: LogEntryType;
    data: any;
    message: string;
    highlight: boolean;
  }
  
  export type LogSpanType = 'action' | 'action_pre' | 'round_start' | 'battle_init' | 'battle_end';
  
  export interface LogSpan {
    id: string;
    type: LogSpanType;
    turn: number;
    source?: { id: string; name: string };
    title: string;
    entries: LogEntry[];
    summary?: string;
    timestamp: number;
  }
  
  export interface CombatLogResult {
    battleId: string;
    spans: LogSpan[];
    fullText: string;
    metadata: {
      winner: string;
      loser: string;
      turns: number;
      duration: number;
    };
  }
  ```

- [ ] **Step 2: Setup `index.ts` exports**
  ```typescript
  export * from './types';
  export * from './CombatLogSystem';
  ```

- [ ] **Step 3: Commit**
  ```bash
  git add engine/battle-v5/systems/log/types.ts engine/battle-v5/systems/log/index.ts
  git commit -m "chore: setup log system v5 directory and core types"
  ```

### Task 2: Implement LogAggregator

**Files:**
- Create: `engine/battle-v5/systems/log/LogAggregator.ts`
- Test: `engine/battle-v5/tests/systems/LogAggregator.test.ts`

- [ ] **Step 1: Write tests for span lifecycle management**
  - Verify `beginActionPreSpan` creates an `action_pre` span.
  * Verify `beginActionSpan` creates an `action` span and closes the previous one.
  * Verify `addEntry` adds to the currently active span.

- [ ] **Step 2: Implement LogAggregator**
  - Use a private array to store spans.
  - Implement `beginActionPreSpan(unit: Unit)`, `beginActionSpan(caster: Unit, ability: Ability)`, etc.
  - Implement `addEntry(entry: LogEntry)`.

- [ ] **Step 3: Run tests and verify**
  Run: `npm test engine/battle-v5/tests/systems/LogAggregator.test.ts`
  Expected: PASS

- [ ] **Step 4: Commit**
  ```bash
  git add engine/battle-v5/systems/log/LogAggregator.ts engine/battle-v5/tests/systems/LogAggregator.test.ts
  git commit -m "feat: implement LogAggregator with span lifecycle management"
  ```

### Task 3: Implement LogSubscriber

**Files:**
- Create: `engine/battle-v5/systems/log/LogSubscriber.ts`
- Test: `engine/battle-v5/tests/systems/LogSubscriber.test.ts`

- [ ] **Step 1: Write tests for event-to-entry mapping**
  - Mock `LogAggregator` and `EventBus`.
  - Verify `DamageTakenEvent` triggers `addEntry` with 'damage' type.
  - Verify `ActionPreEvent` triggers `beginActionPreSpan`.
  - Verify `ActionEvent` triggers `beginActionSpan`.

- [ ] **Step 2: Implement LogSubscriber**
  - Implement handlers for all 15+ event types defined in the spec.
  - Map GAS/EDA events to `LogEntry` structure.
  - Handle DOT logic: If `DamageTakenEvent` occurs during `ActionPreEvent`, it should correctly land in the `action_pre` span.

- [ ] **Step 3: Run tests and verify**
  Run: `npm test engine/battle-v5/tests/systems/LogSubscriber.test.ts`
  Expected: PASS

- [ ] **Step 4: Commit**
  ```bash
  git add engine/battle-v5/systems/log/LogSubscriber.ts engine/battle-v5/tests/systems/LogSubscriber.test.ts
  git commit -m "feat: implement LogSubscriber with event mapping and DOT support"
  ```

### Task 4: Implement LogFormatter

**Files:**
- Create: `engine/battle-v5/systems/log/LogFormatter.ts`
- Test: `engine/battle-v5/tests/systems/LogFormatter.test.ts`

- [ ] **Step 1: Define LogFormatter interface and TextFormatter**
  - Implement `formatSpan(span: LogSpan): string`.
  - Implement `formatResult(result: CombatLogResult): string`.

- [ ] **Step 2: Implement JsonFormatter**
  - Simple `JSON.stringify(span)` or `JSON.stringify(result)`.

- [ ] **Step 3: Run tests and verify**
  Run: `npm test engine/battle-v5/tests/systems/LogFormatter.test.ts`
  Expected: PASS

- [ ] **Step 4: Commit**
  ```bash
  git add engine/battle-v5/systems/log/LogFormatter.ts engine/battle-v5/tests/systems/LogFormatter.test.ts
  git commit -m "feat: implement LogFormatter with Text and JSON support"
  ```

### Task 5: CombatLogSystem Facade & Engine Integration

**Files:**
- Create: `engine/battle-v5/systems/log/CombatLogSystem.ts`
- Modify: `engine/battle-v5/BattleEngineV5.ts`
- Test: `engine/battle-v5/tests/integration/CombatLogV5Integration.test.ts`

- [ ] **Step 1: Implement CombatLogSystem facade**
  - Integrate `LogSubscriber`, `LogAggregator`, and `LogFormatter`.
  - Provide legacy compatibility methods (`log`, `logHighlight`, `getLogs`, `generateReport`).
  - Add new methods: `getSpans()`, `getResult()`.

- [ ] **Step 2: Update BattleEngineV5**
  - Replace usage of old `CombatLogSystem` (after backup or rename).
  - Call `this._logSystem.subscribe(this._eventBus)` in constructor.
  - Call `this._logSystem.unsubscribe(this._eventBus)` and `this._logSystem.destroy()` in `destroy()`.
  - Update `generateResult()` to include `logSpans`.

- [ ] **Step 3: Write integration tests**
  - Run a complete battle and verify the span structure and contents.
  - Specifically verify `action_pre` spans for DOT damage.

- [ ] **Step 4: Run integration tests**
  Run: `npm test engine/battle-v5/tests/integration/CombatLogV5Integration.test.ts`
  Expected: PASS

- [ ] **Step 5: Commit**
  ```bash
  git add engine/battle-v5/systems/log/CombatLogSystem.ts engine/battle-v5/BattleEngineV5.ts engine/battle-v5/tests/integration/CombatLogV5Integration.test.ts
  git commit -m "feat: integrate new CombatLogSystem V5 into BattleEngineV5"
  ```

### Task 6: Final Verification and Cleanup

**Files:**
- Modify: `engine/battle-v5/systems/CombatLogSystem.ts` (Rename or Remove)

- [ ] **Step 1: Handle the old CombatLogSystem**
  - If the new system is at `engine/battle-v5/systems/log/CombatLogSystem.ts`, we should remove or archive the old one at `engine/battle-v5/systems/CombatLogSystem.ts`.

- [ ] **Step 2: Run all battle-related tests**
  Run: `npm test engine/battle-v5`
  Expected: ALL PASS

- [ ] **Step 3: Commit**
  ```bash
  git rm engine/battle-v5/systems/CombatLogSystem.ts
  git commit -m "cleanup: remove old monolithic CombatLogSystem"
  ```
