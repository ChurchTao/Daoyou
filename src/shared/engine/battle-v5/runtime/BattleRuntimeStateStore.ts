import type { ActiveSkill } from '../abilities/ActiveSkill';
import type { Buff } from '../buffs/Buff';
import type { EffectConfig } from '../core/configs';
import type {
  BattleRuntimeState,
  PendingAbilityTransform,
} from '../core/runtimeState';
import type { Unit } from '../units/Unit';

export class BattleRuntimeStateStore {
  private unitStates = new WeakMap<Unit, BattleRuntimeState>();
  private delayedBuffEffects = new WeakMap<Buff, EffectConfig[]>();
  private activeAbilityTransforms = new WeakMap<
    ActiveSkill,
    PendingAbilityTransform
  >();
  private buffAppliedAtAction = new WeakMap<Buff, number>();

  getUnitState(unit: Unit): BattleRuntimeState {
    let state = this.unitStates.get(unit);
    if (!state) {
      state = {
        memories: new Map(),
        transforms: [],
        counters: new Map(),
        activeEffectGuards: new Set(),
        globalUniqueEffects: new Map(),
        deathPreventTriggers: new Set(),
        deathCommitted: false,
        sequences: new Map(),
        dealtDamageSinceLastCheck: false,
        removedBuffs: [],
        actionSequence: 0,
        round: 0,
        triggerLedger: new Map(),
        damageSegmentCounters: new Map(),
        skippedActions: [],
        abilityModes: new Map(),
        actionAmounts: new Map(),
      };
      this.unitStates.set(unit, state);
    }
    return state;
  }

  getDelayedBuffEffects(buff: Buff): EffectConfig[] | undefined {
    return this.delayedBuffEffects.get(buff);
  }

  setDelayedBuffEffects(buff: Buff, effects: EffectConfig[]): void {
    this.delayedBuffEffects.set(buff, effects);
  }

  getActiveAbilityTransform(
    ability: ActiveSkill,
  ): PendingAbilityTransform | undefined {
    return this.activeAbilityTransforms.get(ability);
  }

  setActiveAbilityTransform(
    ability: ActiveSkill,
    transform: PendingAbilityTransform,
  ): void {
    this.activeAbilityTransforms.set(ability, transform);
  }

  deleteActiveAbilityTransform(ability: ActiveSkill): void {
    this.activeAbilityTransforms.delete(ability);
  }

  getBuffAppliedAtAction(buff: Buff): number | undefined {
    return this.buffAppliedAtAction.get(buff);
  }

  setBuffAppliedAtAction(buff: Buff, action: number): void {
    this.buffAppliedAtAction.set(buff, action);
  }

  clear(): void {
    this.unitStates = new WeakMap();
    this.delayedBuffEffects = new WeakMap();
    this.activeAbilityTransforms = new WeakMap();
    this.buffAppliedAtAction = new WeakMap();
  }
}
