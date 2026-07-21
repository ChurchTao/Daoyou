import { StackRule } from '@shared/engine/battle-v5/buffs/Buff';
import type {
  AbilityCostConfig,
  AbilityEffectLayerConfig,
  AbilityEffectPlanConfig,
  BuffConfig,
  ConditionConfig,
  EffectConfig,
  ListenerConfig,
} from '@shared/engine/battle-v5/core/configs';
import { EventPriorityLevel } from '@shared/engine/battle-v5/core/events';
import {
  AttributeType,
  BuffType,
  DamageSource,
  DamageType,
} from '@shared/engine/battle-v5/core/types';
import { GameplayTags } from '@shared/engine/shared/tag-domain';
import {
  SectAbilityFactory,
  type SectBuildBuilder,
  type SectCompiledAbility,
  type SectPathId,
  type SectProjectionContext,
} from '../../../core';
import { WUXIANG_BASE_DEFINITION } from '../definition';
import {
  WUXIANG_DEMON_PATH_ID,
  WUXIANG_FORM_MODE,
  WUXIANG_KARMA_BUFF,
  WUXIANG_MIRROR_PATH_ID,
  WUXIANG_SECT_ID,
  WUXIANG_TECHNIQUE_IDS,
  WUXIANG_WAR_INTENT,
  type WuxiangTechniqueId,
} from '../ids';
import {
  createWuxiangBuildSettings,
  type WuxiangBuildSettings,
} from './buildFacades';
import {
  compileMirrorAbilities,
  compileMirrorPassive,
} from '../paths/mirror/compiler';
import {
  compileDemonAbilities,
  compileDemonPassive,
} from '../paths/demon/compiler';

const techniqueTag = GameplayTags.ABILITY.SECT.mechanic(WUXIANG_SECT_ID, 'technique');
const MIRROR_GUARD = 'sect.wuxiang.mirror.stillness';
const MIRROR_FREE_PRESENT = 'sect.wuxiang.mirror.free-present';
const MIRROR_REFLOW = 'sect.wuxiang.mirror.reflow';
const MIRROR_SECOND_OBSERVE = 'sect.wuxiang.mirror.observe-second';
const MIRROR_OBSERVE_COUNTER = 'sect.wuxiang.mirror.observe-counter';
const MIRROR_REED_COUNTER = 'sect.wuxiang.mirror.reed-counter';
const DEMON_GUARD = 'sect.wuxiang.demon.crossing-guard';
const DEMON_CONTROL_GUARD = 'sect.wuxiang.demon.control-guard';
const DEMON_FIRST_THOUGHT = 'sect.wuxiang.demon.first-thought';
const KARMA_DOOR = 'sect.wuxiang.mirror.karma-door';
const HEART_GAP = 'sect.wuxiang.demon.heart-gap';

