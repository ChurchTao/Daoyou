# Combat Log System V5 Visualization Improvement Plan

**Goal:** Improve the visibility of the new span-based log system by cleaning up legacy manual calls and including span headers in the flattened logs.

## Tasks

### Task 1: Clean up BattleEngineV5
- Remove redundant `this._logSystem.log(...)` in `executeTurn()`.
- Remove redundant `this._logSystem.logBattleEnd(...)` in `generateResult()`.

### Task 2: Enhance Flattened Log Output
- Update `CombatLogSystem.getLogs()` to include Span titles as virtual log entries (e.g., prefix with `>>> `).

### Task 3: Refine Span Trigger Logic
- Optimize `LogSubscriber` to prevent creating empty "Basic Attack" spans when a real skill is about to be cast.

## Verification
- Run `npm test engine/battle-v5` and verify the log output in `EffectVisualValidation.test.ts` shows the new structured headers.
