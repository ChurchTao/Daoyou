import { StackRule } from '@shared/engine/battle-v5/buffs/Buff';
import type {
  AbilityConfig,
  EffectConfig,
} from '@shared/engine/battle-v5/core/configs';
import {
  AttributeType,
  BuffType,
  DamageSource,
  DamageType,
  ModifierType,
} from '@shared/engine/battle-v5/core/types';
import { GameplayTags } from '@shared/engine/shared/tag-domain';
import {
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

export const SWIFT_SPLIT_LIGHT_HIT_COEFFICIENT = 0.21;
export const SWIFT_RETURNING_SWALLOW_COUNTER_COEFFICIENT = 0.6;
export const SWIFT_MOUNTAIN_BREAKING_COEFFICIENT = 0.12;
export const SWIFT_SHEATHING_SHIELD_COEFFICIENT = 0.48;
export const SWIFT_ENDLESS_FLOW_COEFFICIENT = 0.32;
export const SWIFT_UNENDING_WIND_SHIELD_COEFFICIENT = 0.4;

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
  growsWithMethod = true,
  stackRule: StackRule = StackRule.REFRESH_DURATION,
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
        stackRule,
        tags: [GameplayTags.BUFF.TYPE.BUFF],
        modifiers,
        listeners,
      },
      { duration: growsWithMethod },
    ),
  },
});