const modeIs = (mode: string, remainingUses?: number): ConditionConfig => ({
  type: 'ability_mode_is',
  params: { scope: 'caster', key: WUXIANG_FORM_MODE, mode, remainingUses },
});
const hpCost = (ratio: number, features: WuxiangBuildSettings): AbilityCostConfig[] => {
  const buddhistBonus = features.buddhistCostBonus;
  if (buddhistBonus === 0) {
    return [{ resource: 'hp', mode: 'current_hp_ratio', ratio, minimum: 1, retain: 1 }];
  }
  return [
    {
      resource: 'hp', mode: 'current_hp_ratio', ratio: ratio + buddhistBonus,
      minimum: 1, retain: 1, conditions: [modeIs('none')],
    },
    {
      resource: 'hp', mode: 'current_hp_ratio', ratio,
      minimum: 1, retain: 1, conditions: [modeIs('demon')],
    },
    {
      resource: 'hp', mode: 'current_hp_ratio', ratio,
      minimum: 1, retain: 1, conditions: [modeIs('formless')],
    },
  ];
};
const physical = (
  coefficient: number,
  conditions?: ConditionConfig[],
  options: { forceCritical?: boolean; source?: DamageSource; dynamicMissingHpCap?: number } = {},
): EffectConfig => ({
  type: 'damage',
  conditions,
  params: {
    value: { attribute: AttributeType.ATK, coefficient },
    damageType: DamageType.PHYSICAL,
    damageSource: options.source ?? DamageSource.DIRECT,
    forceCritical: options.forceCritical,
    dynamicScalars: options.dynamicMissingHpCap
      ? [{
          source: 'target_missing_hp_ratio',
          attribute: AttributeType.ATK,
          coefficientCap: options.dynamicMissingHpCap,
          timing: 'cast',
        }]
      : undefined,
  },
});
const shield = (ratio: number): EffectConfig => ({
  type: 'shield',
  params: { value: { targetMaxHpRatio: ratio }, target: 'caster' },
});
const heal = (ratio: number, conditions?: ConditionConfig[]): EffectConfig => ({
  type: 'heal',
  conditions,
  params: { value: { targetMaxHpRatio: ratio }, recipient: 'caster', target: 'hp' },
});
const gainWar = (amount = 1, conditions?: ConditionConfig[]): EffectConfig => ({
  type: 'combat_resource_modify',
  conditions,
  params: {
    resourceId: WUXIANG_WAR_INTENT,
    operation: 'add',
    amount,
    target: 'caster',
    reason: 'gain',
  },
});
const spendWar = (amount: number | 'all'): EffectConfig => ({
  type: 'combat_resource_modify',
  params: {
    resourceId: WUXIANG_WAR_INTENT,
    operation: amount === 'all' ? 'consume_all' : 'subtract',
    amount: amount === 'all' ? undefined : amount,
    target: 'caster',
    reason: 'spend',
  },
});

function buff(
  id: string,
  name: string,
  duration: number,
  listeners: ListenerConfig[] = [],
  options: Partial<BuffConfig> = {},
): BuffConfig {
  return {
    id,
    name,
    type: BuffType.BUFF,
    duration,
    stackRule: StackRule.OVERRIDE,
    tags: [GameplayTags.BUFF.TYPE.BUFF, GameplayTags.BUFF.SECT.namespace(WUXIANG_SECT_ID, id)],
    listeners,
    ...options,
  };
}
const selfBuff = (config: BuffConfig, conditions?: ConditionConfig[]): EffectConfig => ({
  type: 'apply_buff',
  conditions,
  params: { target: 'caster', buffConfig: config },
});
const targetBuff = (config: BuffConfig, conditions?: ConditionConfig[]): EffectConfig => ({
  type: 'apply_buff',
  conditions,
  params: { target: 'target', buffConfig: config },
});
const clearBuff = (id: string, target: 'caster' | 'target' = 'caster'): EffectConfig => ({
  type: 'buff_layer_modify',
  params: { match: { id }, operation: 'clear', target },
});
const addKarma = (): EffectConfig => selfBuff(buff(
  WUXIANG_KARMA_BUFF,
  '业痕',
  -1,
  [],
  {
    description: '佛相承受来力留下的因；魔相神通可逐层现报。',
    stackRule: StackRule.STACK_LAYER,
    maxLayers: 3,
    dispelPolicy: 'protected',
  },
));
const addKarmaLayers = (layers: number): EffectConfig[] =>
  Array.from({ length: layers }, addKarma);

