import { StackRule } from '@shared/engine/battle-v5/buffs/Buff';
import type {
  AbilityConfig,
  EffectConfig,
} from '@shared/engine/battle-v5/core/configs';
import { EventPriorityLevel } from '@shared/engine/battle-v5/core/events';
import {
  AttributeType,
  BuffType,
  DamageSource,
  DamageType,
  ModifierType,
} from '@shared/engine/battle-v5/core/types';
import { GameplayTags } from '@shared/engine/shared/tag-domain';
import {
  DIRECT_DAMAGE_CONDITION,
  SectAbilityFactory,
  sectEffects,
  withSectBuffMethodGrowth,
  type CultivatorSectPathState,
  type SectAbilityRole,
  type SectCompiledAbility,
  type SectCompiledBuild,
} from '../../../../core';
import { LINGXIAO_BASE_DEFINITION } from '../../definition';
import { LINGXIAO_SECT_ID } from '../../ids';
import {
  createArmorRend,
  HEAVY_ECHO_COOLDOWN,
  LINGXIAO_SWORD_MOMENTUM,
} from '../../shared/LingxiaoMechanics';

export interface HeavySwordFeatures {
  opening: boolean;
  chargedReduction: boolean;
  chargedStrike: boolean;
  chargedGuardShield: boolean;
  mountainGate: boolean;
  returningPeak: boolean;
  rendingMountain: boolean;
  heavenCleaving: boolean;
  immovableMountain: boolean;
  mountainRiverEcho: boolean;
}

export const EMPTY_HEAVY_FEATURES: HeavySwordFeatures = {
  opening: false,
  chargedReduction: false,
  chargedStrike: false,
  chargedGuardShield: false,
  mountainGate: false,
  returningPeak: false,
  rendingMountain: false,
  heavenCleaving: false,
  immovableMountain: false,
  mountainRiverEcho: false,
};

export const HEAVY_CHARGED_REDUCTION = 0.32;
export const HEAVY_CHARGED_STRIKE_COEFFICIENT = 2.08;
export const HEAVY_CHARGED_GUARD_SHIELD_COEFFICIENT = 0.36;
export const HEAVY_RETURNING_PEAK_SHIELD_COEFFICIENT = 0.36;
export const HEAVY_IMMOVABLE_SHIELD_COEFFICIENT = 0.56;
export const HEAVY_IMMOVABLE_COUNTER_COEFFICIENT = 0.36;
export const HEAVY_HEAVEN_CLEAVING_TOTAL_COEFFICIENT = 2.8;
export const HEAVY_FINISHER_COEFFICIENT_PER_MOMENTUM = 0.29;
export const HEAVY_ECHO_HEAL_RATIO = 0.04;
export const HEAVY_ECHO_SHIELD_COEFFICIENT = 0.64;

const damage = (
  coefficient: number,
  damageSource: DamageSource = DamageSource.DIRECT,
  conditions?: EffectConfig['conditions'],
): EffectConfig => ({
  type: 'damage',
  params: {
    value: { attribute: AttributeType.ATK, coefficient },
    damageType: DamageType.PHYSICAL,
    damageSource,
  },
  conditions,
});

const selfBuff = (
  id: string,
  name: string,
  duration: number,
  modifiers: NonNullable<AbilityConfig['modifiers']>,
  listeners?: NonNullable<AbilityConfig['listeners']>,
  growsWithMethod = true,
): EffectConfig => ({
  type: 'apply_buff',
  params: {
    target: 'caster',
    buffConfig: withSectBuffMethodGrowth(
      {
        id,
        name,
        type: BuffType.BUFF,
        duration,
        stackRule: StackRule.REFRESH_DURATION,
        tags: [GameplayTags.BUFF.TYPE.BUFF],
        modifiers,
        listeners,
      },
      { duration: growsWithMethod },
    ),
  },
});

const reductionListeners = (value: number) => [
  {
    id: `sect.lingxiao.heavy.reduction.${value}`,
    eventType: GameplayTags.EVENT.DAMAGE_REQUEST,
    scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
    priority: EventPriorityLevel.DAMAGE_REQUEST + 1,
    mapping: { caster: 'owner' as const, target: 'owner' as const },
    guard: { skipSecondaryDamageSource: true },
    conditions: [DIRECT_DAMAGE_CONDITION],
    effects: [
      {
        type: 'percent_damage_modifier' as const,
        params: { mode: 'reduce' as const, value },
      },
    ],
  },
];

