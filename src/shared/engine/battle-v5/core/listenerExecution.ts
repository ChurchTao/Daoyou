import { ConditionConfig, ListenerConfig, ListenerContextMapping, ListenerScope } from './configs';
import { CombatEvent } from './types';
import { Unit } from '../units/Unit';
import { getBattleRuntimeState } from './runtimeState';
import { checkConditions } from './conditionEvaluator';
import { battleRandom } from './BattleRandom';

export interface ListenerRuntimeConfig {
  id: string;
  eventType: string;
  scope: ListenerScope;
  priority: number;
  mapping: ListenerContextMapping;
  guard: {
    requireOwnerAlive: boolean;
    allowLethalWindow: boolean;
    skipReflectSource: boolean;
    skipSecondaryDamageSource: boolean;
  };
  budget?: {
    maxTriggers: number;
    reset: 'buff_lifetime' | 'action' | 'source_action' | 'round' | 'battle';
    group?: string;
  };
  conditions?: ConditionConfig[];
}

export interface ResolvedListenerContext {
  caster: Unit;
  target: Unit;
}

function getEventParticipant(event: CombatEvent, key: 'caster' | 'target' | 'source'): Unit | undefined {
  const eventAny = event as unknown as {
    caster?: Unit;
    target?: Unit;
    source?: Unit;
    unit?: Unit;
  };
  if (key === 'caster') {
    return eventAny.caster ?? eventAny.source;
  }
  return eventAny[key] ?? eventAny.unit;
}

function getDefaultScope(eventType: string): ListenerScope {
  switch (eventType) {
    case 'DamageTakenEvent':
      return 'owner_as_target';
    case 'ActionPreEvent':
    case 'ActionPostEvent':
    case 'ActionEvent':
      return 'owner_as_actor';
    case 'SkillCastEvent':
    case 'SkillPreCastEvent':
    case 'HitCheckEvent':
    case 'DamageRequestEvent':
      return 'owner_as_caster';
    case 'RoundPreEvent':
    case 'RoundPostEvent':
    case 'RoundStartEvent':
      return 'global';
    default:
      return 'global';
  }
}

function getDefaultMapping(
  _eventType: string,
  scope: ListenerScope,
): ListenerContextMapping {
  switch (scope) {
    case 'owner_as_target':
      return {
        caster: 'event.caster',
        target: 'owner',
      };
    case 'owner_as_caster':
    case 'owner_as_actor':
      return {
        caster: 'owner',
        target: 'event.target',
      };
    case 'global':
    default:
      return {
        caster: 'owner',
        target: 'owner',
      };
  }
}

export function buildListenerRuntimeConfig(config: ListenerConfig): ListenerRuntimeConfig {
  const scope = config.scope ?? getDefaultScope(config.eventType);

  return {
    id: config.id ?? `${config.eventType}_${battleRandom().toString(36).slice(2, 8)}`,
    eventType: config.eventType,
    scope,
    priority: config.priority,
    mapping: config.mapping ?? getDefaultMapping(config.eventType, scope),
    guard: {
      requireOwnerAlive: config.guard?.requireOwnerAlive ?? true,
      allowLethalWindow: config.guard?.allowLethalWindow ?? false,
      skipReflectSource: config.guard?.skipReflectSource ?? false,
      skipSecondaryDamageSource: config.guard?.skipSecondaryDamageSource ?? false,
    },
    budget: config.budget
      ? {
          maxTriggers: Math.max(0, Math.trunc(config.budget.maxTriggers)),
          reset: config.budget.reset,
          group: config.budget.group,
        }
      : undefined,
    conditions: config.conditions?.map((condition) => ({
      ...condition,
      params: { ...condition.params },
    })),
  };
}