function directGuard(
  id: string,
  name: string,
  reduction: number,
  options: {
    counter?: number;
    counterMarker?: string;
    secondTriggerMarker?: string;
  } = {},
): EffectConfig {
  const counterEffects = options.counter
    ? [physical(options.counter, undefined, { source: DamageSource.COUNTER })]
    : [];
  const reductionListener = (
    suffix: string,
    priority: number,
    conditions: ConditionConfig[],
  ): ListenerConfig => ({
    id: `${id}.${suffix}`,
    eventType: GameplayTags.EVENT.DAMAGE_REQUEST,
    scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
    priority,
    mapping: { caster: 'owner', target: 'owner' },
    guard: { skipSecondaryDamageSource: true },
    budget: { maxTriggers: 1, reset: 'buff_lifetime' },
    conditions: [
      { type: 'damage_source_is', params: { damageSource: DamageSource.DIRECT } },
      ...conditions,
    ],
    effects: [{ type: 'percent_damage_modifier', params: { mode: 'reduce', value: reduction } }],
  });
  const listeners: ListenerConfig[] = [];
  if (options.secondTriggerMarker) {
    listeners.push(reductionListener('second', EventPriorityLevel.DAMAGE_REQUEST + 2, [
      {
        type: 'buff_layer_at_least',
        params: { scope: 'target', id: options.secondTriggerMarker, value: 1 },
      },
      { type: 'runtime_counter_compare', params: { scope: 'target', key: `${id}.first-seen`, value: 1, op: 'gte' } },
    ]));
  }
  listeners.push({
    ...reductionListener('first', EventPriorityLevel.DAMAGE_REQUEST + 1, []),
    effects: [
      { type: 'percent_damage_modifier', params: { mode: 'reduce', value: reduction } },
      { type: 'runtime_counter_modify', params: { key: `${id}.first-seen`, operation: 'set', amount: 1, target: 'target' } },
    ],
  });
  if (counterEffects.length > 0) {
    listeners.push({
      id: `${id}.counter`,
      eventType: GameplayTags.EVENT.DAMAGE_TAKEN,
      scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
      priority: 0,
      mapping: { caster: 'owner', target: 'event.caster' },
      guard: { skipSecondaryDamageSource: true },
      budget: { maxTriggers: options.secondTriggerMarker ? 2 : 1, reset: 'buff_lifetime' },
      conditions: [
        { type: 'damage_source_is', params: { damageSource: DamageSource.DIRECT } },
        ...(options.counterMarker
          ? [{
              type: 'buff_layer_at_least' as const,
              params: { scope: 'caster' as const, id: options.counterMarker, value: 1 },
            }]
          : []),
      ],
      effects: [
        ...counterEffects,
        ...(options.counterMarker ? [{
          type: 'buff_layer_modify' as const,
          params: {
            match: { id: options.counterMarker },
            operation: 'subtract' as const,
            layers: 1,
            target: 'caster' as const,
          },
        }] : []),
      ],
    });
  }
  return selfBuff(buff(id, name, 1, listeners, { dispelPolicy: 'protected' }));
}

function persistentDirectReduction(id: string, name: string, reduction: number): EffectConfig {
  return selfBuff(buff(id, name, -1, [{
    id: `${id}.reduce`,
    eventType: GameplayTags.EVENT.DAMAGE_REQUEST,
    scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
    priority: EventPriorityLevel.DAMAGE_REQUEST + 1,
    mapping: { caster: 'owner', target: 'owner' },
    guard: { skipSecondaryDamageSource: true },
    conditions: [{ type: 'damage_source_is', params: { damageSource: DamageSource.DIRECT } }],
    effects: [{ type: 'percent_damage_modifier', params: { mode: 'reduce', value: reduction } }],
  }], { dispelPolicy: 'protected' }));
}

function definition(id: WuxiangTechniqueId | 'turn-form') {
  const found = WUXIANG_BASE_DEFINITION.abilities.find(
    (ability) => ability.id === id && ability.kind !== 'passive',
  );
  if (!found || found.kind === 'passive') throw new Error(`无相神通未定义: ${id}`);
  return found;
}

interface LayeredAbilitySpec {
  id: WuxiangTechniqueId;
  pathId: SectPathId;
  cost: number;
  target: 'enemy' | 'self';
  effects: EffectConfig[];
  completionEffects?: EffectConfig[];
  demonName: string;
  demonDescription: string;
  demonEffects: EffectConfig[];
  demonCompletionEffects?: EffectConfig[];
  formlessName: string;
  formlessDescription: string;
  formlessEffects: EffectConfig[];
  formlessCompletionEffects?: EffectConfig[];
  features: WuxiangBuildSettings;
}