export function buildHeavyAbilities(
  baseBuild: Readonly<SectCompiledBuild>,
  path: CultivatorSectPathState,
  features: HeavySwordFeatures,
  edgeCleansingLevel?: number,
  methodGrowth?: import('../../../../core').SectMethodGrowthPolicy,
): Record<string, SectCompiledAbility> {
  const built = { ...baseBuild.abilities };
  const factory = new SectAbilityFactory(LINGXIAO_SECT_ID);
  const resourceId = LINGXIAO_SWORD_MOMENTUM;
  const active = (args: {
    id: string;
    cooldown: number;
    role: SectAbilityRole;
    effects: EffectConfig[];
    castEffects?: EffectConfig[];
    castConditions?: AbilityConfig['castConditions'];
    targetPolicy: NonNullable<AbilityConfig['targetPolicy']>;
  }): SectCompiledAbility => {
    const definition = LINGXIAO_BASE_DEFINITION.abilities.find(
      (entry) => entry.id === args.id && entry.kind !== 'passive',
    ) as Exclude<
      (typeof LINGXIAO_BASE_DEFINITION.abilities)[number],
      { kind: 'passive' }
    >;
    return factory.active({
      ...args,
      definition,
      pathId: path.pathId,
    });
  };

  built['plain-sword'] = active({
    id: 'plain-sword',
    cooldown: 0,
    role: 'generator',
    targetPolicy: { team: 'enemy', scope: 'single' },
    effects: [damage(0.72), sectEffects.modifyResource(resourceId, 1)],
  });
  built['guiding-sword'] = active({
    id: 'guiding-sword',
    cooldown: 2,
    role: 'generator',
    targetPolicy: { team: 'enemy', scope: 'single' },
    effects: [
      damage(0.84),
      sectEffects.modifyResource(resourceId, 2),
      sectEffects.shieldByAttack(0.16, undefined, 'caster'),
    ],
  });
  built['linked-edge'] = active({
    id: 'linked-edge',
    cooldown: 3,
    role: 'combo',
    targetPolicy: { team: 'enemy', scope: 'single' },
    effects: [
      damage(1.24),
      sectEffects.modifyResource(resourceId, 1),
      sectEffects.shieldByAttack(0.28, undefined, 'caster'),
      ...createArmorRend(),
    ],
  });
  built['turning-body'] = active({
    id: 'turning-body',
    cooldown: 3,
    role: 'defensive',
    targetPolicy: { team: 'self', scope: 'single' },
    effects: [],
    castEffects: [
      selfBuff(
        'sect.lingxiao.heavy.hidden-edge',
        '藏锋听雷',
        1,
        [],
        reductionListeners(
          features.chargedReduction ? HEAVY_CHARGED_REDUCTION : 0.24,
        ),
        false,
      ),
      ...(features.chargedGuardShield
        ? [
            sectEffects.shieldByAttack(
              HEAVY_CHARGED_GUARD_SHIELD_COEFFICIENT,
              undefined,
              'caster',
            ),
          ]
        : []),
      {
        type: 'queue_action',
        params: {
          id: 'sect.lingxiao.heavy.thunder-strike',
          name: '听雷',
          tags: [
            GameplayTags.ABILITY.FUNCTION.DAMAGE,
            GameplayTags.ABILITY.CHANNEL.PHYSICAL,
            GameplayTags.ABILITY.KIND.SECT,
            GameplayTags.ABILITY.SECT.namespace(LINGXIAO_SECT_ID),
            GameplayTags.ABILITY.SECT.path(LINGXIAO_SECT_ID, path.pathId),
            GameplayTags.ABILITY.SECT.ability(LINGXIAO_SECT_ID, 'turning-body'),
            GameplayTags.ABILITY.SECT.COMBO,
            GameplayTags.ABILITY.TARGET.SINGLE,
          ],
          effects: [
            damage(
              features.chargedStrike ? HEAVY_CHARGED_STRIKE_COEFFICIENT : 1.76,
            ),
            ...createArmorRend(features.chargedStrike ? 2 : 1),
            sectEffects.modifyResource(resourceId, 2),
          ],
          interruptPolicy: 'uninterruptible',
          hitPolicy: 'guaranteed',
        },
      },
    ],
  });
  built['shadow-step'] = active({
    id: 'shadow-step',
    cooldown: 4,
    role: 'defensive',
    targetPolicy: { team: 'self', scope: 'single' },
    effects: [
      sectEffects.shieldByAttack(
        0.52 * (features.mountainGate ? 1.5 : 1),
        undefined,
        'caster',
      ),
      selfBuff('sect.lingxiao.heavy.mountain-step', '踏雪无痕', 2, [
        { attrType: AttributeType.DEF, type: ModifierType.ADD, value: 0.16 },
      ]),
      sectEffects.modifyResource(resourceId, 1),
    ],
  });
  built['breaking-edge'] = active({
    id: 'breaking-edge',
    cooldown: 3,
    role: 'utility',
    targetPolicy: { team: 'enemy', scope: 'single' },
    effects: [
      damage(1.04),
      sectEffects.dispelPositiveBuffsByMethod(
        1,
        edgeCleansingLevel,
        methodGrowth!,
      ),
    ],
  });
  built['sword-aegis'] = active({
    id: 'sword-aegis',
    cooldown: 5,
    role: 'defensive',
    targetPolicy: { team: 'self', scope: 'single' },
    effects: [
      ...(features.immovableMountain
        ? [
            sectEffects.shieldByAttack(
              HEAVY_IMMOVABLE_SHIELD_COEFFICIENT,
              undefined,
              'caster',
            ),
          ]
        : []),
      selfBuff(
        'sect.lingxiao.heavy.mountain-heart',
        '剑心通明',
        3,
        [
          {
            attrType: AttributeType.MAGIC_DEF,
            type: ModifierType.ADD,
            value: 0.24,
          },
        ],
        [
          ...reductionListeners(0.08),
          ...(features.immovableMountain
            ? [
                {
                  id: 'sect.lingxiao.heavy.immovable.counter',
                  eventType: GameplayTags.EVENT.DAMAGE_TAKEN,
                  scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
                  priority: 0,
                  mapping: {
                    caster: 'owner' as const,
                    target: 'event.caster' as const,
                  },
                  guard: { skipSecondaryDamageSource: true },
                  budget: { maxTriggers: 1, reset: 'round' as const },
                  conditions: [DIRECT_DAMAGE_CONDITION],
                  effects: [
                    damage(
                      HEAVY_IMMOVABLE_COUNTER_COEFFICIENT,
                      DamageSource.COUNTER,
                    ),
                  ],
                },
              ]
            : []),
        ],
      ),
    ],
  });
  built['nurturing-sword'] = active({
    id: 'nurturing-sword',
    cooldown: 5,
    role: 'defensive',
    targetPolicy: { team: 'self', scope: 'single' },
    effects: [
      selfBuff('sect.lingxiao.heavy.weightless-edge', '人剑合一', 3, [
        { attrType: AttributeType.ATK, type: ModifierType.ADD, value: 0.08 },
        { attrType: AttributeType.DEF, type: ModifierType.ADD, value: 0.16 },
      ]),
    ],
  });

  const returnScale = features.returningPeak ? 0.85 : 1;
  const heaven = features.heavenCleaving;
  built['sect-ultimate'] = active({
    id: 'sect-ultimate',
    cooldown: 4 + (heaven ? 1 : 0),
    role: 'finisher',
    targetPolicy: { team: 'enemy', scope: 'single' },
    castConditions: [
      {
        type: 'combat_resource_at_least',
        params: { resourceId, value: heaven ? 6 : 3, scope: 'caster' },
      },
    ],
    effects: [
      {
        type: 'resource_scaled_damage',
        params: {
          resourceId,
          baseCoefficient:
            (heaven
              ? HEAVY_HEAVEN_CLEAVING_TOTAL_COEFFICIENT -
                HEAVY_FINISHER_COEFFICIENT_PER_MOMENTUM * 6
              : 0.88) * returnScale,
          coefficientPerPoint:
            HEAVY_FINISHER_COEFFICIENT_PER_MOMENTUM * returnScale,
          minPoints: heaven ? 6 : 3,
          maxPoints: 6,
          consume: 'all',
          bypassDefenseRatio: heaven
            ? 0.2
            : features.rendingMountain
              ? 0.15
              : 0,
          damageSource: DamageSource.DIRECT,
        },
      },
      ...(features.returningPeak
        ? [
            sectEffects.modifyResource(resourceId, 2, undefined, 'refund'),
            sectEffects.shieldByAttack(
              HEAVY_RETURNING_PEAK_SHIELD_COEFFICIENT,
              undefined,
              'caster',
            ),
          ]
        : []),
      ...(features.mountainRiverEcho
        ? [
            {
              type: 'runtime_counter_modify' as const,
              conditions: [
                {
                  type: 'runtime_counter_compare' as const,
                  params: {
                    key: HEAVY_ECHO_COOLDOWN,
                    op: 'lt' as const,
                    value: 1,
                    scope: 'caster' as const,
                  },
                },
              ],
              params: {
                key: HEAVY_ECHO_COOLDOWN,
                operation: 'set' as const,
                amount: 3,
                effects: [
                  sectEffects.healMaxHp(HEAVY_ECHO_HEAL_RATIO, 'caster'),
                  sectEffects.shieldByAttack(
                    HEAVY_ECHO_SHIELD_COEFFICIENT,
                    undefined,
                    'caster',
                  ),
                ],
              },
            },
          ]
        : []),
    ],
  });

  return built;
}
