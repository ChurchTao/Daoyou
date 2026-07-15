import { StackRule } from '@shared/engine/battle-v5/buffs/Buff';
import type {
  AbilityConfig,
  EffectConfig,
} from '@shared/engine/battle-v5/core/configs';
import {
  AttributeType,
  BuffType,
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
  LINGXIAO_SHADOW_STEP_BUFF,
  LINGXIAO_SWORD_MARK_BUFF,
  LINGXIAO_SWORD_MOMENTUM,
  SWIFT_ENDLESS_COOLDOWN,
  SWIFT_FINISHER_ACTION,
  SWIFT_GAPLESS,
  SWIFT_IDLE_ACTIONS,
  SWIFT_LINKED_CITY_ROUND,
  SWIFT_RETAINED_FORCE,
} from '../../shared/LingxiaoMechanics';

const damage = sectEffects.physicalDamage.bind(sectEffects);
const healMaxHp = sectEffects.healMaxHp.bind(sectEffects);
const shield = sectEffects.shieldByAttack.bind(sectEffects);
const resource = sectEffects.modifyResource.bind(sectEffects);
const consumeResource = sectEffects.consumeResource.bind(sectEffects);
const counter = sectEffects.modifyCounter.bind(sectEffects);
const counterCondition = sectEffects.counterCondition.bind(sectEffects);
const swordMark = createSwordMark;
const manaCost = calculateSectManaCost;

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