function layeredAbility(spec: LayeredAbilitySpec): SectCompiledAbility {
  const factory = new SectAbilityFactory(WUXIANG_SECT_ID);
  const layers: AbilityEffectLayerConfig[] = [
    {
      id: 'demon',
      effects: spec.demonEffects,
      completionEffects: spec.demonCompletionEffects,
    },
    {
      id: 'formless',
      effects: spec.formlessEffects,
      completionEffects: spec.formlessCompletionEffects,
    },
  ];
  const plans: AbilityEffectPlanConfig[] = [
    {
      id: 'formless',
      name: spec.formlessName,
      description: spec.formlessDescription,
      priority: 300,
      conditions: [modeIs('formless')],
      layerIds: ['demon', 'formless'],
      consumeModeKey: WUXIANG_FORM_MODE,
    },
    {
      id: 'demon',
      name: spec.demonName,
      description: spec.demonDescription,
      priority: 200,
      conditions: [modeIs('demon')],
      layerIds: ['demon'],
      consumeModeKey: WUXIANG_FORM_MODE,
    },
  ];
  const buddhistCompletion: EffectConfig[] = [
    ...(spec.completionEffects ?? []),
    gainWar(1, [modeIs('none')]),
    ...(spec.features.buddhistShieldRatio > 0
      ? [shield(spec.features.buddhistShieldRatio) as EffectConfig]
        .map((effect) => ({ ...effect, conditions: [modeIs('none')] }))
      : []),
  ];
  return factory.active({
    definition: definition(spec.id),
    pathId: spec.pathId,
    costs: hpCost(spec.cost, spec.features),
    targetPolicy: { team: spec.target, scope: 'single' },
    effects: spec.effects,
    completionEffects: buddhistCompletion,
    effectLayers: layers,
    effectPlans: plans,
    extraTags: [techniqueTag],
  });
}

function mirrorPresent(
  effects: EffectConfig[],
  features: WuxiangBuildSettings,
  target: 'enemy' | 'self',
): EffectConfig[] {
  const reward: EffectConfig[] = [
    ...effects,
    ...(features.mirrorPresentAttackBonus > 0
      ? [target === 'enemy'
          ? physical(features.mirrorPresentAttackBonus)
          : shield(features.mirrorPresentShieldBonus)]
      : []),
    ...(features.mirrorPresentHealRatio > 0 ? [heal(features.mirrorPresentHealRatio)] : []),
  ];
  const actual: EffectConfig = {
    type: 'consume_status_trigger',
    params: {
      match: { id: WUXIANG_KARMA_BUFF },
      displayName: '业痕',
      consume: 1,
      target: 'caster',
      effects: reward,
    },
  };
  if (!features.mirrorFreePresent) return [actual];
  const freeReward = [
    ...effects,
    ...(features.mirrorPresentAttackBonus > 0
      ? [target === 'enemy'
          ? physical(features.mirrorPresentAttackBonus)
          : shield(features.mirrorPresentShieldBonus)]
      : []),
  ];
  return [{
    type: 'consume_status_trigger',
    params: {
      match: { id: MIRROR_FREE_PRESENT },
      displayName: '免费现报',
      consume: 1,
      target: 'caster',
      effects: freeReward,
      fallbackEffects: [actual],
    },
  }];
}

function allKarmaEffect(
  features: WuxiangBuildSettings,
  target: 'enemy' | 'self',
): EffectConfig[] {
  if (!features.mirrorSecondPresent) return [];
  return [{
    type: 'consume_status_trigger',
    params: {
      match: { id: WUXIANG_KARMA_BUFF },
      displayName: '业痕',
      consume: 1,
      target: 'caster',
      effects: [target === 'enemy' ? physical(0.6) : shield(0.08)],
    },
  }];
}