export function buildSwiftAbilities(
  baseBuild: Readonly<SectCompiledBuild>,
  path: CultivatorSectPathState,
  features: SwiftSwordFeatures,
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
    castConditions?: AbilityConfig['castConditions'];
    targetPolicy?: AbilityConfig['targetPolicy'];
    extraTags?: string[];
  }): SectCompiledAbility => {
    const definition = LINGXIAO_BASE_DEFINITION.abilities.find(
      (entry) => entry.id === args.id && entry.kind !== 'passive',
    ) as Exclude<(typeof LINGXIAO_BASE_DEFINITION.abilities)[number], { kind: 'passive' }>;
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
    effects: [damage(0.65), sectEffects.modifyResource(resourceId, 1)],
  });

  built['guiding-sword'] = active({
    id: 'guiding-sword',
    cooldown: 0,
    role: 'generator',
    effects: [
      damage(0.78),
      sectEffects.modifyResource(resourceId, 2),
      damage(
        0.26,
        [
          {
            type: 'attribute_compare',
            params: {
              attribute: AttributeType.SPEED,
              left: 'caster',
              right: 'target',
              op: 'gt',
            },
          },
        ],
        false,
        DamageSource.FOLLOW_UP,
      ),
    ],
  });

  const hits = features.splitLight ? 7 : 5;
  const hitCoefficient = features.splitLight
    ? SWIFT_SPLIT_LIGHT_HIT_COEFFICIENT
    : 0.29;
  built['linked-edge'] = active({
    id: 'linked-edge',
    cooldown: 2,
    role: 'combo',
    effects: [
      ...Array.from({ length: hits }, () => damage(hitCoefficient)),
      sectEffects.modifyResource(resourceId, features.splitLight ? 3 : 2),
      createSwordMark(),
      ...(features.retainedForce ? [createSwordMark()] : []),
      ...(features.stackingWaves
        ? [
            {
              type: 'cooldown_modify' as const,
              params: {
                cdModifyValue: -1,
                target: 'caster' as const,
                includeCurrent: true,
                tags: [
                  GameplayTags.ABILITY.SECT.ability(
                    LINGXIAO_SECT_ID,
                    'linked-edge',
                  ),
                ],
              },
            },
          ]
        : []),
      ...(features.linkedCity
        ? [
            {
              type: 'runtime_counter_modify' as const,
              params: {
                key: SWIFT_LINKED_CITY_ROUND,
                operation: 'add' as const,
                amount: 1,
                max: 1,
                effects: [
                  {
                    type: 'cooldown_modify' as const,
                    params: {
                      cdModifyValue: -1,
                      target: 'caster' as const,
                      tags: [
                        GameplayTags.ABILITY.SECT.path(
                          LINGXIAO_SECT_ID,
                          path.pathId,
                        ),
                      ],
                    },
                  },
                ],
              },
            },
          ]
        : []),
    ],
  });

  built['turning-body'] = active({
    id: 'turning-body',
    cooldown: 3,
    role: 'defensive',
    effects: [
      damage(0.3),
      selfBuff(
        LINGXIAO_RETURNING_SWALLOW_BUFF,
        '藏锋听雷',
        2,
        [
          {
            attrType: AttributeType.EVASION_RATE,
            type: ModifierType.FIXED,
            value: 0.24,
          },
        ],
        [
          {
            id: 'sect.lingxiao.swift.returning-swallow',
            eventType: GameplayTags.EVENT.DODGE,
            scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
            priority: 0,
            mapping: { caster: 'owner', target: 'event.caster' },
            budget: { maxTriggers: 1, reset: 'buff_lifetime' },
            effects: [
              damage(
                features.returningSwallow
                  ? SWIFT_RETURNING_SWALLOW_COUNTER_COEFFICIENT
                  : 0.4,
                undefined,
                false,
                DamageSource.COUNTER,
              ),
              sectEffects.modifyResource(resourceId, 1),
              ...(features.returningSwallow || features.unendingWind
                ? [createSwordMark()]
                : []),
              ...(features.unendingWind
                ? [
                    sectEffects.shieldByAttack(
                      SWIFT_UNENDING_WIND_SHIELD_COEFFICIENT,
                      undefined,
                      'caster',
                    ),
                  ]
                : []),
            ],
          },
        ],
        true,
        StackRule.OVERRIDE,
      ),
    ],
  });

  built['shadow-step'] = active({
    id: 'shadow-step',
    cooldown: 4,
    role: 'defensive',
    targetPolicy: { team: 'self', scope: 'single' },
    effects: [
      selfBuff(
        'sect.lingxiao.swift.traceless-step',
        '踏雪无痕',
        2,
        [
          {
            attrType: AttributeType.SPEED,
            type: ModifierType.ADD,
            value: 0.12,
          },
          {
            attrType: AttributeType.EVASION_RATE,
            type: ModifierType.FIXED,
            value: 0.08,
          },
        ],
        [
          {
            id: 'sect.lingxiao.swift.traceless-step.dodge',
            eventType: GameplayTags.EVENT.DODGE,
            scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
            priority: 0,
            mapping: { caster: 'owner', target: 'owner' },
            budget: { maxTriggers: 1, reset: 'buff_lifetime' },
            effects: [sectEffects.modifyResource(resourceId, 1)],
          },
        ],
        true,
        StackRule.OVERRIDE,
      ),
    ],
  });

  built['breaking-edge'] = active({
    id: 'breaking-edge',
    cooldown: 3,
    role: 'utility',
    effects: [
      damage(0.95),
      sectEffects.dispelPositiveBuffsByMethod(1, edgeCleansingLevel, methodGrowth!),
    ],
  });

  built['sword-aegis'] = active({
    id: 'sword-aegis',
    cooldown: 5,
    role: 'defensive',
    targetPolicy: { team: 'self', scope: 'single' },
    effects: [
      selfBuff('sect.lingxiao.swift.wind-heart', '剑心通明', 3, [
        {
          attrType: AttributeType.MAGIC_DEF,
          type: ModifierType.ADD,
          value: 0.16,
        },
        {
          attrType: AttributeType.EVASION_RATE,
          type: ModifierType.FIXED,
          value: 0.04,
        },
      ]),
    ],
  });

  built['nurturing-sword'] = active({
    id: 'nurturing-sword',
    cooldown: 5,
    role: 'defensive',
    targetPolicy: { team: 'self', scope: 'single' },
    effects: [
      selfBuff('sect.lingxiao.swift.light-sword', '人剑合一', 3, [
        { attrType: AttributeType.ATK, type: ModifierType.ADD, value: 0.1 },
        { attrType: AttributeType.SPEED, type: ModifierType.ADD, value: 0.1 },
      ]),
    ],
  });

  const finisherScale =
    (features.sheathing ? 0.85 : 1) * (features.shadowLine ? 0.85 : 1);
  built['sect-ultimate'] = active({
    id: 'sect-ultimate',
    cooldown: 4 + (features.shadowLine ? 1 : 0),
    role: 'finisher',
    castConditions: [
      {
        type: 'combat_resource_at_least',
        params: {
          resourceId,
          value: features.shadowLine ? 6 : 3,
          scope: 'caster',
        },
      },
    ],
    effects: [
      damage(
        0.3 * finisherScale,
        undefined,
        false,
        DamageSource.DIRECT,
        features.shadowLine,
      ),
      ...Array.from({ length: 6 }, (_, index) =>
        damage(
          0.33 * finisherScale,
          [
            {
              type: 'combat_resource_at_least',
              params: { resourceId, value: index + 1, scope: 'caster' },
            },
          ],
          false,
          DamageSource.DIRECT,
          features.shadowLine,
        ),
      ),
      sectEffects.consumeResource(resourceId),
      ...(features.mountainBreaking
        ? [
            {
              type: 'consume_status_trigger' as const,
              params: {
                match: { id: LINGXIAO_SWORD_MARK_BUFF },
                displayName: '剑痕',
                consume: 'all' as const,
                scaleEffectsByLayer: true,
                effects: [
                  damage(SWIFT_MOUNTAIN_BREAKING_COEFFICIENT, undefined, true),
                ],
              },
            },
          ]
        : []),
      ...(features.sheathing
        ? [
            sectEffects.modifyResource(resourceId, 2, undefined, 'refund'),
            sectEffects.shieldByAttack(
              SWIFT_SHEATHING_SHIELD_COEFFICIENT,
              undefined,
              'caster',
            ),
          ]
        : []),
      ...(features.gapless
        ? [
            {
              type: 'ability_transform' as const,
              params: {
                id: SWIFT_GAPLESS,
                triggers: 1,
                appliesToTags: [
                  GameplayTags.ABILITY.SECT.ability(
                    LINGXIAO_SECT_ID,
                    'guiding-sword',
                  ),
                ],
                freeManaCost: true,
              },
            },
            sectEffects.modifyCounter(SWIFT_GAPLESS, 'set', { amount: 1 }),
          ]
        : []),
      ...(features.endlessFlow
        ? [
            {
              type: 'runtime_counter_modify' as const,
              conditions: [
                {
                  type: 'runtime_counter_compare' as const,
                  params: {
                    key: SWIFT_ENDLESS_COOLDOWN,
                    op: 'lt' as const,
                    value: 1,
                    scope: 'caster' as const,
                  },
                },
              ],
              params: {
                key: SWIFT_ENDLESS_COOLDOWN,
                operation: 'set' as const,
                amount: 3,
                effects: [
                  damage(
                    SWIFT_ENDLESS_FLOW_COEFFICIENT,
                    undefined,
                    false,
                    DamageSource.FOLLOW_UP,
                  ),
                  sectEffects.modifyResource(resourceId, 1),
                ],
              },
            },
          ]
        : []),
      sectEffects.modifyCounter(SWIFT_FINISHER_ACTION, 'set', { amount: 1 }),
      sectEffects.modifyCounter(SWIFT_IDLE_ACTIONS, 'reset'),
    ],
  });

  return built;
}
