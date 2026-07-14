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
import type {
  CultivatorSectPathState,
  CultivatorSectState,
  SectCompiledBuild,
  SectProjectionContext,
} from '../../../types';
import { LINGXIAO_SECT_ID } from '../ids';

import {
  active,
  addCommonNodePassives,
  type AddPassive,
  type BuiltAbility,
  compileLingxiaoBase,
  consumeResource,
  counter,
  counterCondition,
  damage,
  DAMAGE_MODIFIER_PRIORITY,
  healMaxHp,
  LINGXIAO_RETURNING_SWALLOW_BUFF,
  LINGXIAO_SHADOW_STEP_BUFF,
  LINGXIAO_SWORD_MARK_BUFF,
  LINGXIAO_SWORD_MOMENTUM,
  manaCost,
  passive,
  resource,
  resourceChangeCondition,
  shield,
  SWIFT_ENDLESS_COOLDOWN,
  SWIFT_FINISHER_ACTION,
  SWIFT_GAPLESS,
  SWIFT_GUARDED_EDGE,
  SWIFT_IDLE_ACTIONS,
  SWIFT_LINKED_CITY_ROUND,
  SWIFT_RETAINED_FORCE,
  swordMark,
} from './shared';

// ---------- Active ability variants ----------
// Pure snapshot compiler for quick-sword content. Node flags are interpreted
// only here; DeterministicSectPathModule converts snapshots into contributions.
function buildSwift(
  baseBuild: Readonly<SectCompiledBuild>,
  sect: CultivatorSectState,
  realm: RealmType,
  path: CultivatorSectPathState,
  nodes: Set<string>,
): Record<string, BuiltAbility> {
  const built = { ...baseBuild.abilities };
  const scale = 1 + path.level * 0.0008;
  const id = LINGXIAO_SWORD_MOMENTUM;
  const linkedHits = nodes.has('swift-split-light') ? 5 : 3;
  const linkedCoefficient = nodes.has('swift-split-light') ? 0.27 : 0.42;
  const linkedCity = nodes.has('swift-linked-city')
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
    ...(nodes.has('swift-retained-force')
      ? [
          counter(SWIFT_RETAINED_FORCE, 'reset', {
            scaleEffectsByAmount: true,
            effects: [resource(id, 1)],
          }),
        ]
      : []),
    ...(nodes.has('swift-endless-flow')
      ? [
          counter(SWIFT_ENDLESS_COOLDOWN, 'set', {
            amount: 3,
            conditions: [counterCondition(SWIFT_ENDLESS_COOLDOWN, 'lt', 1)],
            effects: [damage(0.6 * scale), resource(id, 1)],
          }),
        ]
      : []),
    ...(nodes.has('swift-gapless')
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
      effects: [damage(0.8 * scale), resource(id, 1)],
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
      effects: [damage(0.9 * scale), resource(id, 2)],
    }),
    detailRows: ['伤害：0.90物攻', '剑势：获得2点'],
    notes: [],
  };
  built['linked-edge'] = {
    config: active({
      id: 'linked-edge',
      name: nodes.has('swift-split-light') ? '分光五叠' : '流光三叠',
      mpCost: manaCost(realm, 1.5),
      cooldown: 2,
      role: 'combo',
      pathId: path.pathId,
      effects: [
        ...Array.from({ length: linkedHits }, () =>
          damage(linkedCoefficient * scale),
        ),
        resource(id, nodes.has('swift-split-light') ? 3 : 2),
        swordMark(),
        ...(nodes.has('swift-stacking-waves')
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
      `剑势：获得${nodes.has('swift-split-light') ? 3 : 2}点`,
      '剑痕：施加1层',
    ],
    notes: nodes.has('swift-stacking-waves')
      ? ['叠浪：完整命中后减少产势技能冷却。']
      : [],
  };
  const counterDamage =
    (nodes.has('swift-returning-swallow') ? 0.825 : 0.55) * scale;
  built['turning-body'] = {
    config: active({
      id: 'turning-body',
      name: '回燕式',
      mpCost: manaCost(realm, 1.25),
      cooldown: 3,
      role: 'defensive',
      pathId: path.pathId,
      effects: [
        damage(0.65 * scale),
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
                    ...(nodes.has('swift-returning-swallow')
                      ? [swordMark()]
                      : []),
                  ],
                },
                ...(nodes.has('swift-unending-wind')
                  ? [
                      ...(!nodes.has('swift-returning-swallow')
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
                        effects: [shield(0.4 * scale)],
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
  const shadowLine = nodes.has('swift-shadow-line');
  const sheathing = nodes.has('swift-sheathing');
  const base = (shadowLine ? 2.5 : sheathing ? 0.8 : 1) * scale;
  const perMomentum = (sheathing ? 0.2 : 0.25) * scale;
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
            (nodes.has('swift-mountain-breaking') ? 0.18 : 0.1) * scale,
            undefined,
            nodes.has('swift-mountain-breaking'),
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
        damage(0.55 * scale),
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
  built['sect-ultimate'] =
    path.level >= 70
      ? {
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
              ...Array.from({ length: 6 }, () => damage(0.4 * scale)),
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
        }
      : built['sect-ultimate'];
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

// ---------- Passive node listeners ----------
function swiftNodePassives(
  path: CultivatorSectPathState,
  nodes: Set<string>,
): AbilityConfig[] {
  const values: AbilityConfig[] = [];
  const resourceId = LINGXIAO_SWORD_MOMENTUM;
  const finisherTag = GameplayTags.ABILITY.SECT.FINISHER;
  const generatorTag = GameplayTags.ABILITY.SECT.GENERATOR;
  const addPassive: AddPassive = (id, name, listeners) =>
    values.push(passive(`sect.lingxiao.${id}`, name, path.pathId, listeners));
  addCommonNodePassives({
    nodes,
    resourceId,
    probingId: 'swift-probing-edge',
    probingName: '试锋',
    probingStatus: swordMark(),
    hiddenId: 'swift-hidden-edge',
    hiddenName: '藏锋',
    borrowedId: 'swift-borrowed-force',
    borrowedName: '借势',
    addPassive,
  });

  if (nodes.has('swift-opening')) {
    addPassive('swift-opening', '疾起', [
      {
        id: 'sect.lingxiao.swift-opening.speed',
        eventType: 'BattleInitEvent',
        scope: GameplayTags.SCOPE.GLOBAL,
        priority: 0,
        mapping: { caster: 'owner', target: 'owner' },
        budget: { maxTriggers: 1, reset: 'battle' },
        effects: [
          {
            type: 'apply_buff',
            params: {
              target: 'caster',
              buffConfig: {
                id: 'sect.lingxiao.swift-opening-speed',
                name: '疾起',
                type: BuffType.BUFF,
                duration: 1,
                stackRule: StackRule.REFRESH_DURATION,
                tags: [GameplayTags.BUFF.TYPE.BUFF],
                modifiers: [
                  {
                    attrType: AttributeType.SPEED,
                    type: ModifierType.ADD,
                    value: 0.08,
                  },
                ],
              },
            },
          },
        ],
      },
    ]);
  }

  if (nodes.has('swift-retained-force')) {
    addPassive('swift-retained-force', '留势', [
      {
        id: 'sect.lingxiao.swift-retained-force.overflow',
        eventType: GameplayTags.EVENT.COMBAT_RESOURCE_CHANGE,
        scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
        priority: 0,
        mapping: { caster: 'owner', target: 'owner' },
        effects: [
          counter(SWIFT_RETAINED_FORCE, 'add', {
            amountFromEvent: 'overflow',
            max: 2,
            conditions: [resourceChangeCondition(resourceId, 'overflow', 1)],
          }),
        ],
      },
    ]);
  }

  if (nodes.has('swift-guarded-edge')) {
    addPassive('swift-guarded-edge', '守锋', [
      {
        id: 'sect.lingxiao.swift-guarded-edge.skip',
        eventType: GameplayTags.EVENT.CONTROLLED_SKIP,
        scope: GameplayTags.SCOPE.OWNER_AS_ACTOR,
        priority: 0,
        mapping: { caster: 'owner', target: 'owner' },
        effects: [counter(SWIFT_GUARDED_EDGE, 'set', { amount: 1 })],
      },
      {
        id: 'sect.lingxiao.swift-guarded-edge.refund',
        eventType: GameplayTags.EVENT.COMBAT_RESOURCE_CHANGE,
        scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
        priority: 0,
        mapping: { caster: 'owner', target: 'owner' },
        effects: [
          counter(SWIFT_GUARDED_EDGE, 'reset', {
            effects: [resource(resourceId, 1)],
            conditions: [
              counterCondition(SWIFT_GUARDED_EDGE, 'gte', 1),
              resourceChangeCondition(resourceId, 'applied', 1),
              { type: 'ability_has_tag', params: { tag: generatorTag } },
            ],
          }),
        ],
      },
    ]);
  }

  if (nodes.has('swift-gapless')) {
    addPassive('swift-gapless', '无隙', [
      {
        id: 'sect.lingxiao.swift-gapless.bonus',
        eventType: GameplayTags.EVENT.COMBAT_RESOURCE_CHANGE,
        scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
        priority: 0,
        mapping: { caster: 'owner', target: 'owner' },
        effects: [
          counter(SWIFT_GAPLESS, 'reset', {
            effects: [resource(resourceId, 1)],
            conditions: [
              counterCondition(SWIFT_GAPLESS, 'gte', 1),
              resourceChangeCondition(resourceId, 'applied', 1),
              {
                type: 'ability_has_tag',
                params: {
                  tag: GameplayTags.ABILITY.SECT.ability(
                    LINGXIAO_SECT_ID,
                    'guiding-sword',
                  ),
                },
              },
            ],
          }),
        ],
      },
    ]);
  }

  if (nodes.has('swift-still-tide') || nodes.has('swift-life-chasing')) {
    const listeners: NonNullable<AbilityConfig['listeners']> = [];
    if (nodes.has('swift-still-tide')) {
      listeners.push(
        {
          id: 'sect.lingxiao.swift-still-tide.action',
          eventType: GameplayTags.EVENT.ACTION_POST,
          scope: GameplayTags.SCOPE.OWNER_AS_ACTOR,
          priority: 0,
          mapping: { caster: 'owner', target: 'owner' },
          effects: [
            counter(SWIFT_IDLE_ACTIONS, 'add', {
              max: 2,
              conditions: [counterCondition(SWIFT_FINISHER_ACTION, 'lt', 1)],
            }),
            counter(SWIFT_IDLE_ACTIONS, 'reset', {
              conditions: [counterCondition(SWIFT_FINISHER_ACTION, 'gte', 1)],
            }),
            counter(SWIFT_FINISHER_ACTION, 'reset'),
          ],
        },
        {
          id: 'sect.lingxiao.swift-still-tide.damage',
          eventType: GameplayTags.EVENT.DAMAGE_REQUEST,
          scope: GameplayTags.SCOPE.OWNER_AS_CASTER,
          priority: DAMAGE_MODIFIER_PRIORITY,
          mapping: { caster: 'owner', target: 'event.target' },
          effects: [
            {
              type: 'percent_damage_modifier',
              params: { mode: 'increase', value: 0.2 },
              conditions: [
                { type: 'ability_has_tag', params: { tag: finisherTag } },
                counterCondition(SWIFT_IDLE_ACTIONS, 'gte', 2),
              ],
            },
          ],
        },
      );
    }
    if (nodes.has('swift-life-chasing')) {
      listeners.push({
        id: 'sect.lingxiao.swift-life-chasing.damage',
        eventType: GameplayTags.EVENT.DAMAGE_REQUEST,
        scope: GameplayTags.SCOPE.OWNER_AS_CASTER,
        priority: DAMAGE_MODIFIER_PRIORITY,
        mapping: { caster: 'owner', target: 'event.target' },
        effects: [
          {
            type: 'percent_damage_modifier',
            params: { mode: 'increase', value: 0.3 },
            conditions: [
              { type: 'ability_has_tag', params: { tag: finisherTag } },
              { type: 'hp_below', params: { value: 0.25, scope: 'target' } },
            ],
          },
        ],
      });
    }
    addPassive('swift-finisher-modifiers', '快剑收束', listeners);
  }

  if (nodes.has('swift-linked-city') || nodes.has('swift-endless-flow')) {
    addPassive('swift-round-counters', '剑流轮转', [
      {
        id: 'sect.lingxiao.swift-round-counters.reset',
        eventType: GameplayTags.EVENT.ROUND_START,
        scope: GameplayTags.SCOPE.GLOBAL,
        priority: 0,
        mapping: { caster: 'owner', target: 'owner' },
        effects: [
          ...(nodes.has('swift-linked-city')
            ? [counter(SWIFT_LINKED_CITY_ROUND, 'reset')]
            : []),
          ...(nodes.has('swift-endless-flow')
            ? [counter(SWIFT_ENDLESS_COOLDOWN, 'subtract', { amount: 1 })]
            : []),
        ],
      },
    ]);
  }

  return values;
}

// ---------- Path snapshot entrypoint ----------
export function compileLingxiaoSwift(
  context: SectProjectionContext,
  path: CultivatorSectPathState,
  nodes: ReadonlySet<string>,
  base: Readonly<SectCompiledBuild> = compileLingxiaoBase(context),
): SectCompiledBuild {
  const nodeSet = new Set(nodes);
  return {
    defaultAbilityId: base.defaultAbilityId,
    abilities: buildSwift(base, context.sect, context.realm, path, nodeSet),
    resources: [
      {
        id: LINGXIAO_SWORD_MOMENTUM,
        name: '剑势',
        initial: nodeSet.has('swift-opening') ? 2 : 0,
        max: 6,
        decayOnNoDirectDamage: 1,
        decayOnControlledSkip: nodeSet.has('swift-guarded-edge') ? 0 : 1,
        pauseDecayWhileShielded: true,
        pauseDecayWhenCounterAtLeast: nodeSet.has('swift-still-tide')
          ? { key: SWIFT_IDLE_ACTIONS, value: 2 }
          : undefined,
      },
    ],
    passives: swiftNodePassives(path, nodeSet),
  };
}