function heartVow(reduction: number): EffectConfig {
  return targetBuff(buff('sect.wuxiang.mirror.heart-vow', '叩心戒', 1, [{
    id: 'sect.wuxiang.mirror.heart-vow.trigger',
    eventType: GameplayTags.EVENT.DAMAGE_REQUEST,
    scope: GameplayTags.SCOPE.OWNER_AS_CASTER,
    priority: EventPriorityLevel.DAMAGE_REQUEST + 1,
    mapping: { caster: 'event.target', target: 'owner' },
    guard: { skipSecondaryDamageSource: true },
    budget: { maxTriggers: 1, reset: 'buff_lifetime' },
    conditions: [{ type: 'damage_source_is', params: { damageSource: DamageSource.DIRECT } }],
    effects: [
      { type: 'percent_damage_modifier', params: { mode: 'reduce', value: reduction } },
      addKarma(),
    ],
  }], { type: BuffType.DEBUFF, tags: [GameplayTags.BUFF.TYPE.DEBUFF] }));
}

function tideGuard(reduction: number): EffectConfig {
  return selfBuff(buff('sect.wuxiang.mirror.tide', '听潮', 1, [
    {
      id: 'sect.wuxiang.mirror.tide.reduce',
      eventType: GameplayTags.EVENT.DAMAGE_REQUEST,
      scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
      priority: EventPriorityLevel.DAMAGE_REQUEST + 1,
      mapping: { caster: 'owner', target: 'owner' },
      guard: { skipSecondaryDamageSource: true },
      conditions: [{ type: 'damage_source_is', params: { damageSource: DamageSource.DIRECT } }],
      effects: [{ type: 'percent_damage_modifier', params: { mode: 'reduce', value: reduction } }],
    },
    {
      id: 'sect.wuxiang.mirror.tide.counter',
      eventType: GameplayTags.EVENT.DAMAGE_TAKEN,
      scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
      priority: 0,
      mapping: { caster: 'owner', target: 'event.caster' },
      guard: { skipSecondaryDamageSource: true },
      budget: { maxTriggers: 1, reset: 'buff_lifetime' },
      conditions: [
        { type: 'damage_source_is', params: { damageSource: DamageSource.DIRECT } },
        { type: 'buff_layer_at_least', params: { scope: 'caster', id: MIRROR_REFLOW, value: 1 } },
      ],
      effects: [physical(0.35, undefined, { source: DamageSource.COUNTER }), clearBuff(MIRROR_REFLOW)],
    },
  ], { dispelPolicy: 'protected' }));
}

function karmaDoors(layers: number): EffectConfig[] {
  const door = buff(KARMA_DOOR, '业门', 4, [{
    id: 'sect.wuxiang.mirror.karma-door.trigger',
    eventType: GameplayTags.EVENT.DAMAGE_TAKEN,
    scope: GameplayTags.SCOPE.OWNER_AS_CASTER,
    priority: 0,
    mapping: { caster: 'event.target', target: 'owner' },
    guard: { skipSecondaryDamageSource: true },
    conditions: [{ type: 'damage_source_is', params: { damageSource: DamageSource.DIRECT } }],
    effects: [
      physical(0.12, undefined, { source: DamageSource.COUNTER }),
      {
        type: 'buff_layer_modify',
        params: { match: { id: KARMA_DOOR }, operation: 'subtract', layers: 1, target: 'target' },
      },
    ],
  }], {
    type: BuffType.DEBUFF,
    stackRule: StackRule.STACK_LAYER,
    maxLayers: layers,
    tags: [GameplayTags.BUFF.TYPE.DEBUFF],
  });
  return Array.from({ length: layers }, () => targetBuff(door));
}