export function matchesListenerScope(
  owner: Unit,
  event: CombatEvent,
  scope: ListenerScope,
): boolean {
  const eventCaster = getEventParticipant(event, 'caster');
  const eventTarget = getEventParticipant(event, 'target');

  switch (scope) {
    case 'owner_as_target':
      return eventTarget === owner;
    case 'owner_as_caster':
      return eventCaster === owner;
    case 'owner_as_actor':
      return eventCaster === owner || eventTarget === owner;
    case 'global':
    default:
      return true;
  }
}

function resolveSource(
  source: ListenerContextMapping['caster'],
  owner: Unit,
  event: CombatEvent,
): Unit | undefined {
  switch (source) {
    case 'owner':
      return owner;
    case 'event.caster':
      return getEventParticipant(event, 'caster');
    case 'event.target':
      return getEventParticipant(event, 'target');
    case 'event.source':
      return getEventParticipant(event, 'source');
    default:
      return owner;
  }
}

export function resolveListenerContext(
  owner: Unit,
  event: CombatEvent,
  mapping: ListenerContextMapping,
): ResolvedListenerContext {
  const caster = resolveSource(mapping.caster, owner, event) ?? owner;
  const target = resolveSource(mapping.target, owner, event) ?? owner;

  return {
    caster,
    target,
  };
}

export function shouldExecuteListener(
  owner: Unit,
  event: CombatEvent,
  runtime: ListenerRuntimeConfig,
  source?: object,
): boolean {
  if (!matchesListenerScope(owner, event, runtime.scope)) {
    return false;
  }

  if (runtime.guard.skipReflectSource) {
    const damageSource = (event as unknown as { damageSource?: string }).damageSource;
    if (damageSource === 'reflect') {
      return false;
    }
  }

  if (runtime.guard.skipSecondaryDamageSource) {
    const damageSource = (event as unknown as { damageSource?: string }).damageSource;
    if (
      damageSource === 'reflect' ||
      damageSource === 'counter' ||
      damageSource === 'follow_up' ||
      damageSource === 'delayed'
    ) {
      return false;
    }
  }

  if (runtime.guard.requireOwnerAlive && !owner.isAlive()) {
    if (!(runtime.guard.allowLethalWindow && event.type === 'DamageTakenEvent')) {
      return false;
    }
  }

  if (runtime.conditions?.length) {
    const resolved = resolveListenerContext(owner, event, runtime.mapping);
    if (!checkConditions({
      caster: resolved.caster,
      target: resolved.target,
      triggerEvent: event,
    }, runtime.conditions)) return false;
  }

  if (!claimListenerTrigger(owner, event, runtime, source)) {
    return false;
  }

  return true;
}

const lifecycleBudgets = new WeakMap<object, Map<string, number>>();

function claimListenerTrigger(
  owner: Unit,
  event: CombatEvent,
  runtime: ListenerRuntimeConfig,
  source?: object,
): boolean {
  const budget = runtime.budget;
  if (!budget) return true;
  if (budget.maxTriggers <= 0) return false;

  if (budget.reset === 'buff_lifetime') {
    const lifetimeOwner = source ?? runtime;
    const counters = lifecycleBudgets.get(lifetimeOwner) ?? new Map<string, number>();
    const budgetKey = budget.group ?? runtime.id;
    const count = counters.get(budgetKey) ?? 0;
    if (count >= budget.maxTriggers) return false;
    counters.set(budgetKey, count + 1);
    lifecycleBudgets.set(lifetimeOwner, counters);
    return true;
  }

  const budgetOwner = budget.reset === 'source_action'
    ? getEventParticipant(event, 'caster') ?? owner
    : owner;
  const state = getBattleRuntimeState(budgetOwner);
  const token = budget.reset === 'action' || budget.reset === 'source_action'
    ? state.actionSequence
    : budget.reset === 'round'
      ? state.round
      : 0;
  const key = `${budget.group ?? runtime.id}:${budget.reset}`;
  const current = state.listenerTriggerBudgets.get(key);
  const count = current?.token === token ? current.count : 0;
  if (count >= budget.maxTriggers) return false;
  state.listenerTriggerBudgets.set(key, { token, count: count + 1 });
  return true;
}
