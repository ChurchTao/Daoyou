import { StackRule } from '@shared/engine/battle-v5/buffs/Buff';
import type { AbilityConfig, EffectConfig } from '@shared/engine/battle-v5/core/configs';
import {
  AttributeType,
  BuffType,
  DamageSource,
  DamageType,
  ModifierType,
} from '@shared/engine/battle-v5/core/types';
import { GameplayTags } from '@shared/engine/shared/tag-domain';
import type { RealmType } from '@shared/types/constants';
import {
  calculateSectManaCost,
  SectAbilityFactory,
  sectEffects,
  type CultivatorSectPathState,
  type SectAbilityRole,
  type SectCompiledAbility,
  type SectCompiledBuild,
} from '../../../../core';
import { LINGXIAO_BASE_DEFINITION } from '../../definition';
import { LINGXIAO_SECT_ID } from '../../ids';
import {
  createSwordMark,
  LINGXIAO_RETURNING_SWALLOW_BUFF,
  LINGXIAO_SWORD_MARK_BUFF,
  LINGXIAO_SWORD_MOMENTUM,
  SWIFT_ENDLESS_COOLDOWN,
  SWIFT_FINISHER_ACTION,
  SWIFT_GAPLESS,
  SWIFT_IDLE_ACTIONS,
  SWIFT_LINKED_CITY_ROUND,
} from '../../shared/LingxiaoMechanics';

export interface SwiftSwordFeatures {
  opening: boolean;
  splitLight: boolean;
  stackingWaves: boolean;
  retainedForce: boolean;
  returningSwallow: boolean;
  guardedEdge: boolean;
  mountainBreaking: boolean;
  sheathing: boolean;
  gapless: boolean;
  linkedCity: boolean;
  stillTide: boolean;
  endlessFlow: boolean;
  shadowLine: boolean;
  unendingWind: boolean;
}

export const EMPTY_SWIFT_FEATURES: SwiftSwordFeatures = {
  opening: false,
  splitLight: false,
  stackingWaves: false,
  retainedForce: false,
  returningSwallow: false,
  guardedEdge: false,
  mountainBreaking: false,
  sheathing: false,
  gapless: false,
  linkedCity: false,
  stillTide: false,
  endlessFlow: false,
  shadowLine: false,
  unendingWind: false,
};

const damage = (
  coefficient: number,
  conditions?: EffectConfig['conditions'],
  bypassDefense = false,
  damageSource: DamageSource = DamageSource.DIRECT,
  forceCritical = false,
): EffectConfig => ({
  type: 'damage',
  params: {
    value: { attribute: AttributeType.ATK, coefficient },
    damageType: DamageType.PHYSICAL,
    bypassDefense,
    damageSource,
    forceCritical,
  },
  conditions,
});

const selfBuff = (
  id: string,
  name: string,
  duration: number,
  modifiers: NonNullable<NonNullable<AbilityConfig['modifiers']>>,
  listeners?: NonNullable<AbilityConfig['listeners']>,
): EffectConfig => ({
  type: 'apply_buff',
  params: {
    target: 'caster',
    buffConfig: {
      id,
      name,
      type: BuffType.BUFF,
      duration,
      stackRule: StackRule.REFRESH_DURATION,
      tags: [GameplayTags.BUFF.TYPE.BUFF],
      modifiers,
      listeners,
    },
  },
});

