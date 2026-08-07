import { ActiveSkill } from '../abilities/ActiveSkill';
import { Buff } from '../buffs/Buff';
import { Unit } from '../units/Unit';
import type { CombatAttributionV3 } from '../v3/origin';
import type { CombatTraceV3 } from '../v3/types';
import type {
  ActionHitPolicy,
  ActionInterruptPolicy,
  ActionStateAbilityView,
  ActionStateView,
} from './actionState';
import { AbilityConfig, EffectConfig } from './configs';

export interface RuntimeMutationScopeV3 {
  attribution: CombatAttributionV3;
  trace: CombatTraceV3;
}

export interface QueuedActionRuntime {
  ability: AbilityConfig;
  sourceAbility?: ActionStateAbilityView;
  cancelEffects: EffectConfig[];
  interruptPolicy: ActionInterruptPolicy;
  hitPolicy: ActionHitPolicy;
}

export interface SkippedActionRuntime {
  name: string;
  reason: string;
  sourceAbility?: ActionStateAbilityView;
}

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
  freeManaCost?: boolean;
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
  actionSequence: number;
  round: number;
  listenerTriggerBudgets: Map<string, { token: number; count: number }>;
  skippedActions: SkippedActionRuntime[];
  queuedAction?: QueuedActionRuntime;
  abilityModes: Map<string, AbilityModeRuntime>;
  actionAmounts: Map<string, { action: number; amount: number }>;
}

export interface AbilityModeRuntime {
  key: string;
  mode: string;
  remainingUses: number;
  displayName: string;
  cleanupBuffIds?: string[];
}

export interface SerializableBattleRuntimeStateV1 {
  memories: Array<[string, DamageMemoryEntry]>;
  transforms: PendingAbilityTransform[];
  counters: Array<[string, number]>;
  deathPreventTriggers: string[];
  sequences: Array<[string, number]>;
  dealtDamageSinceLastCheck: boolean;
  actionSequence: number;
  round: number;
  listenerTriggerBudgets: Array<
    [string, { token: number; count: number }]
  >;
  skippedActions: SkippedActionRuntime[];
  queuedAction?: QueuedActionRuntime;
  abilityModes: Array<[string, AbilityModeRuntime]>;
  actionAmounts: Array<[string, { action: number; amount: number }]>;
}

export function getBattleRuntimeState(unit: Unit): BattleRuntimeState {
  return unit.runtime.states.getUnitState(unit);
}

export function queueSkippedActions(
  unit: Unit,
  count: number,
  reason: string,
  name = '调息',
  sourceAbility?: ActionStateAbilityView,
): void {
  const state = getBattleRuntimeState(unit);
  for (let i = 0; i < Math.max(0, Math.trunc(count)); i++) {
    state.skippedActions.push({ reason, name, sourceAbility });
  }
}

export function consumeSkippedAction(
  unit: Unit,
): SkippedActionRuntime | undefined {
  return getBattleRuntimeState(unit).skippedActions.shift();
}

export function setQueuedAction(
  unit: Unit,
  ability: AbilityConfig,
  options: {
    sourceAbility?: ActionStateAbilityView;
    cancelEffects?: EffectConfig[];
    interruptPolicy?: ActionInterruptPolicy;
    hitPolicy?: ActionHitPolicy;
  } = {},
): void {
  getBattleRuntimeState(unit).queuedAction = {
    ability,
    sourceAbility: options.sourceAbility,
    cancelEffects: options.cancelEffects ?? [],
    interruptPolicy: options.interruptPolicy ?? 'normal',
    hitPolicy: options.hitPolicy ?? 'normal',
  };
}

export function peekQueuedAction(unit: Unit): QueuedActionRuntime | undefined {
  return getBattleRuntimeState(unit).queuedAction;
}

export function consumeQueuedAction(
  unit: Unit,
): QueuedActionRuntime | undefined {
  const state = getBattleRuntimeState(unit);
  const queued = state.queuedAction;
  state.queuedAction = undefined;
  return queued;
}

export function clearPendingActionStates(unit: Unit): void {
  const state = getBattleRuntimeState(unit);
  state.skippedActions.length = 0;
  state.queuedAction = undefined;
}