function outgoingBoost(
  id: string,
  name: string,
  bonus: number,
  options: { healOnHit?: number } = {},
): EffectConfig {
  return selfBuff(buff(id, name, 2, [
    {
      id: `${id}.boost`,
      eventType: GameplayTags.EVENT.DAMAGE_REQUEST,
      scope: GameplayTags.SCOPE.OWNER_AS_CASTER,
      priority: EventPriorityLevel.DAMAGE_REQUEST + 1,
      mapping: { caster: 'owner', target: 'event.target' },
      guard: { skipSecondaryDamageSource: true },
      conditions: [
        { type: 'damage_source_is', params: { damageSource: DamageSource.DIRECT } },
        { type: 'ability_has_exact_tag', params: { tag: techniqueTag } },
      ],
      effects: [{ type: 'percent_damage_modifier', params: { mode: 'increase', value: bonus } }],
    },
    ...(options.healOnHit ? [{
      id: `${id}.heal`,
      eventType: GameplayTags.EVENT.DAMAGE_TAKEN,
      scope: GameplayTags.SCOPE.OWNER_AS_CASTER,
      priority: 0,
      mapping: { caster: 'owner' as const, target: 'event.target' as const },
      guard: { skipSecondaryDamageSource: true },
      budget: { maxTriggers: 1, reset: 'buff_lifetime' as const },
      conditions: [
        { type: 'damage_source_is' as const, params: { damageSource: DamageSource.DIRECT } },
        { type: 'ability_has_exact_tag' as const, params: { tag: techniqueTag } },
      ],
      effects: [heal(options.healOnHit)],
    }] : []),
    {
      id: `${id}.consume`,
      eventType: GameplayTags.EVENT.SKILL_CAST,
      scope: GameplayTags.SCOPE.OWNER_AS_CASTER,
      priority: 0,
      mapping: { caster: 'owner', target: 'event.target' },
      budget: { maxTriggers: 1, reset: 'buff_lifetime' },
      conditions: [{ type: 'ability_has_exact_tag', params: { tag: techniqueTag } }],
      effects: [clearBuff(id)],
    },
  ], { dispelPolicy: 'protected' }));
}

function heartGap(bonus: number): EffectConfig {
  return targetBuff(buff(HEART_GAP, '心隙', 2, [
    {
      id: 'sect.wuxiang.demon.heart-gap.boost',
      eventType: GameplayTags.EVENT.DAMAGE_REQUEST,
      scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
      priority: EventPriorityLevel.DAMAGE_REQUEST + 1,
      mapping: { caster: 'event.caster', target: 'owner' },
      guard: { skipSecondaryDamageSource: true },
      conditions: [
        { type: 'damage_source_is', params: { damageSource: DamageSource.DIRECT } },
        { type: 'ability_has_exact_tag', params: { tag: techniqueTag } },
      ],
      effects: [{ type: 'percent_damage_modifier', params: { mode: 'increase', value: bonus } }],
    },
    {
      id: 'sect.wuxiang.demon.heart-gap.consume',
      eventType: GameplayTags.EVENT.SKILL_CAST,
      scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
      priority: 0,
      mapping: { caster: 'event.caster', target: 'owner' },
      budget: { maxTriggers: 1, reset: 'source_action' },
      conditions: [{ type: 'ability_has_exact_tag', params: { tag: techniqueTag } }],
      effects: [{
        type: 'buff_layer_modify',
        params: { match: { id: HEART_GAP }, operation: 'subtract', layers: 1, target: 'target' },
      }],
    },
  ], {
    type: BuffType.DEBUFF,
    stackRule: StackRule.STACK_LAYER,
    maxLayers: 2,
    tags: [GameplayTags.BUFF.TYPE.DEBUFF],
  }));
}

function firstThoughtBonus(target: 'enemy' | 'self'): EffectConfig {
  return {
    type: 'consume_status_trigger',
    params: {
      match: { id: DEMON_FIRST_THOUGHT },
      displayName: '第一念',
      consume: 1,
      target: 'caster',
      effects: [target === 'enemy' ? physical(0.35) : shield(0.05)],
    },
  };
}

function demonCompletion(
  features: WuxiangBuildSettings,
  mode: 'demon' | 'formless',
): EffectConfig[] {
  const finalDemon = modeIs('demon', 1);
  return [
    ...(mode === 'demon' && features.demonSecondShore ? [heal(0.025)] : []),
    ...(mode === 'demon' && features.demonExitShieldRatio > 0
      ? [shield(features.demonExitShieldRatio) as EffectConfig]
        .map((effect) => ({ ...effect, conditions: [finalDemon] }))
      : []),
    ...(features.demonLookBack
      ? [heal(0.05, [
          mode === 'demon' ? finalDemon : modeIs('formless', 1),
          { type: 'hp_below', params: { scope: 'caster', value: 0.2 } },
        ])]
      : []),
  ];
}

