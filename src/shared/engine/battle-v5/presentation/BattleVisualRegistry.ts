import { GameplayTags } from '@shared/engine/shared/tag-domain';
import type { AbilityConfig, EffectConfig } from '../core/configs';
import type { CombatVisualSpec } from './CombatVisualProtocol';

const DEFAULT_VISUAL: CombatVisualSpec = {
  discipline: 'spell',
  delivery: 'projectile',
  weight: 'normal',
  element: 'none',
  impact: 'burst',
};

const PRESET_VISUALS: Readonly<Record<string, CombatVisualSpec>> = {
  'binding-script': { discipline: 'true', delivery: 'projectile', impact: 'bind' },
  'split-light': { discipline: 'physical', delivery: 'melee', weight: 'normal', element: 'metal', impact: 'slash' },
  'moon-step': { discipline: 'physical', delivery: 'melee', weight: 'light', element: 'wind', impact: 'slash' },
  'lotus-ward': { discipline: 'spell', delivery: 'projectile', distribution: 'fanout', weight: 'heavy', element: 'wood', impact: 'shield' },
  'hold-origin': { discipline: 'spell', delivery: 'self', weight: 'normal', impact: 'shield' },
  'crow-fire': { discipline: 'spell', delivery: 'projectile', element: 'fire', impact: 'burst' },
  'dew-return': { discipline: 'spell', delivery: 'projectile', element: 'wood', impact: 'heal' },
  'cold-tide-domain': { discipline: 'spell', delivery: 'field', distribution: 'area', weight: 'heavy', element: 'ice', impact: 'burst' },
  'heart-curse': { discipline: 'true', delivery: 'projectile', weight: 'normal', impact: 'drain' },
  'fox-hunt': { discipline: 'spell', delivery: 'projectile', element: 'wood', impact: 'slash' },
  'gather-tide': { discipline: 'spell', delivery: 'self', element: 'water', impact: 'heal' },
  'mountain-breaker': { discipline: 'physical', delivery: 'melee', weight: 'heavy', element: 'earth', impact: 'break' },
  'mirror-armor': { discipline: 'spell', delivery: 'self', weight: 'normal', impact: 'shield' },
  'memory-release': { discipline: 'true', delivery: 'beam', weight: 'heavy', impact: 'burst' },
  'deferred-doom': { discipline: 'true', delivery: 'beam', weight: 'heavy', impact: 'break' },
  'seal-script': { discipline: 'spell', delivery: 'beam', weight: 'normal', impact: 'bind' },
  'final-sword': { discipline: 'physical', delivery: 'melee', weight: 'heavy', element: 'metal', impact: 'slash' },
};

const ELEMENT_TAGS: ReadonlyArray<[string, NonNullable<CombatVisualSpec['element']>]> = [
  [GameplayTags.ABILITY.ELEMENT.METAL, 'metal'],
  [GameplayTags.ABILITY.ELEMENT.WOOD, 'wood'],
  [GameplayTags.ABILITY.ELEMENT.WATER, 'water'],
  [GameplayTags.ABILITY.ELEMENT.FIRE, 'fire'],
  [GameplayTags.ABILITY.ELEMENT.EARTH, 'earth'],
  [GameplayTags.ABILITY.ELEMENT.WIND, 'wind'],
  [GameplayTags.ABILITY.ELEMENT.ICE, 'ice'],
  [GameplayTags.ABILITY.ELEMENT.THUNDER, 'thunder'],
];

function allEffects(config: AbilityConfig): EffectConfig[] {
  return [
    ...(config.effects ?? []),
    ...(config.completionEffects ?? []),
    ...(config.castEffects ?? []),
    ...(config.effectLayers?.flatMap((layer) => [
      ...(layer.effects ?? []),
      ...(layer.completionEffects ?? []),
    ]) ?? []),
  ];
}

/** Shared by Demo, Live and replay. Explicit authoring wins over all inference. */
export function resolveBattleAbilityVisual(
  abilityId: string,
  config?: AbilityConfig,
): CombatVisualSpec {
  if (config?.presentation?.visual) return config.presentation.visual;
  const preset = PRESET_VISUALS[abilityId];
  if (preset) return preset;
  if (!config) return DEFAULT_VISUAL;

  const tags = new Set(config.tags ?? []);
  const effects = allEffects(config);
  const damage = effects.find((effect) => effect.type === 'damage');
  const target = config.targetPolicy;
  const discipline: CombatVisualSpec['discipline'] =
    tags.has(GameplayTags.ABILITY.CHANNEL.PHYSICAL) ? 'physical'
      : tags.has(GameplayTags.ABILITY.CHANNEL.TRUE) ? 'true'
        : 'spell';
  const element = ELEMENT_TAGS.find(([tag]) => tags.has(tag))?.[1] ?? 'none';
  const selfOnly = target?.team === 'self';
  const aoe = target?.scope === 'aoe';
  const delivery: CombatVisualSpec['delivery'] = selfOnly ? 'self'
    : aoe ? 'field'
      : discipline === 'physical' && Boolean(damage) ? 'melee'
        : discipline === 'true' ? 'beam'
          : 'projectile';
  const impact: CombatVisualSpec['impact'] =
    effects.some((effect) => effect.type === 'shield' || effect.type === 'magic_shield') ? 'shield'
      : effects.some((effect) => effect.type === 'heal') ? 'heal'
        : effects.some((effect) => effect.type === 'ability_lock' || (effect.type === 'apply_buff' && effect.params.buffConfig.type === 'control')) ? 'bind'
          : effects.some((effect) => effect.type === 'resource_drain' || effect.type === 'mana_burn') ? 'drain'
            : discipline === 'physical' ? 'slash'
              : 'burst';
  return {
    discipline,
    delivery,
    distribution: aoe ? 'area' : 'single',
    weight: aoe ? 'heavy' : 'normal',
    element,
    impact,
  };
}