export function getActionStateViews(unit: Unit): ActionStateView[] {
  if (!unit.isAlive()) return [];
  const state = getBattleRuntimeState(unit);
  const views: ActionStateView[] = [];
  if (state.skippedActions.length > 0) {
    const next = state.skippedActions[0];
    views.push({
      type: 'rest',
      name: next.name,
      remainingActions: state.skippedActions.length,
      sourceAbility: next.sourceAbility,
    });
  }
  if (state.queuedAction) {
    views.push({
      type: 'queued_action',
      name: '蓄势',
      remainingActions: 1,
      sourceAbility: state.queuedAction.sourceAbility,
      ability: {
        id: state.queuedAction.ability.slug,
        name: state.queuedAction.ability.name,
      },
      interruptPolicy: state.queuedAction.interruptPolicy,
      hitPolicy: state.queuedAction.hitPolicy,
    });
  }
  for (const mode of state.abilityModes.values()) {
    views.push({
      type: 'ability_mode',
      name: mode.displayName,
      remainingActions: mode.remainingUses,
    });
  }
  return views;
}

export function readAbilityMode(
  unit: Unit,
  key: string,
): AbilityModeRuntime | undefined {
  return getBattleRuntimeState(unit).abilityModes.get(key);
}

export function setAbilityMode(unit: Unit, mode: AbilityModeRuntime): void {
  getBattleRuntimeState(unit).abilityModes.set(mode.key, { ...mode });
}

export function advanceAbilityMode(
  unit: Unit,
  key: string,
  scope?: RuntimeMutationScopeV3,
): AbilityModeRuntime | undefined {
  const state = getBattleRuntimeState(unit);
  const current = state.abilityModes.get(key);
  if (!current) return undefined;
  const next = {
    ...current,
    remainingUses: Math.max(0, current.remainingUses - 1),
  };
  if (next.remainingUses <= 0) {
    state.abilityModes.delete(key);
    for (const buffId of next.cleanupBuffIds ?? []) {
      unit.buffs.removeBuff(buffId, scope);
    }
    return undefined;
  }
  state.abilityModes.set(key, next);
  return next;
}

export function clearAbilityMode(
  unit: Unit,
  key: string,
  scope?: RuntimeMutationScopeV3,
): void {
  const state = getBattleRuntimeState(unit);
  const mode = state.abilityModes.get(key);
  state.abilityModes.delete(key);
  for (const buffId of mode?.cleanupBuffIds ?? []) {
    unit.buffs.removeBuff(buffId, scope);
  }
}

export function claimActionAmount(
  unit: Unit,
  key: string,
  requested: number,
  cap: number,
): number {
  const state = getBattleRuntimeState(unit);
  const current = state.actionAmounts.get(key);
  const used = current?.action === state.actionSequence ? current.amount : 0;
  const applied = Math.max(0, Math.min(requested, cap - used));
  state.actionAmounts.set(key, {
    action: state.actionSequence,
    amount: used + applied,
  });
  return applied;
}

export function markBuffAppliedAtCurrentAction(unit: Unit, buff: Buff): void {
  unit.runtime.states.setBuffAppliedAtAction(
    buff,
    getBattleRuntimeState(unit).actionSequence,
  );
}

export function shouldTickBuffDuration(unit: Unit, buff: Buff): boolean {
  return (
    unit.runtime.states.getBuffAppliedAtAction(buff) !==
    getBattleRuntimeState(unit).actionSequence
  );
}

export function beginRuntimeAction(unit: Unit): void {
  getBattleRuntimeState(unit).actionSequence += 1;
}

export function setRuntimeRound(unit: Unit, round: number): void {
  getBattleRuntimeState(unit).round = Math.max(0, Math.trunc(round));
}

export function readRuntimeCounter(unit: Unit, key: string): number {
  return getBattleRuntimeState(unit).counters.get(key) ?? 0;
}

export function writeRuntimeCounter(
  unit: Unit,
  key: string,
  value: number,
): number {
  const normalized = Number.isFinite(value) ? Math.trunc(value) : 0;
  if (normalized === 0) {
    getBattleRuntimeState(unit).counters.delete(key);
    return 0;
  }
  getBattleRuntimeState(unit).counters.set(key, normalized);
  return normalized;
}

export function rememberAmount(
  unit: Unit,
  key: string,
  amount: number,
  maxStored = Number.POSITIVE_INFINITY,
): { before: number; after: number } {
  const memory = getBattleRuntimeState(unit).memories.get(key) ?? {
    amount: 0,
    count: 0,
  };
  const before = memory.amount;
  memory.amount = Math.min(maxStored, memory.amount + Math.max(0, amount));
  memory.count += 1;
  getBattleRuntimeState(unit).memories.set(key, memory);
  return { before, after: memory.amount };
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
  state.transforms = state.transforms.filter(
    (item) => item.id !== transform.id,
  );
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
  ability.bindRuntime(unit.runtime);
  const transform = consumeAbilityTransform(unit, ability);
  if (transform) {
    unit.runtime.states.setActiveAbilityTransform(ability, transform);
  }
  return transform;
}