export function buildSwiftAbilities(
  baseBuild: Readonly<SectCompiledBuild>,
  realm: RealmType,
  path: CultivatorSectPathState,
  features: SwiftSwordFeatures,
): Record<string, SectCompiledAbility> {
  const built = { ...baseBuild.abilities };
  const factory = new SectAbilityFactory(LINGXIAO_SECT_ID, realm);
  const resourceId = LINGXIAO_SWORD_MOMENTUM;
  const active = (args: {
    id: string;
    name: string;
    manaWeight: number;
    cooldown: number;
    role: SectAbilityRole;
    effects: EffectConfig[];
    castConditions?: AbilityConfig['castConditions'];
    targetTeam?: 'enemy' | 'self';
    extraTags?: string[];
  }): SectCompiledAbility => {
    const definition = LINGXIAO_BASE_DEFINITION.abilities.find((entry) => entry.id === args.id)!;
    return factory.active({
      ...args,
      definition,
      pathId: path.pathId,
      mpCost: calculateSectManaCost(realm, args.manaWeight),
    });
  };

  built['plain-sword'] = active({
    id: 'plain-sword', name: '流光问锋', manaWeight: 0, cooldown: 0, role: 'generator',
    effects: [damage(0.75), sectEffects.modifyResource(resourceId, 1)],
  });

  built['guiding-sword'] = active({
    id: 'guiding-sword', name: '追风引', manaWeight: 1, cooldown: 0, role: 'generator',
    effects: [
      damage(0.9),
      sectEffects.modifyResource(resourceId, 2),
      damage(0.3, [{
        type: 'attribute_compare',
        params: { attribute: AttributeType.SPEED, left: 'caster', right: 'target', op: 'gt' },
      }], false, DamageSource.FOLLOW_UP),
    ],
  });

  const hits = features.splitLight ? 7 : 5;
  const hitCoefficient = features.splitLight ? 0.27 : 0.34;
  built['linked-edge'] = active({
    id: 'linked-edge', name: features.splitLight ? '分光七叠' : '流光五叠', manaWeight: 1.5, cooldown: 2, role: 'combo',
    effects: [
      ...Array.from({ length: hits }, () => damage(hitCoefficient)),
      sectEffects.modifyResource(resourceId, features.splitLight ? 3 : 2),
      createSwordMark(),
      ...(features.retainedForce ? [createSwordMark()] : []),
      ...(features.stackingWaves ? [{
        type: 'cooldown_modify' as const,
        params: { cdModifyValue: -1, target: 'caster' as const, includeCurrent: true, tags: [GameplayTags.ABILITY.SECT.ability(LINGXIAO_SECT_ID, 'linked-edge')] },
      }] : []),
      ...(features.linkedCity ? [{
        type: 'runtime_counter_modify' as const,
        params: {
          key: SWIFT_LINKED_CITY_ROUND,
          operation: 'add' as const,
          amount: 1,
          max: 1,
          effects: [{
            type: 'cooldown_modify' as const,
            params: { cdModifyValue: -1, target: 'caster' as const, tags: [GameplayTags.ABILITY.SECT.path(LINGXIAO_SECT_ID, path.pathId)] },
          }],
        },
      }] : []),
    ],
  });

  built['turning-body'] = active({
    id: 'turning-body', name: '回燕', manaWeight: 1.25, cooldown: 3, role: 'defensive',
    effects: [
      damage(0.6),
      selfBuff(
        LINGXIAO_RETURNING_SWALLOW_BUFF,
        '回燕姿态',
        2,
        [{ attrType: AttributeType.EVASION_RATE, type: ModifierType.FIXED, value: 0.08 }],
        [{
          id: 'sect.lingxiao.swift.returning-swallow',
          eventType: GameplayTags.EVENT.DODGE,
          scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
          priority: 0,
          mapping: { caster: 'owner', target: 'event.caster' },
          budget: { maxTriggers: 1, reset: 'buff_lifetime' },
          effects: [
            damage(features.returningSwallow ? 0.9 : 0.6, undefined, false, DamageSource.COUNTER),
            sectEffects.modifyResource(resourceId, 1),
            ...(features.returningSwallow || features.unendingWind ? [createSwordMark()] : []),
            ...(features.unendingWind ? [sectEffects.shieldByAttack(0.4, undefined, 'caster')] : []),
          ],
        }],
      ),
    ],
  });

  built['shadow-step'] = active({
    id: 'shadow-step', name: '无痕步', manaWeight: 1, cooldown: 4, role: 'defensive', targetTeam: 'self',
    effects: [selfBuff(
      'sect.lingxiao.swift.traceless-step',
      '无痕步',
      2,
      [
        { attrType: AttributeType.SPEED, type: ModifierType.ADD, value: 0.15 },
        { attrType: AttributeType.EVASION_RATE, type: ModifierType.FIXED, value: 0.1 },
      ],
      [{
        id: 'sect.lingxiao.swift.traceless-step.dodge',
        eventType: GameplayTags.EVENT.DODGE,
        scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
        priority: 0,
        mapping: { caster: 'owner', target: 'owner' },
        budget: { maxTriggers: 1, reset: 'buff_lifetime' },
        effects: [sectEffects.modifyResource(resourceId, 1)],
      }],
    )],
  });

  built['breaking-edge'] = active({
    id: 'breaking-edge', name: '一线破妄', manaWeight: 1.5, cooldown: 3, role: 'utility',
    effects: [
      damage(1.15),
      { type: 'dispel', params: { targetTag: GameplayTags.BUFF.TYPE.BUFF, maxCount: 1 } },
    ],
  });

  built['sword-aegis'] = active({
    id: 'sword-aegis', name: '流风护心', manaWeight: 1.25, cooldown: 5, role: 'defensive', targetTeam: 'self',
    effects: [selfBuff('sect.lingxiao.swift.wind-heart', '流风护心', 3, [
      { attrType: AttributeType.MAGIC_DEF, type: ModifierType.ADD, value: 0.2 },
      { attrType: AttributeType.EVASION_RATE, type: ModifierType.FIXED, value: 0.05 },
    ])],
  });

  built['nurturing-sword'] = active({
    id: 'nurturing-sword', name: '剑走轻灵', manaWeight: 1.5, cooldown: 5, role: 'defensive', targetTeam: 'self',
    effects: [selfBuff('sect.lingxiao.swift.light-sword', '剑走轻灵', 3, [
      { attrType: AttributeType.ATK, type: ModifierType.ADD, value: 0.12 },
      { attrType: AttributeType.SPEED, type: ModifierType.ADD, value: 0.12 },
    ])],
  });

  const sheathingScale = features.sheathing ? 0.85 : 1;
  built['sect-ultimate'] = active({
    id: 'sect-ultimate', name: '刹那无痕', manaWeight: 2.5, cooldown: 4 + (features.shadowLine ? 1 : 0), role: 'finisher',
    castConditions: [{ type: 'combat_resource_at_least', params: { resourceId, value: features.shadowLine ? 6 : 3, scope: 'caster' } }],
    effects: [
      damage(0.4 * sheathingScale, undefined, false, DamageSource.DIRECT, features.shadowLine),
      ...Array.from({ length: 6 }, (_, index) => damage(
        0.42 * sheathingScale,
        [{ type: 'combat_resource_at_least', params: { resourceId, value: index + 1, scope: 'caster' } }],
        false,
        DamageSource.DIRECT,
        features.shadowLine,
      )),
      sectEffects.consumeResource(resourceId),
      ...(features.mountainBreaking ? [{
        type: 'consume_status_trigger' as const,
        params: {
          match: { id: LINGXIAO_SWORD_MARK_BUFF },
          displayName: '剑痕',
          consume: 'all' as const,
          scaleEffectsByLayer: true,
          effects: [damage(0.18, undefined, true)],
        },
      }] : []),
      ...(features.sheathing ? [
        sectEffects.modifyResource(resourceId, 1, undefined, 'refund'),
        sectEffects.shieldByAttack(0.5, undefined, 'caster'),
      ] : []),
      ...(features.gapless ? [{
        type: 'ability_transform' as const,
        params: {
          id: SWIFT_GAPLESS,
          triggers: 1,
          appliesToTags: [GameplayTags.ABILITY.SECT.ability(LINGXIAO_SECT_ID, 'guiding-sword')],
          freeManaCost: true,
        },
      }, sectEffects.modifyCounter(SWIFT_GAPLESS, 'set', { amount: 1 })] : []),
      ...(features.endlessFlow ? [{
        type: 'runtime_counter_modify' as const,
        conditions: [{ type: 'runtime_counter_compare' as const, params: { key: SWIFT_ENDLESS_COOLDOWN, op: 'lt' as const, value: 1, scope: 'caster' as const } }],
        params: {
          key: SWIFT_ENDLESS_COOLDOWN,
          operation: 'set' as const,
          amount: 3,
          effects: [damage(0.6, undefined, false, DamageSource.FOLLOW_UP), sectEffects.modifyResource(resourceId, 1)],
        },
      }] : []),
      sectEffects.modifyCounter(SWIFT_FINISHER_ACTION, 'set', { amount: 1 }),
      sectEffects.modifyCounter(SWIFT_IDLE_ACTIONS, 'reset'),
    ],
  });

  return built;
}
