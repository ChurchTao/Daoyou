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
  createArmorRend,
  HEAVY_AFTERSHOCK_ROUND,
  HEAVY_ECHO_COOLDOWN,
  HEAVY_FINISHER_ACTION,
  HEAVY_IDLE_ACTIONS,
  HEAVY_LINKED_MOUNTAINS,
  LINGXIAO_ARMOR_REND_BUFF,
  LINGXIAO_HEAVY_GUARD_BUFF,
  LINGXIAO_HEAVY_POSTURE,
} from '../../shared/LingxiaoMechanics';

const damage = sectEffects.physicalDamage.bind(sectEffects);
const healMaxHp = sectEffects.healMaxHp.bind(sectEffects);
const shield = sectEffects.shieldByAttack.bind(sectEffects);
const resource = sectEffects.modifyResource.bind(sectEffects);
const consumeResource = sectEffects.consumeResource.bind(sectEffects);
const counter = sectEffects.modifyCounter.bind(sectEffects);
const counterCondition = sectEffects.counterCondition.bind(sectEffects);
const armorRend = createArmorRend;
const manaCost = calculateSectManaCost;

export interface HeavySwordFeatures {
  opening: boolean;
  tripleRidge: boolean;
  shatteringArmor: boolean;
  retainedFrame: boolean;
  crossingPass: boolean;
  unmoved: boolean;
  rendingMountain: boolean;
  returningPeak: boolean;
  aftershock: boolean;
  linkedMountains: boolean;
  steadyMountain: boolean;
  heavenCleaving: boolean;
  immovableMountain: boolean;
  mountainRiverEcho: boolean;
}

export const EMPTY_HEAVY_FEATURES: HeavySwordFeatures = {
  opening: false,
  tripleRidge: false,
  shatteringArmor: false,
  retainedFrame: false,
  crossingPass: false,
  unmoved: false,
  rendingMountain: false,
  returningPeak: false,
  aftershock: false,
  linkedMountains: false,
  steadyMountain: false,
  heavenCleaving: false,
  immovableMountain: false,
  mountainRiverEcho: false,
};

