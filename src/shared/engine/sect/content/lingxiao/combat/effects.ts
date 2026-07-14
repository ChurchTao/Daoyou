import { StackRule } from '@shared/engine/battle-v5/buffs/Buff';
import type {
  AbilityConfig,
  EffectConfig,
} from '@shared/engine/battle-v5/core/configs';
import { EventPriorityLevel } from '@shared/engine/battle-v5/core/events';
import {
  AbilityType,
  AttributeType,
  BuffType,
  DamageSource,
  DamageType,
} from '@shared/engine/battle-v5/core/types';
import { GameplayTags } from '@shared/engine/shared/tag-domain';
import { REALM_ORDER, type RealmType } from '@shared/types/constants';
import type { SectAbilityRole } from '../../../types';
import { LINGXIAO_SECT_ID } from '../ids';

// Lingxiao-only battle DSL. These helpers may encode sword content, but must
// never leak into the generic compiler, registry, service or battle adapter.

export const LINGXIAO_SWORD_MOMENTUM = 'sect.lingxiao.sword-momentum';
export const LINGXIAO_HEAVY_POSTURE = 'sect.lingxiao.heavy-posture';
export const LINGXIAO_SWORD_MARK_BUFF = 'sect.lingxiao.sword-mark';
export const LINGXIAO_ARMOR_REND_BUFF = 'sect.lingxiao.armor-rend';
export const LINGXIAO_RETURNING_SWALLOW_BUFF =
  'sect.lingxiao.returning-swallow';
export const LINGXIAO_HEAVY_GUARD_BUFF = 'sect.lingxiao.heavy-guard';
export const LINGXIAO_SHADOW_STEP_BUFF = 'sect.lingxiao.shadow-step';

export const SWIFT_RETAINED_FORCE = 'sect.lingxiao.swift.retained-force';
export const SWIFT_GUARDED_EDGE = 'sect.lingxiao.swift.guarded-edge';
export const SWIFT_IDLE_ACTIONS = 'sect.lingxiao.swift.idle-actions';
export const SWIFT_FINISHER_ACTION = 'sect.lingxiao.swift.finisher-action';
export const SWIFT_LINKED_CITY_ROUND = 'sect.lingxiao.swift.linked-city-round';
export const SWIFT_ENDLESS_COOLDOWN = 'sect.lingxiao.swift.endless-cooldown';
export const SWIFT_GAPLESS = 'sect.lingxiao.swift.gapless';
export const HEAVY_RETAINED_FRAME_ACTION =
  'sect.lingxiao.heavy.retained-frame-action';
export const HEAVY_UNMOVED_GUARD = 'sect.lingxiao.heavy.unmoved-guard';
export const HEAVY_IDLE_ACTIONS = 'sect.lingxiao.heavy.idle-actions';
export const HEAVY_FINISHER_ACTION = 'sect.lingxiao.heavy.finisher-action';
export const HEAVY_AFTERSHOCK_ROUND = 'sect.lingxiao.heavy.aftershock-round';
export const HEAVY_LINKED_MOUNTAINS = 'sect.lingxiao.heavy.linked-mountains';
export const HEAVY_ECHO_COOLDOWN = 'sect.lingxiao.heavy.echo-cooldown';
export const DAMAGE_MODIFIER_PRIORITY = EventPriorityLevel.DAMAGE_REQUEST + 1;

export interface BuiltAbility {
  config: AbilityConfig;
  detailRows: string[];
  notes: string[];
}

export function damage(
  coefficient: number,
  conditions?: EffectConfig['conditions'],
  bypassDefense = false,
): EffectConfig {
  return {
    type: 'damage',
    params: {
      value: { attribute: AttributeType.ATK, coefficient },
      damageType: DamageType.PHYSICAL,
      bypassDefense,
    },
    conditions,
  };
}

export function healMaxHp(
  ratio: number,
  recipient: 'caster' | 'target' = 'target',
): EffectConfig {
  return {
    type: 'heal',
    params: { value: { targetMaxHpRatio: ratio }, target: 'hp', recipient },
  };
}

export function shield(
  coefficient: number,
  conditions?: EffectConfig['conditions'],
  target: 'caster' | 'target' = 'target',
): EffectConfig {
  return {
    type: 'shield',
    params: { value: { attribute: AttributeType.ATK, coefficient }, target },
    conditions,
  };
}

export function resource(
  resourceId: string,
  amount: number,
  conditions?: EffectConfig['conditions'],
): EffectConfig {
  return {
    type: 'combat_resource_modify',
    params: {
      resourceId,
      operation: amount >= 0 ? 'add' : 'subtract',
      amount: Math.abs(amount),
    },
    conditions,
  };
}

export function consumeResource(resourceId: string): EffectConfig {
  return {
    type: 'combat_resource_modify',
    params: { resourceId, operation: 'consume_all' },
  };
}

export function counter(
  key: string,
  operation: 'add' | 'subtract' | 'set' | 'reset',
  options: {
    amount?: number;
    amountFromEvent?: 'requested' | 'applied' | 'overflow';
    max?: number;
    effects?: EffectConfig[];
    scaleEffectsByAmount?: boolean;
    conditions?: EffectConfig['conditions'];
  } = {},
): EffectConfig {
  return {
    type: 'runtime_counter_modify',
    params: {
      key,
      operation,
      amount: options.amount,
      amountFromEvent: options.amountFromEvent,
      max: options.max,
      effects: options.effects,
      scaleEffectsByAmount: options.scaleEffectsByAmount,
    },
    conditions: options.conditions,
  };
}