export function getActiveAbilityTransform(
  ability: ActiveSkill | undefined,
): PendingAbilityTransform | undefined {
  const runtime = ability?.getRuntime();
  return ability && runtime
    ? runtime.states.getActiveAbilityTransform(ability)
    : undefined;
}

export function endAbilityTransform(ability: ActiveSkill): void {
  ability.getRuntime()?.states.deleteActiveAbilityTransform(ability);
}

export function setDelayedBuffEffects(
  buff: Buff,
  effects: EffectConfig[],
): void {
  const owner = buff.getOwner();
  if (!owner) throw new Error(`Buff ${buff.id} must be owned before setup`);
  owner.runtime.states.setDelayedBuffEffects(buff, effects);
}

export function getDelayedBuffEffects(buff: Buff): EffectConfig[] | undefined {
  return buff.getOwner()?.runtime.states.getDelayedBuffEffects(buff);
}

export function rememberRemovedBuff(unit: Unit, buff: Buff): void {
  const state = getBattleRuntimeState(unit);
  state.removedBuffs.unshift(buff.clone());
  state.removedBuffs = state.removedBuffs.slice(0, 5);
}

export function readRecentRemovedBuff(
  unit: Unit,
  predicate: (buff: Buff) => boolean,
): Buff | undefined {
  return getBattleRuntimeState(unit).removedBuffs.find(predicate);
}

export function exportBattleRuntimeState(
  unit: Unit,
): SerializableBattleRuntimeStateV1 {
  const state = getBattleRuntimeState(unit);
  if (state.activeEffectGuards.size > 0) {
    throw new Error('Checkpoint requires a quiescent effect boundary');
  }
  return {
    memories: [...state.memories].map(([key, value]) => [key, { ...value }]),
    transforms: state.transforms.map((transform) => ({ ...transform })),
    counters: [...state.counters],
    deathPreventTriggers: [...state.deathPreventTriggers],
    sequences: [...state.sequences],
    dealtDamageSinceLastCheck: state.dealtDamageSinceLastCheck,
    actionSequence: state.actionSequence,
    round: state.round,
    listenerTriggerBudgets: [...state.listenerTriggerBudgets].map(
      ([key, value]) => [key, { ...value }],
    ),
    skippedActions: state.skippedActions.map((action) => ({ ...action })),
    queuedAction: state.queuedAction
      ? {
          ...state.queuedAction,
          ability: { ...state.queuedAction.ability },
          cancelEffects: state.queuedAction.cancelEffects.map((effect) => ({
            ...effect,
          })),
        }
      : undefined,
    abilityModes: [...state.abilityModes].map(([key, value]) => [
      key,
      { ...value, cleanupBuffIds: value.cleanupBuffIds?.slice() },
    ]),
    actionAmounts: [...state.actionAmounts].map(([key, value]) => [
      key,
      { ...value },
    ]),
  };
}

export function restoreBattleRuntimeState(
  unit: Unit,
  snapshot: SerializableBattleRuntimeStateV1,
): void {
  const state = getBattleRuntimeState(unit);
  state.memories = new Map(
    snapshot.memories.map(([key, value]) => [key, { ...value }]),
  );
  state.transforms = snapshot.transforms.map((transform) => ({ ...transform }));
  state.counters = new Map(snapshot.counters);
  state.activeEffectGuards.clear();
  state.deathPreventTriggers = new Set(snapshot.deathPreventTriggers);
  state.sequences = new Map(snapshot.sequences);
  state.dealtDamageSinceLastCheck = snapshot.dealtDamageSinceLastCheck;
  state.actionSequence = snapshot.actionSequence;
  state.round = snapshot.round;
  state.listenerTriggerBudgets = new Map(
    snapshot.listenerTriggerBudgets.map(([key, value]) => [key, { ...value }]),
  );
  state.skippedActions = snapshot.skippedActions.map((action) => ({ ...action }));
  state.queuedAction = snapshot.queuedAction
    ? {
        ...snapshot.queuedAction,
        ability: { ...snapshot.queuedAction.ability },
        cancelEffects: snapshot.queuedAction.cancelEffects.map((effect) => ({
          ...effect,
        })),
      }
    : undefined;
  state.abilityModes = new Map(
    snapshot.abilityModes.map(([key, value]) => [
      key,
      { ...value, cleanupBuffIds: value.cleanupBuffIds?.slice() },
    ]),
  );
  state.actionAmounts = new Map(
    snapshot.actionAmounts.map(([key, value]) => [key, { ...value }]),
  );
}
