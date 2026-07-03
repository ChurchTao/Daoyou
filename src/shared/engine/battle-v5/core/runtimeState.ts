import { ActiveSkill } from '../abilities/ActiveSkill';
import { Buff } from '../buffs/Buff';
import { EffectConfig } from './configs';
import { Unit } from '../units/Unit';

export interface DamageMemoryEntry {
  amount: number;
  count: number;
}

export interface PendingAbilityTransform {
  id: string;
  remainingTriggers: number;
  appliesToTags?: string[];
  trueDamage?: boolean;
  addDispel?: EffectConfig;
  mpCostToHp?: boolean;
  cooldownModify?: number;
  forceCritical?: boolean;
  bonusDamageMemory?: {
    key: string;
    ratio?: number;
    consume?: boolean;
  };
  addDispelApplied?: boolean;
}

export interface BattleRuntimeState {
  memories: Map<string, DamageMemoryEntry>;
  transforms: PendingAbilityTransform[];
  counters: Map<string, number>;
  activeEffectGuards: Set<string>;
  globalUniqueEffects: Map<string, object>;
  deathPreventTriggers: Set<string>;
  sequences: Map<string, number>;
  dealtDamageSinceLastCheck: boolean;
  removedBuffs: Buff[];
  elementHistories: Map<string, Set<string>>;
}

const unitState = new WeakMap<Unit, BattleRuntimeState>();
const delayedBuffEffects = new WeakMap<Buff, EffectConfig[]>();
const activeAbilityTransforms = new WeakMap<ActiveSkill, PendingAbilityTransform>();

export function getBattleRuntimeState(unit: Unit): BattleRuntimeState {
  let state = unitState.get(unit);
  if (!state) {
    state = {
      memories: new Map(),
      transforms: [],
      counters: new Map(),
      activeEffectGuards: new Set(),
      globalUniqueEffects: new Map(),
      deathPreventTriggers: new Set(),
      sequences: new Map(),
      dealtDamageSinceLastCheck: false,
      removedBuffs: [],
      elementHistories: new Map(),
    };
    unitState.set(unit, state);
  }
  return state;
}

export function rememberAmount(
  unit: Unit,
  key: string,
  amount: number,
  maxStored = Number.POSITIVE_INFINITY,
): void {
  const memory = getBattleRuntimeState(unit).memories.get(key) ?? {
    amount: 0,
    count: 0,
  };
  memory.amount = Math.min(maxStored, memory.amount + Math.max(0, amount));
  memory.count += 1;
  getBattleRuntimeState(unit).memories.set(key, memory);
}

export function readMemory(unit: Unit, key: string): DamageMemoryEntry {
  return (
    getBattleRuntimeState(unit).memories.get(key) ?? {
      amount: 0,
      count: 0,
    }
  );
}

export function clearMemory(unit: Unit, key: string): void {
  getBattleRuntimeState(unit).memories.delete(key);
}

export function claimGlobalUniqueEffect(
  unit: Unit,
  key: string,
  source: object,
): boolean {
  const claims = getBattleRuntimeState(unit).globalUniqueEffects;
  const current = claims.get(key);
  if (current && current !== source) {
    return false;
  }

  claims.set(key, source);
  return true;
}

export function releaseGlobalUniqueEffects(unit: Unit, source: object): void {
  const claims = getBattleRuntimeState(unit).globalUniqueEffects;
  for (const [key, owner] of claims.entries()) {
    if (owner === source) {
      claims.delete(key);
    }
  }
}

export function beginRuntimeGuard(unit: Unit, key: string): boolean {
  const guards = getBattleRuntimeState(unit).activeEffectGuards;
  if (guards.has(key)) return false;

  guards.add(key);
  return true;
}

export function endRuntimeGuard(unit: Unit, key: string): void {
  getBattleRuntimeState(unit).activeEffectGuards.delete(key);
}

export function nextRuntimeSequence(unit: Unit, key: string): number {
  const state = getBattleRuntimeState(unit);
  const next = (state.sequences.get(key) ?? 0) + 1;
  state.sequences.set(key, next);
  return next;
}

export function addAbilityTransform(
  unit: Unit,
  transform: PendingAbilityTransform,
): void {
  const state = getBattleRuntimeState(unit);
  state.transforms = state.transforms.filter((item) => item.id !== transform.id);
  state.transforms.push(transform);
}

export function markDamageDealt(unit: Unit | undefined): void {
  if (!unit) return;
  getBattleRuntimeState(unit).dealtDamageSinceLastCheck = true;
}

export function consumeDamageDealtFlag(unit: Unit): boolean {
  const state = getBattleRuntimeState(unit);
  const dealt = state.dealtDamageSinceLastCheck;
  state.dealtDamageSinceLastCheck = false;
  return dealt;
}

function matchesAbilityTags(
  transform: PendingAbilityTransform,
  ability: ActiveSkill,
): boolean {
  if (!transform.appliesToTags || transform.appliesToTags.length === 0) {
    return true;
  }
  return ability.tags.hasAnyTag(transform.appliesToTags);
}

export function peekAbilityTransform(
  unit: Unit,
  ability: ActiveSkill | undefined,
): PendingAbilityTransform | undefined {
  if (!ability) return undefined;
  return getBattleRuntimeState(unit).transforms.find((transform) =>
    matchesAbilityTags(transform, ability),
  );
}

export function consumeAbilityTransform(
  unit: Unit,
  ability: ActiveSkill | undefined,
): PendingAbilityTransform | undefined {
  const state = getBattleRuntimeState(unit);
  const index = state.transforms.findIndex(
    (transform) => ability && matchesAbilityTags(transform, ability),
  );
  if (index < 0) return undefined;

  const transform = state.transforms[index];
  transform.remainingTriggers -= 1;
  if (transform.remainingTriggers <= 0) {
    state.transforms.splice(index, 1);
  }
  return transform;
}

export function beginAbilityTransform(
  unit: Unit,
  ability: ActiveSkill,
): PendingAbilityTransform | undefined {
  const transform = consumeAbilityTransform(unit, ability);
  if (transform) {
    activeAbilityTransforms.set(ability, transform);
  }
  return transform;
}

export function getActiveAbilityTransform(
  ability: ActiveSkill | undefined,
): PendingAbilityTransform | undefined {
  return ability ? activeAbilityTransforms.get(ability) : undefined;
}

export function endAbilityTransform(ability: ActiveSkill): void {
  activeAbilityTransforms.delete(ability);
}

export function setDelayedBuffEffects(
  buff: Buff,
  effects: EffectConfig[],
): void {
  delayedBuffEffects.set(buff, effects);
}

export function getDelayedBuffEffects(buff: Buff): EffectConfig[] | undefined {
  return delayedBuffEffects.get(buff);
}

export function rememberRemovedBuff(unit: Unit, buff: Buff): void {
  const state = getBattleRuntimeState(unit);
  state.removedBuffs.unshift(buff.clone());
  state.removedBuffs = state.removedBuffs.slice(0, 5);
}

export function readRecentRemovedBuff(unit: Unit, predicate: (buff: Buff) => boolean): Buff | undefined {
  return getBattleRuntimeState(unit).removedBuffs.find(predicate);
}

export function rememberElement(unit: Unit, key: string, elementTag: string): number {
  const state = getBattleRuntimeState(unit);
  const history = state.elementHistories.get(key) ?? new Set<string>();
  history.add(elementTag);
  state.elementHistories.set(key, history);
  return history.size;
}

export function clearElementHistory(unit: Unit, key: string): void {
  getBattleRuntimeState(unit).elementHistories.delete(key);
}