export function counterCondition(
  key: string,
  op: 'gt' | 'gte' | 'lt' | 'lte',
  value: number,
) {
  return {
    type: 'runtime_counter_compare' as const,
    params: { key, op, value, scope: 'caster' as const },
  };
}

export function resourceChangeCondition(
  resourceId: string,
  eventField: 'requested' | 'applied' | 'overflow',
  value: number,
) {
  return {
    type: 'combat_resource_change' as const,
    params: {
      resourceId,
      operation: 'add' as const,
      eventField,
      op: 'gte' as const,
      value,
    },
  };
}

export const DIRECT_DAMAGE_CONDITION = {
  type: 'damage_source_is' as const,
  params: { damageSource: DamageSource.DIRECT },
};

export function swordMark(): EffectConfig {
  return {
    type: 'apply_buff',
    params: {
      target: 'target',
      buffConfig: {
        id: LINGXIAO_SWORD_MARK_BUFF,
        name: '剑痕',
        description: '快剑留下的剑痕，可被收束招式利用。',
        type: BuffType.DEBUFF,
        duration: 2,
        stackRule: StackRule.STACK_LAYER,
        maxLayers: 3,
        tags: [
          GameplayTags.BUFF.TYPE.DEBUFF,
          GameplayTags.BUFF.SECT.namespace(LINGXIAO_SECT_ID, 'SwordMark'),
        ],
        statusTags: [
          GameplayTags.STATUS.SECT.state(LINGXIAO_SECT_ID, 'SwordMarked'),
        ],
      },
    },
  };
}

export function armorRend(): EffectConfig {
  return {
    type: 'apply_buff',
    params: {
      target: 'target',
      buffConfig: {
        id: LINGXIAO_ARMOR_REND_BUFF,
        name: '裂甲',
        description: '重剑震裂护体气机，可被破岳式利用。',
        type: BuffType.DEBUFF,
        duration: 2,
        stackRule: StackRule.STACK_LAYER,
        maxLayers: 3,
        tags: [
          GameplayTags.BUFF.TYPE.DEBUFF,
          GameplayTags.BUFF.SECT.namespace(LINGXIAO_SECT_ID, 'ArmorRend'),
        ],
      },
    },
  };
}

export function roleTag(role: SectAbilityRole): string {
  switch (role) {
    case 'generator':
      return GameplayTags.ABILITY.SECT.GENERATOR;
    case 'combo':
      return GameplayTags.ABILITY.SECT.COMBO;
    case 'finisher':
      return GameplayTags.ABILITY.SECT.FINISHER;
    default:
      return GameplayTags.ABILITY.SECT.DEFENSIVE;
  }
}

export function active(args: {
  id: string;
  name: string;
  mpCost: number;
  cooldown: number;
  role: SectAbilityRole;
  effects: EffectConfig[];
  pathId?: string;
  castConditions?: AbilityConfig['castConditions'];
  targetTeam?: 'enemy' | 'self';
  heal?: boolean;
  extraTags?: string[];
}): AbilityConfig {
  const effectTree = [...args.effects];
  for (let index = 0; index < effectTree.length; index += 1) {
    const effect = effectTree[index];
    if ('effects' in effect.params && Array.isArray(effect.params.effects)) {
      effectTree.push(...effect.params.effects);
    }
    if (effect.type === 'apply_buff') {
      effectTree.push(
        ...(effect.params.buffConfig.listeners?.flatMap(
          (listener) => listener.effects,
        ) ?? []),
      );
    }
  }
  const hasDamage = effectTree.some((effect) => effect.type === 'damage');
  const hasHeal =
    args.heal || effectTree.some((effect) => effect.type === 'heal');
  return {
    slug: `sect.${LINGXIAO_SECT_ID}.${args.id}`,
    name: args.name,
    type: AbilityType.ACTIVE_SKILL,
    mpCost: args.mpCost,
    cooldown: args.cooldown,
    tags: [
      ...(hasDamage
        ? [
            GameplayTags.ABILITY.FUNCTION.DAMAGE,
            GameplayTags.ABILITY.CHANNEL.PHYSICAL,
          ]
        : []),
      ...(hasHeal ? [GameplayTags.ABILITY.FUNCTION.HEAL] : []),
      GameplayTags.ABILITY.KIND.SECT,
      GameplayTags.ABILITY.SECT.namespace(LINGXIAO_SECT_ID),
      ...(args.pathId
        ? [GameplayTags.ABILITY.SECT.path(LINGXIAO_SECT_ID, args.pathId)]
        : []),
      GameplayTags.ABILITY.SECT.ability(LINGXIAO_SECT_ID, args.id),
      roleTag(args.role),
      ...(args.extraTags ?? []),
      GameplayTags.ABILITY.TARGET.SINGLE,
    ],
    targetPolicy: { team: args.targetTeam ?? 'enemy', scope: 'single' },
    selectionProfile: {
      intents:
        args.role === 'utility'
          ? ['heal_hp', 'defensive']
          : args.role === 'defensive'
            ? ['defensive']
            : ['damage'],
    },
    castConditions: args.castConditions,
    effects: args.effects,
  };
}

export function manaCost(realm: RealmType, weight: number): number {
  return Math.round((8 + 4 * REALM_ORDER[realm]) * weight);
}
