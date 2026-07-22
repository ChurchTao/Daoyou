import { ActiveSkill } from '../abilities/ActiveSkill';
import { Buff } from '../buffs/Buff';
import { AbilityConfig, EffectConfig } from './configs';
import { Unit } from '../units/Unit';
import type {
  ActionHitPolicy,
  ActionInterruptPolicy,
  ActionStateAbilityView,
  ActionStateView,
} from './actionState';

export interface QueuedActionRuntime {
  ability: AbilityConfig;
  sourceAbility?: ActionStateAbilityView;
  cancelEffects: EffectConfig[];
  interruptPolicy: ActionInterruptPolicy;
  hitPolicy: ActionHitPolicy;
}

interface SkippedActionRuntime {
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
  elementHistories: Map<string, Set<string>>;
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

const unitState = new WeakMap<Unit, BattleRuntimeState>();
const delayedBuffEffects = new WeakMap<Buff, EffectConfig[]>();
const activeAbilityTransforms = new WeakMap<ActiveSkill, PendingAbilityTransform>();
const buffAppliedAtAction = new WeakMap<Buff, number>();

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
      actionSequence: 0,
      round: 0,
      listenerTriggerBudgets: new Map(),
      skippedActions: [],
      abilityModes: new Map(),
      actionAmounts: new Map(),
    };
    unitState.set(unit, state);
  }
  return state;
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

export function consumeSkippedAction(unit: Unit): SkippedActionRuntime | undefined {
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

export function consumeQueuedAction(unit: Unit): QueuedActionRuntime | undefined {
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

export function readAbilityMode(unit: Unit, key: string): AbilityModeRuntime | undefined {
  return getBattleRuntimeState(unit).abilityModes.get(key);
}

export function setAbilityMode(unit: Unit, mode: AbilityModeRuntime): void {
  getBattleRuntimeState(unit).abilityModes.set(mode.key, { ...mode });
}

export function advanceAbilityMode(
  unit: Unit,
  key: string,
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
      unit.buffs.removeBuff(buffId);
    }
    return undefined;
  }
  state.abilityModes.set(key, next);
  return next;
}

export function clearAbilityMode(unit: Unit, key: string): void {
  const state = getBattleRuntimeState(unit);
  const mode = state.abilityModes.get(key);
  state.abilityModes.delete(key);
  for (const buffId of mode?.cleanupBuffIds ?? []) {
    unit.buffs.removeBuff(buffId);
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
  state.actionAmounts.set(key, { action: state.actionSequence, amount: used + applied });
  return applied;
}

export function markBuffAppliedAtCurrentAction(unit: Unit, buff: Buff): void {
  buffAppliedAtAction.set(buff, getBattleRuntimeState(unit).actionSequence);
}

export function shouldTickBuffDuration(unit: Unit, buff: Buff): boolean {
  return buffAppliedAtAction.get(buff) !== getBattleRuntimeState(unit).actionSequence;
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

export function writeRuntimeCounter(unit: Unit, key: string, value: number): number {
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

export function readElementHistory(unit: Unit, key: string): ReadonlySet<string> {
  return new Set(getBattleRuntimeState(unit).elementHistories.get(key) ?? []);
}

export function clearElementHistory(unit: Unit, key: string): void {
  getBattleRuntimeState(unit).elementHistories.delete(key);
}