function turnForm(pathId: SectPathId, features: WuxiangBuildSettings): SectCompiledAbility {
  const factory = new SectAbilityFactory(WUXIANG_SECT_ID);
  const isMirror = pathId === WUXIANG_MIRROR_PATH_ID;
  const guardIds = isMirror
    ? [
        MIRROR_GUARD,
        ...(features.mirrorFreePresent ? [MIRROR_FREE_PRESENT] : []),
      ]
    : [
        DEMON_GUARD,
        DEMON_CONTROL_GUARD,
        ...(features.demonFirstThought ? [DEMON_FIRST_THOUGHT] : []),
      ];
  const demonEffects: EffectConfig[] = [
    spendWar(3),
    {
      type: 'ability_mode',
      params: {
        key: WUXIANG_FORM_MODE,
        operation: 'set',
        mode: 'demon',
        remainingUses: 2,
        displayName: isMirror ? '魔相·止观' : '魔相·渡厄',
        cleanupBuffIds: guardIds,
      },
    },
    ...(isMirror
      ? [persistentDirectReduction(
          MIRROR_GUARD,
          '止观',
          features.mirrorDemonReduction,
        )]
      : [
          ...(features.demonHasPublicReduction
            ? [persistentDirectReduction(DEMON_GUARD, '渡厄', 0.2)]
            : []),
          selfBuff(buff(DEMON_CONTROL_GUARD, '渡厄·免控', -1, [{
            id: 'sect.wuxiang.demon.control-guard.immune',
            eventType: GameplayTags.EVENT.BUFF_ADD,
            scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
            priority: 100,
            mapping: { caster: 'owner', target: 'owner' },
            effects: [{ type: 'buff_immunity', params: { tags: [GameplayTags.BUFF.TYPE.CONTROL] } }],
          }], { dispelPolicy: 'protected' })),
        ]),
    ...(isMirror && features.mirrorFreePresent
      ? [selfBuff(buff(MIRROR_FREE_PRESENT, '镜背生魔', -1, [], {
          dispelPolicy: 'protected', stackRule: StackRule.STACK_LAYER, maxLayers: 1,
        }), [{
          type: 'combat_resource_below',
          params: { scope: 'caster', resourceId: WUXIANG_WAR_INTENT, value: 3 },
        }])]
      : []),
    ...(!isMirror && features.demonFirstThought
      ? [selfBuff(buff(DEMON_FIRST_THOUGHT, '第一念', -1, [], {
          dispelPolicy: 'protected', stackRule: StackRule.STACK_LAYER, maxLayers: 1,
        }))]
      : []),
    ...(!isMirror && features.demonEntryShieldRatio > 0
      ? [{
          ...shield(features.demonEntryShieldRatio),
          conditions: [{
            type: 'combat_resource_below',
            params: { scope: 'caster', resourceId: WUXIANG_WAR_INTENT, value: 3 },
          }],
        } as EffectConfig]
      : []),
  ];
  const formlessEffects: EffectConfig[] = [
    spendWar('all'),
    {
      type: 'ability_mode',
      params: {
        key: WUXIANG_FORM_MODE,
        operation: 'set',
        mode: 'formless',
        remainingUses: 1,
        displayName: '一念无间',
        cleanupBuffIds: guardIds,
      },
    },
  ];
  const formlessCost = 0.08 + (isMirror ? features.mirrorFormlessCostBonus : 0);
  return factory.active({
    definition: definition('turn-form'),
    pathId,
    targetPolicy: { team: 'self', scope: 'single' },
    costs: [
      {
        resource: 'hp', mode: 'current_hp_ratio', ratio: 0.04, minimum: 1, retain: 1,
        conditions: [{
          type: 'combat_resource_below',
          params: { scope: 'caster', resourceId: WUXIANG_WAR_INTENT, value: 6 },
        }],
      },
      {
        resource: 'hp', mode: 'current_hp_ratio', ratio: formlessCost, minimum: 1, retain: 1,
        conditions: [{
          type: 'combat_resource_at_least',
          params: { scope: 'caster', resourceId: WUXIANG_WAR_INTENT, value: 6 },
        }],
      },
    ],
    effects: [],
    effectLayers: [
      { id: 'demon', effects: demonEffects },
      { id: 'formless', effects: formlessEffects },
    ],
    effectPlans: [
      {
        id: 'formless', name: '一念无间', priority: 300,
        description: '消耗全部战意与气血，使下一门宗门神通同时显化佛相、魔相与无相三层效果。',
        conditions: [{
          type: 'combat_resource_at_least',
          params: { scope: 'caster', resourceId: WUXIANG_WAR_INTENT, value: 6 },
        }],
        layerIds: ['demon', 'formless'],
      },
      {
        id: 'demon', name: '魔相入身', priority: 200,
        description: '消耗3点战意与少量气血，使之后两门宗门神通在佛相主体上追加魔相效果。',
        conditions: [{
          type: 'combat_resource_at_least',
          params: { scope: 'caster', resourceId: WUXIANG_WAR_INTENT, value: 3 },
        }],
        layerIds: ['demon'],
      },
    ],
    castConditions: [{
      type: 'combat_resource_at_least',
      params: { scope: 'caster', resourceId: WUXIANG_WAR_INTENT, value: 3 },
    }],
    selectionProfile: { intents: ['buff'] },
  });
}

