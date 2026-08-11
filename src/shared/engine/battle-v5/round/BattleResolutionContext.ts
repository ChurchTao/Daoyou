import type { BattleRuntime } from '../runtime/BattleRuntime';
import { CombatFactSinkV3 } from '../v3/CombatFactSinkV3';
import type {
  CombatSequenceScopeV3,
  CombatSequenceV3,
  ResolvedCombatSequenceScopeV3,
} from '../v3/types';

/** Owns the fact and frame lifetime of exactly one deterministic round. */
export class BattleResolutionContext {
  private readonly factSink: CombatFactSinkV3;

  constructor(readonly runtime: BattleRuntime) {
    this.factSink = new CombatFactSinkV3(runtime.events);
  }

  runFrame<T>(
    scope: CombatSequenceScopeV3,
    callback: (scope: ResolvedCombatSequenceScopeV3) => T,
  ): T {
    return this.factSink.runInFrame(scope, callback);
  }

  getSequences(): CombatSequenceV3[] {
    return this.factSink.getSequences();
  }

  destroy(): void {
    this.factSink.destroy();
  }
}
