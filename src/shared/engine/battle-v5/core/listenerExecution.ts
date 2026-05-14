import { ListenerConfig, ListenerContextMapping, ListenerScope } from './configs';
import { CombatEvent } from './types';
import { Unit } from '../units/Unit';

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
  };
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
  };
  return eventAny[key];
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
    id: config.id ?? `${config.eventType}_${Math.random().toString(36).slice(2, 8)}`,
    eventType: config.eventType,
    scope,
    priority: config.priority,
    mapping: config.mapping ?? getDefaultMapping(config.eventType, scope),
    guard: {
      requireOwnerAlive: config.guard?.requireOwnerAlive ?? true,
      allowLethalWindow: config.guard?.allowLethalWindow ?? false,
      skipReflectSource: config.guard?.skipReflectSource ?? false,
    },
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
      return eventTarget?.id === owner.id;
    case 'owner_as_caster':
    case 'owner_as_actor':
      return eventCaster?.id === owner.id;
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

  if (runtime.guard.requireOwnerAlive && !owner.isAlive()) {
    if (!(runtime.guard.allowLethalWindow && event.type === 'DamageTakenEvent')) {
      return false;
    }
  }

  return true;
}