function passiveDefinition(id: 'mirror-core' | 'demon-core') {
  return WUXIANG_BASE_DEFINITION.abilities.find(
    (entry) => entry.id === id && entry.kind === 'passive',
  )! as Extract<(typeof WUXIANG_BASE_DEFINITION.abilities)[number], { kind: 'passive' }>;
}

const compilerApi = {
  DEMON_CONTROL_GUARD,
  HEART_GAP,
  KARMA_DOOR,
  MIRROR_OBSERVE_COUNTER,
  MIRROR_REED_COUNTER,
  MIRROR_REFLOW,
  MIRROR_SECOND_OBSERVE,
  WUXIANG_DEMON_PATH_ID,
  WUXIANG_KARMA_BUFF,
  WUXIANG_MIRROR_PATH_ID,
  WUXIANG_SECT_ID,
  addKarma,
  addKarmaLayers,
  allKarmaEffect,
  buff,
  clearBuff,
  demonCompletion,
  directGuard,
  firstThoughtBonus,
  gainWar,
  heal,
  heartGap,
  heartVow,
  karmaDoors,
  layeredAbility,
  mirrorPresent,
  modeIs,
  outgoingBoost,
  passiveDefinition,
  physical,
  selfBuff,
  shield,
  targetBuff,
  techniqueTag,
  tideGuard,
} as const;

export type WuxiangCompilerApi = typeof compilerApi;

export function compileWuxiangBase(
  _context: SectProjectionContext,
  builder: SectBuildBuilder,
): void {
  const empty = createWuxiangBuildSettings();
  const abilities = compileMirrorAbilities(empty, compilerApi);
  for (const id of WUXIANG_TECHNIQUE_IDS) builder.setAbility(id, abilities[id]);
  builder.setAbility('turn-form', turnForm(WUXIANG_MIRROR_PATH_ID, empty));
  builder.setResource({ ...WUXIANG_BASE_DEFINITION.combatResource, initial: 0 });
}

export function compileWuxiangPath(
  builder: SectBuildBuilder,
  pathId: SectPathId,
  features: WuxiangBuildSettings,
): void {
  const isMirror = pathId === WUXIANG_MIRROR_PATH_ID;
  const abilities = isMirror
    ? compileMirrorAbilities(features, compilerApi)
    : compileDemonAbilities(features, compilerApi);
  for (const id of WUXIANG_TECHNIQUE_IDS) builder.setAbility(id, abilities[id]);
  builder.setAbility('turn-form', turnForm(pathId, features));
  builder.setAbility(
    isMirror ? 'mirror-core' : 'demon-core',
    isMirror
      ? compileMirrorPassive(features, compilerApi)
      : compileDemonPassive(features, compilerApi),
  );
}