// 快剑基础变体只解释语义特征，不识别任何经脉节点 ID。
export function buildSwiftAbilities(
  baseBuild: Readonly<SectCompiledBuild>,
  realm: RealmType,
  path: CultivatorSectPathState,
  features: SwiftSwordFeatures,
): Record<string, SectCompiledAbility> {
  const built = { ...baseBuild.abilities };
  const abilityFactory = new SectAbilityFactory(LINGXIAO_SECT_ID, realm);
  const active = (args: {
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
  }) => {
    const definition = LINGXIAO_BASE_DEFINITION.abilities.find(
      (ability) => ability.id === args.id,
    );
    if (!definition) throw new Error(`凌霄神通未定义: ${args.id}`);
    return abilityFactory.active({
      ...args,
      definition,
      detailRows: [],
    }).config;
  };
  const id = LINGXIAO_SWORD_MOMENTUM;
  const linkedHits = features.splitLight ? 5 : 3;
  const linkedCoefficient = features.splitLight ? 0.27 : 0.42;
  const linkedCity = features.linkedCity
    ? [
        counter(SWIFT_LINKED_CITY_ROUND, 'add', {
          max: 1,
          effects: [
            {
              type: 'cooldown_modify',
              params: {
                cdModifyValue: -1,
                tags: [
                  GameplayTags.ABILITY.SECT.path(LINGXIAO_SECT_ID, path.pathId),
                ],
              },
            },
          ],
        }),
      ]
    : [];
  const finisherTail = (): EffectConfig[] => [
    ...(features.retainedForce
      ? [
          counter(SWIFT_RETAINED_FORCE, 'reset', {
            scaleEffectsByAmount: true,
            effects: [resource(id, 1)],
          }),
        ]
      : []),
    ...(features.endlessFlow
      ? [
          counter(SWIFT_ENDLESS_COOLDOWN, 'set', {
            amount: 3,
            conditions: [counterCondition(SWIFT_ENDLESS_COOLDOWN, 'lt', 1)],
            effects: [damage(0.6), resource(id, 1)],
          }),
        ]
      : []),
    ...(features.gapless
      ? [
          {
            type: 'ability_transform' as const,
            params: {
              id: 'sect.lingxiao.gapless',
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
          counter(SWIFT_GAPLESS, 'set', { amount: 1 }),
        ]
      : []),
    counter(SWIFT_FINISHER_ACTION, 'set', { amount: 1 }),
    counter(SWIFT_IDLE_ACTIONS, 'reset'),
  ];
  built['plain-sword'] = {
    config: active({
      id: 'plain-sword',
      name: '平剑式',
      mpCost: 0,
      cooldown: 0,
      role: 'generator',
      pathId: path.pathId,
      effects: [damage(0.8), resource(id, 1)],
    }),
    detailRows: ['伤害：0.80物攻', '剑势：获得1点'],
    notes: [],
  };
  built['guiding-sword'] = {
    config: active({
      id: 'guiding-sword',
      name: '追风式',
      mpCost: manaCost(realm, 1),
      cooldown: 0,
      role: 'generator',
      pathId: path.pathId,
      effects: [damage(0.9), resource(id, 2)],
    }),
    detailRows: ['伤害：0.90物攻', '剑势：获得2点'],
    notes: [],
  };
  built['linked-edge'] = {
    config: active({
      id: 'linked-edge',
      name: features.splitLight ? '分光五叠' : '流光三叠',
      mpCost: manaCost(realm, 1.5),
      cooldown: 2,
      role: 'combo',
      pathId: path.pathId,
      effects: [
        ...Array.from({ length: linkedHits }, () => damage(linkedCoefficient)),
        resource(id, features.splitLight ? 3 : 2),
        swordMark(),
        ...(features.stackingWaves
          ? [
              {
                type: 'cooldown_modify' as const,
                params: {
                  cdModifyValue: -1,
                  tags: [GameplayTags.ABILITY.SECT.GENERATOR],
                  maxCount: 1,
                },
              },
            ]
          : []),
        ...linkedCity,
      ],
    }),
    detailRows: [
      `伤害：${linkedHits}段 × ${linkedCoefficient.toFixed(2)}物攻`,
      `剑势：获得${features.splitLight ? 3 : 2}点`,
      '剑痕：施加1层',
    ],
    notes: features.stackingWaves ? ['叠浪：完整命中后减少产势技能冷却。'] : [],
  };
  const counterDamage = features.returningSwallow ? 0.825 : 0.55;
  built['turning-body'] = {
    config: active({
      id: 'turning-body',
      name: '回燕式',
      mpCost: manaCost(realm, 1.25),
      cooldown: 3,
      role: 'defensive',
      pathId: path.pathId,
      effects: [
        damage(0.65),
        {
          type: 'apply_buff',
          params: {
            target: 'caster',
            buffConfig: {
              id: LINGXIAO_RETURNING_SWALLOW_BUFF,
              name: '回燕姿态',
              description: '闪避后反击。',
              type: BuffType.BUFF,
              duration: 2,
              stackRule: StackRule.REFRESH_DURATION,
              tags: [
                GameplayTags.BUFF.TYPE.BUFF,
                GameplayTags.BUFF.SECT.namespace(
                  LINGXIAO_SECT_ID,
                  'ReturningSwallow',
                ),
              ],
              modifiers: [
                {
                  attrType: AttributeType.EVASION_RATE,
                  type: ModifierType.FIXED,
                  value: 0.08,
                },
              ],
              listeners: [
                {
                  id: 'sect.lingxiao.returning-swallow-counter',
                  eventType: GameplayTags.EVENT.DODGE,
                  scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
                  priority: 0,
                  mapping: { caster: 'owner', target: 'event.caster' },
                  effects: [
                    damage(counterDamage),
                    resource(id, 1),
                    ...(features.returningSwallow ? [swordMark()] : []),
                  ],
                },
                ...(features.unendingWind
                  ? [
                      ...(!features.returningSwallow
                        ? [
                            {
                              id: 'sect.lingxiao.unending-wind.mark',
                              eventType: GameplayTags.EVENT.DODGE,
                              scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
                              priority: -1,
                              mapping: {
                                caster: 'owner' as const,
                                target: 'event.caster' as const,
                              },
                              budget: {
                                maxTriggers: 1,
                                reset: 'buff_lifetime' as const,
                              },
                              effects: [swordMark()],
                            },
                          ]
                        : []),
                      {
                        id: 'sect.lingxiao.unending-wind.shield',
                        eventType: GameplayTags.EVENT.DODGE,
                        scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
                        priority: -1,
                        mapping: {
                          caster: 'owner' as const,
                          target: 'owner' as const,
                        },
                        budget: {
                          maxTriggers: 1,
                          reset: 'buff_lifetime' as const,
                        },
                        effects: [shield(0.4)],
                      },
                    ]
                  : []),
              ],
            },
          },
        },
      ],
    }),
    detailRows: [
      '伤害：0.65物攻',
      `反击：${counterDamage.toFixed(2)}物攻`,
      '剑势：反击获得1点',
    ],
    notes: [],
  };
  const shadowLine = features.shadowLine;
  const sheathing = features.sheathing;
  const base = shadowLine ? 2.5 : sheathing ? 0.8 : 1;
  const perMomentum = sheathing ? 0.2 : 0.25;
  const breakingEffects: EffectConfig[] = [
    ...(shadowLine
      ? [
          {
            type: 'next_hit_rule' as const,
            params: { forceCritical: true, triggers: 1 },
          },
        ]
      : []),
    damage(base),
    ...(!shadowLine
      ? Array.from({ length: 6 }, (_, index) =>
          damage(perMomentum, [
            {
              type: 'combat_resource_at_least',
              params: { resourceId: id, value: index + 1, scope: 'caster' },
            },
          ]),
        )
      : []),
    {
      type: 'consume_status_trigger',
      params: {
        match: { id: LINGXIAO_SWORD_MARK_BUFF },
        consume: 'all',
        scaleEffectsByLayer: true,
        effects: [
          damage(
            features.mountainBreaking ? 0.18 : 0.1,
            undefined,
            features.mountainBreaking,
          ),
        ],
      },
    },
    consumeResource(id),
    ...(sheathing ? [resource(id, 1), shield(0.5, undefined, 'caster')] : []),
    ...finisherTail(),
  ];
  built['breaking-edge'] = {
    config: active({
      id: 'breaking-edge',
      name: '一线天',
      mpCost: manaCost(realm, 1.75),
      cooldown: 2 + (shadowLine ? 1 : 0),
      role: 'finisher',
      pathId: path.pathId,
      castConditions: [
        {
          type: 'combat_resource_at_least',
          params: {
            resourceId: id,
            value: shadowLine ? 6 : 3,
            scope: 'caster',
          },
        },
      ],
      effects: breakingEffects,
    }),
    detailRows: [
      `伤害：${base.toFixed(2)}物攻`,
      `释放：至少${shadowLine ? 6 : 3}点剑势`,
      '释放后：消耗全部剑势与剑痕',
    ],
    notes: [],
  };
  built['sword-aegis'] = {
    config: active({
      id: 'sword-aegis',
      name: '剑罡护体',
      mpCost: manaCost(realm, 1.5),
      cooldown: 3,
      role: 'defensive',
      targetTeam: 'self',
      pathId: path.pathId,
      effects: [shield(0.6)],
    }),
    detailRows: ['护盾：0.60物攻'],
    notes: [],
  };
  built['shadow-step'] = {
    config: active({
      id: 'shadow-step',
      name: '踏影',
      mpCost: manaCost(realm, 1),
      cooldown: 2,
      role: 'generator',
      pathId: path.pathId,
      effects: [
        damage(0.55),
        {
          type: 'apply_buff',
          params: {
            target: 'caster',
            buffConfig: {
              id: LINGXIAO_SHADOW_STEP_BUFF,
              name: '踏影',
              type: BuffType.BUFF,
              duration: 2,
              stackRule: StackRule.REFRESH_DURATION,
              tags: [GameplayTags.BUFF.TYPE.BUFF],
              modifiers: [
                {
                  attrType: AttributeType.SPEED,
                  type: ModifierType.ADD,
                  value: 0.1,
                },
              ],
            },
          },
        },
      ],
    }),
    detailRows: ['伤害：0.55物攻', '身法：提高10%'],
    notes: [],
  };
  built['sect-ultimate'] = {
    config: active({
      id: 'sect-ultimate',
      name: '刹那无痕',
      mpCost: manaCost(realm, 2.5),
      cooldown: 4,
      role: 'finisher',
      pathId: path.pathId,
      castConditions: [
        {
          type: 'combat_resource_at_least',
          params: { resourceId: id, value: 6, scope: 'caster' },
        },
      ],
      effects: [
        ...Array.from({ length: 6 }, () => damage(0.4)),
        consumeResource(id),
        resource(id, 1),
        ...linkedCity,
        ...finisherTail(),
      ],
    }),
    detailRows: [
      '伤害：6段 × 0.40物攻',
      '释放：6点剑势',
      '完整命中返还1点剑势',
    ],
    notes: [],
  };
  built['nurturing-sword'] = {
    config: active({
      id: 'nurturing-sword',
      name: '剑息养锋',
      mpCost: manaCost(realm, 1.5),
      cooldown: 4,
      role: 'utility',
      targetTeam: 'self',
      pathId: path.pathId,
      heal: true,
      effects: [healMaxHp(0.08), shield(0.35), resource(id, 2)],
    }),
    detailRows: ['恢复：8%最大气血', '护盾：0.35物攻', '剑势：获得2点'],
    notes: [],
  };
  return built;
}
