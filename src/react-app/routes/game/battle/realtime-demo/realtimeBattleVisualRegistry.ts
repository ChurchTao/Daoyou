import type { CombatVisualSpec } from '@shared/engine/battle-v5/presentation';

const DEFAULT_VISUAL: CombatVisualSpec = {
  discipline: 'spell',
  delivery: 'projectile',
  weight: 'normal',
  element: 'none',
  impact: 'burst',
};

const REALTIME_BATTLE_VISUALS: Record<string, CombatVisualSpec> = {
  'binding-script': {
    discipline: 'true',
    delivery: 'projectile',
    impact: 'bind',
  },
  'split-light': {
    discipline: 'physical',
    delivery: 'melee',
    weight: 'normal',
    element: 'metal',
    impact: 'slash',
  },
  'moon-step': {
    discipline: 'physical',
    delivery: 'melee',
    weight: 'light',
    element: 'wind',
    impact: 'slash',
  },
  'lotus-ward': {
    discipline: 'spell',
    delivery: 'projectile',
    distribution: 'fanout',
    weight: 'heavy',
    element: 'wood',
    impact: 'shield',
  },
  'hold-origin': {
    discipline: 'spell',
    delivery: 'self',
    weight: 'normal',
    impact: 'shield',
  },
  'crow-fire': {
    discipline: 'spell',
    delivery: 'projectile',
    element: 'fire',
    impact: 'burst',
  },
  'dew-return': {
    discipline: 'spell',
    delivery: 'projectile',
    element: 'wood',
    impact: 'heal',
  },
  'cold-tide-domain': {
    discipline: 'spell',
    delivery: 'projectile',
    distribution: 'fanout',
    weight: 'heavy',
    element: 'ice',
    impact: 'burst',
  },
  'heart-curse': {
    discipline: 'true',
    delivery: 'projectile',
    weight: 'normal',
    impact: 'drain',
  },
  'fox-hunt': {
    discipline: 'spell',
    delivery: 'projectile',
    element: 'wood',
    impact: 'slash',
  },
  'gather-tide': {
    discipline: 'spell',
    delivery: 'self',
    element: 'water',
    impact: 'heal',
  },
  'mountain-breaker': {
    discipline: 'physical',
    delivery: 'melee',
    weight: 'heavy',
    element: 'earth',
    impact: 'break',
  },
  'mirror-armor': {
    discipline: 'spell',
    delivery: 'self',
    weight: 'normal',
    impact: 'shield',
  },
  'memory-release': {
    discipline: 'true',
    delivery: 'beam',
    weight: 'heavy',
    impact: 'burst',
  },
  'deferred-doom': {
    discipline: 'true',
    delivery: 'beam',
    weight: 'heavy',
    impact: 'break',
  },
  'seal-script': {
    discipline: 'spell',
    delivery: 'beam',
    weight: 'normal',
    impact: 'bind',
  },
  'final-sword': {
    discipline: 'physical',
    delivery: 'melee',
    weight: 'heavy',
    element: 'metal',
    impact: 'slash',
  },
};

export function resolveRealtimeBattleVisualSpec(
  abilityId: string,
): CombatVisualSpec {
  return REALTIME_BATTLE_VISUALS[abilityId] ?? DEFAULT_VISUAL;
}