// 重剑基础变体只解释语义特征，不识别任何经脉节点 ID。
export function buildHeavyAbilities(
  baseBuild: Readonly<SectCompiledBuild>,
  realm: RealmType,
  path: CultivatorSectPathState,
  features: HeavySwordFeatures,
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
  const id = LINGXIAO_HEAVY_POSTURE;
  const linkedHits = features.tripleRidge ? 3 : 2;
  const linkedCoefficient = features.tripleRidge ? 0.5 : 0.6;
  const finisherTail = (): EffectConfig[] => [
    ...(features.aftershock
      ? [
          counter(HEAVY_AFTERSHOCK_ROUND, 'add', {
            max: 1,
            effects: [
              {
                type: 'delayed_effect',
                params: {
                  id: 'sect.lingxiao.heavy-aftershock',
                  name: '余震',
                  delayTurns: 1,
                  effects: [damage(0.6)],
                },
              },
            ],
          }),
        ]
      : []),
    ...(features.linkedMountains
      ? [
          {
            type: 'ability_transform' as const,
            params: {
              id: 'sect.lingxiao.linked-mountains',
              triggers: 1,
              appliesToTags: [GameplayTags.ABILITY.SECT.GENERATOR],
              freeManaCost: true,
            },
          },
          counter(HEAVY_LINKED_MOUNTAINS, 'set', { amount: 1 }),
        ]
      : []),
    ...(features.mountainRiverEcho
      ? [
          counter(HEAVY_ECHO_COOLDOWN, 'set', {
            amount: 3,
            conditions: [counterCondition(HEAVY_ECHO_COOLDOWN, 'lt', 1)],
            effects: [
              healMaxHp(0.05, 'caster'),
              shield(0.8, undefined, 'caster'),
            ],
          }),
        ]
      : []),
    counter(HEAVY_FINISHER_ACTION, 'set', { amount: 1 }),
    counter(HEAVY_IDLE_ACTIONS, 'reset'),
  ];
  built['plain-sword'] = {
    config: active({
      id: 'plain-sword',
      name: '沉锋式',
      mpCost: 0,
      cooldown: 0,
      role: 'generator',
      pathId: path.pathId,
      effects: [damage(0.9), resource(id, 1)],
    }),
    detailRows: ['伤害：0.90物攻', '剑架：获得1点'],
    notes: [],
  };
  built['guiding-sword'] = {
    config: active({
      id: 'guiding-sword',
      name: '提岳式',
      mpCost: manaCost(realm, 1),
      cooldown: 1,
      role: 'generator',
      pathId: path.pathId,
      effects: [damage(1.15), resource(id, 2)],
    }),
    detailRows: ['伤害：1.15物攻', '剑架：获得2点'],
    notes: [],
  };
  built['linked-edge'] = {
    config: active({
      id: 'linked-edge',
      name: '叠山式',
      mpCost: manaCost(realm, 1.5),
      cooldown: 2,
      role: 'combo',
      pathId: path.pathId,
      extraTags: [GameplayTags.ABILITY.SECT.GENERATOR],
      effects: [
        ...Array.from({ length: linkedHits }, () => damage(linkedCoefficient)),
        resource(id, features.tripleRidge ? 3 : 2),
        armorRend(),
        ...(features.shatteringArmor ? [armorRend()] : []),
      ],
    }),
    detailRows: [
      `伤害：${linkedHits}段 × ${linkedCoefficient.toFixed(2)}物攻`,
      `剑架：获得${features.tripleRidge ? 3 : 2}点`,
      `裂甲：施加${features.shatteringArmor ? 2 : 1}层`,
    ],
    notes: [],
  };
  const counterDamage = 0.7 * (features.crossingPass ? 1.5 : 1);
  const guardShield = 0.45 * (features.crossingPass ? 1.5 : 1);
  built['turning-body'] = {
    config: active({
      id: 'turning-body',
      name: '横岳式',
      mpCost: manaCost(realm, 1.25),
      cooldown: 3,
      role: 'defensive',
      pathId: path.pathId,
      effects: [
        damage(0.6),
        shield(guardShield, undefined, 'caster'),
        {
          type: 'apply_buff',
          params: {
            target: 'caster',
            buffConfig: {
              id: LINGXIAO_HEAVY_GUARD_BUFF,
              name: '横岳姿态',
              type: BuffType.BUFF,
              duration: 2,
              stackRule: StackRule.REFRESH_DURATION,
              tags: [GameplayTags.BUFF.TYPE.BUFF],
              listeners: [
                {
                  id: 'sect.lingxiao.heavy-guard-counter',
                  eventType: GameplayTags.EVENT.DAMAGE_TAKEN,
                  scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
                  priority: 0,
                  mapping: { caster: 'owner', target: 'event.caster' },
                  budget: { maxTriggers: 1, reset: 'buff_lifetime' },
                  effects: [
                    damage(counterDamage),
                    resource(id, 1),
                    ...(features.crossingPass ? [armorRend()] : []),
                  ],
                },
              ],
            },
          },
        },
      ],
    }),
    detailRows: [
      '伤害：0.60物攻',
      `护盾：${guardShield.toFixed(2)}物攻`,
      `反击：${counterDamage.toFixed(2)}物攻`,
    ],
    notes: [],
  };
  const heaven = features.heavenCleaving;
  built['sect-ultimate'] = {
    config: active({
      id: 'sect-ultimate',
      name: '开天断岳',
      mpCost: manaCost(realm, 2.5),
      cooldown: 4 + (heaven ? 1 : 0),
      role: 'finisher',
      pathId: path.pathId,
      castConditions: [
        {
          type: 'combat_resource_at_least',
          params: { resourceId: id, value: 6, scope: 'caster' },
        },
      ],
      effects: [
        damage(heaven ? 3.5 : 3, undefined, heaven),
        consumeResource(id),
        ...finisherTail(),
      ],
    }),
    detailRows: [
      `伤害：${heaven ? '3.50' : '3.00'}物攻`,
      '释放：6点剑架',
      ...(heaven ? ['特殊：无视防御'] : []),
    ],
    notes: [],
  };
  const returning = features.returningPeak;
  const finisherBase = 1.1 * (returning ? 0.8 : 1);
  const perPosture = 0.3 * (returning ? 0.8 : 1);
  const finisherEffects: EffectConfig[] = [
    damage(finisherBase),
    ...Array.from({ length: 6 }, (_, index) =>
      damage(perPosture, [
        {
          type: 'combat_resource_at_least',
          params: { resourceId: id, value: index + 1, scope: 'caster' },
        },
      ]),
    ),
    {
      type: 'consume_status_trigger',
      params: {
        match: { id: LINGXIAO_ARMOR_REND_BUFF },
        consume: 'all',
        scaleEffectsByLayer: true,
        effects: [
          damage(
            features.rendingMountain ? 0.18 : 0.1,
            undefined,
            features.rendingMountain,
          ),
        ],
      },
    },
    consumeResource(id),
    ...(returning ? [resource(id, 2), shield(0.5, undefined, 'caster')] : []),
    ...finisherTail(),
  ];
  built['breaking-edge'] = {
    config: active({
      id: 'breaking-edge',
      name: '破岳式',
      mpCost: manaCost(realm, 1.75),
      cooldown: 2,
      role: 'finisher',
      pathId: path.pathId,
      castConditions: [
        {
          type: 'combat_resource_at_least',
          params: { resourceId: id, value: 3, scope: 'caster' },
        },
      ],
      effects: finisherEffects,
    }),
    detailRows: [
      `伤害：${finisherBase.toFixed(2)}物攻 + 每点剑架${perPosture.toFixed(2)}物攻`,
      '释放：至少3点剑架',
      '释放后：消耗全部剑架与裂甲',
    ],
    notes: [],
  };
  const aegisScale = features.immovableMountain ? 1.5 : 1;
  built['sword-aegis'] = {
    config: active({
      id: 'sword-aegis',
      name: '镇山剑罡',
      mpCost: manaCost(realm, 1.5),
      cooldown: 3,
      role: 'defensive',
      targetTeam: 'self',
      pathId: path.pathId,
      extraTags: [GameplayTags.ABILITY.SECT.GENERATOR],
      effects: [
        shield(0.8 * aegisScale),
        resource(id, 1),
        ...(features.immovableMountain
          ? [
              {
                type: 'apply_buff' as const,
                params: {
                  target: 'caster' as const,
                  buffConfig: {
                    id: 'sect.lingxiao.immovable-mountain',
                    name: '不动如山',
                    type: BuffType.BUFF,
                    duration: 2,
                    stackRule: StackRule.REFRESH_DURATION,
                    tags: [GameplayTags.BUFF.TYPE.BUFF],
                    listeners: [
                      {
                        id: 'sect.lingxiao.immovable-mountain.counter',
                        eventType: GameplayTags.EVENT.DAMAGE_TAKEN,
                        scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
                        priority: 0,
                        mapping: {
                          caster: 'owner' as const,
                          target: 'event.caster' as const,
                        },
                        budget: {
                          maxTriggers: 1,
                          reset: 'buff_lifetime' as const,
                        },
                        effects: [
                          damage(0.6, [
                            {
                              type: 'has_shield',
                              params: { scope: 'caster', value: 0 },
                            },
                          ]),
                        ],
                      },
                    ],
                  },
                },
              },
            ]
          : []),
      ],
    }),
    detailRows: [`护盾：${(0.8 * aegisScale).toFixed(2)}物攻`, '剑架：获得1点'],
    notes: [],
  };
  built['shadow-step'] = {
    config: active({
      id: 'shadow-step',
      name: '踏岳式',
      mpCost: manaCost(realm, 1),
      cooldown: 2,
      role: 'generator',
      pathId: path.pathId,
      effects: [
        damage(0.75),
        resource(id, 1),
        {
          type: 'apply_buff',
          params: {
            target: 'caster',
            buffConfig: {
              id: 'sect.lingxiao.heavy-defense',
              name: '踏岳守势',
              type: BuffType.BUFF,
              duration: 2,
              stackRule: StackRule.REFRESH_DURATION,
              tags: [GameplayTags.BUFF.TYPE.BUFF],
              modifiers: [
                {
                  attrType: AttributeType.DEF,
                  type: ModifierType.ADD,
                  value: 0.1,
                },
              ],
            },
          },
        },
      ],
    }),
    detailRows: ['伤害：0.75物攻', '剑架：获得1点', '防御：提高10%，持续2回合'],
    notes: [],
  };
  built['nurturing-sword'] = {
    config: active({
      id: 'nurturing-sword',
      name: '抱剑养锋',
      mpCost: manaCost(realm, 1.5),
      cooldown: 4,
      role: 'utility',
      targetTeam: 'self',
      pathId: path.pathId,
      heal: true,
      extraTags: [GameplayTags.ABILITY.SECT.GENERATOR],
      effects: [healMaxHp(0.08), shield(0.6), resource(id, 1)],
    }),
    detailRows: ['恢复：8%最大气血', '护盾：0.60物攻', '剑架：获得1点'],
    notes: [],
  };
  return built;
}
