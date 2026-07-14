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

import {
  active,
  addCommonNodePassives,
  type AddPassive,
  armorRend,
  type BuiltAbility,
  compileLingxiaoBase,
  consumeResource,
  counter,
  counterCondition,
  damage,
  DAMAGE_MODIFIER_PRIORITY,
  DIRECT_DAMAGE_CONDITION,
  healMaxHp,
  HEAVY_AFTERSHOCK_ROUND,
  HEAVY_ECHO_COOLDOWN,
  HEAVY_FINISHER_ACTION,
  HEAVY_IDLE_ACTIONS,
  HEAVY_LINKED_MOUNTAINS,
  HEAVY_RETAINED_FRAME_ACTION,
  HEAVY_UNMOVED_GUARD,
  LINGXIAO_ARMOR_REND_BUFF,
  LINGXIAO_HEAVY_GUARD_BUFF,
  LINGXIAO_HEAVY_POSTURE,
  manaCost,
  passive,
  resource,
  resourceChangeCondition,
  shield,
} from './shared';

// ---------- Active ability variants ----------
// Pure snapshot compiler for heavy-sword content. Its resource and node rules
// remain private to this path plugin and are never dispatched by shared code.
function buildHeavy(
  baseBuild: Readonly<SectCompiledBuild>,
  sect: CultivatorSectState,
  realm: RealmType,
  path: CultivatorSectPathState,
  nodes: Set<string>,
): Record<string, BuiltAbility> {
  const built = { ...baseBuild.abilities };
  const scale = 1 + path.level * 0.0008;
  const id = LINGXIAO_HEAVY_POSTURE;
  const linkedHits = nodes.has('heavy-triple-ridge') ? 3 : 2;
  const linkedCoefficient = nodes.has('heavy-triple-ridge') ? 0.5 : 0.6;
  const finisherTail = (): EffectConfig[] => [
    ...(nodes.has('heavy-aftershock')
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
                  effects: [damage(0.6 * scale)],
                },
              },
            ],
          }),
        ]
      : []),
    ...(nodes.has('heavy-linked-mountains')
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
    ...(nodes.has('heavy-mountain-river-echo')
      ? [
          counter(HEAVY_ECHO_COOLDOWN, 'set', {
            amount: 3,
            conditions: [counterCondition(HEAVY_ECHO_COOLDOWN, 'lt', 1)],
            effects: [
              healMaxHp(0.05, 'caster'),
              shield(0.8 * scale, undefined, 'caster'),
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
      effects: [damage(0.9 * scale), resource(id, 1)],
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
      effects: [damage(1.15 * scale), resource(id, 2)],
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
        ...Array.from({ length: linkedHits }, () =>
          damage(linkedCoefficient * scale),
        ),
        resource(id, nodes.has('heavy-triple-ridge') ? 3 : 2),
        armorRend(),
        ...(nodes.has('heavy-shattering-armor') ? [armorRend()] : []),
      ],
    }),
    detailRows: [
      `伤害：${linkedHits}段 × ${linkedCoefficient.toFixed(2)}物攻`,
      `剑架：获得${nodes.has('heavy-triple-ridge') ? 3 : 2}点`,
      `裂甲：施加${nodes.has('heavy-shattering-armor') ? 2 : 1}层`,
    ],
    notes: [],
  };
  const counterDamage =
    0.7 * scale * (nodes.has('heavy-crossing-pass') ? 1.5 : 1);
  const guardShield =
    0.45 * scale * (nodes.has('heavy-crossing-pass') ? 1.5 : 1);
  built['turning-body'] = {
    config: active({
      id: 'turning-body',
      name: '横岳式',
      mpCost: manaCost(realm, 1.25),
      cooldown: 3,
      role: 'defensive',
      pathId: path.pathId,
      effects: [
        damage(0.6 * scale),
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
                    ...(nodes.has('heavy-crossing-pass') ? [armorRend()] : []),
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
  const heaven = nodes.has('heavy-heaven-cleaving');
  built['sect-ultimate'] =
    path.level >= 70
      ? {
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
              damage((heaven ? 3.5 : 3) * scale, undefined, heaven),
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
        }
      : built['sect-ultimate'];
  const returning = nodes.has('heavy-returning-peak');
  const finisherBase = 1.1 * scale * (returning ? 0.8 : 1);
  const perPosture = 0.3 * scale * (returning ? 0.8 : 1);
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
            (nodes.has('heavy-rending-mountain') ? 0.18 : 0.1) * scale,
            undefined,
            nodes.has('heavy-rending-mountain'),
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
  const aegisScale = nodes.has('heavy-immovable-mountain') ? 1.5 : 1;
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
        shield(0.8 * scale * aegisScale),
        resource(id, 1),
        ...(nodes.has('heavy-immovable-mountain')
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
                          damage(0.6 * scale, [
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
        damage(0.75 * scale),
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
      effects: [healMaxHp(0.08), shield(0.6 * scale), resource(id, 1)],
    }),
    detailRows: ['恢复：8%最大气血', '护盾：0.60物攻', '剑架：获得1点'],
    notes: [],
  };
  return built;
}

// ---------- Passive node listeners ----------
function heavyNodePassives(
  path: CultivatorSectPathState,
  nodes: Set<string>,
): AbilityConfig[] {
  const values: AbilityConfig[] = [];
  const resourceId = LINGXIAO_HEAVY_POSTURE;
  const finisherTag = GameplayTags.ABILITY.SECT.FINISHER;
  const generatorTag = GameplayTags.ABILITY.SECT.GENERATOR;
  const addPassive: AddPassive = (id, name, listeners) =>
    values.push(passive(`sect.lingxiao.${id}`, name, path.pathId, listeners));
  addCommonNodePassives({
    nodes,
    resourceId,
    probingId: 'heavy-testing-frame',
    probingName: '试架',
    probingStatus: armorRend(),
    hiddenId: 'heavy-hidden-weight',
    hiddenName: '藏重',
    borrowedId: 'heavy-borrowed-weight',
    borrowedName: '借重',
    addPassive,
  });

  if (nodes.has('heavy-retained-frame')) {
    addPassive('heavy-retained-frame', '留架', [
      {
        id: 'sect.lingxiao.heavy-retained-frame.reset',
        eventType: GameplayTags.EVENT.ACTION_PRE,
        scope: GameplayTags.SCOPE.GLOBAL,
        priority: 1,
        mapping: { caster: 'owner', target: 'owner' },
        effects: [counter(HEAVY_RETAINED_FRAME_ACTION, 'reset')],
      },
      {
        id: 'sect.lingxiao.heavy-retained-frame.overflow',
        eventType: GameplayTags.EVENT.COMBAT_RESOURCE_CHANGE,
        scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
        priority: 0,
        mapping: { caster: 'owner', target: 'owner' },
        effects: [
          counter(HEAVY_RETAINED_FRAME_ACTION, 'add', {
            amountFromEvent: 'overflow',
            max: 2,
            scaleEffectsByAmount: true,
            effects: [shield(0.15 * (1 + path.level * 0.0008))],
            conditions: [resourceChangeCondition(resourceId, 'overflow', 1)],
          }),
        ],
      },
    ]);
  }

  if (nodes.has('heavy-unmoved')) {
    addPassive('heavy-unmoved', '不移', [
      {
        id: 'sect.lingxiao.heavy-unmoved.skip',
        eventType: GameplayTags.EVENT.CONTROLLED_SKIP,
        scope: GameplayTags.SCOPE.OWNER_AS_ACTOR,
        priority: 0,
        mapping: { caster: 'owner', target: 'owner' },
        effects: [
          resource(resourceId, 1),
          counter(HEAVY_UNMOVED_GUARD, 'set', { amount: 1 }),
        ],
      },
      {
        id: 'sect.lingxiao.heavy-unmoved.guard',
        eventType: GameplayTags.EVENT.DAMAGE_REQUEST,
        scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
        priority: DAMAGE_MODIFIER_PRIORITY,
        mapping: { caster: 'owner', target: 'owner' },
        effects: [
          {
            type: 'percent_damage_modifier',
            params: { mode: 'reduce', value: 0.1 },
            conditions: [
              counterCondition(HEAVY_UNMOVED_GUARD, 'gte', 1),
              DIRECT_DAMAGE_CONDITION,
            ],
          },
          counter(HEAVY_UNMOVED_GUARD, 'reset', {
            conditions: [
              counterCondition(HEAVY_UNMOVED_GUARD, 'gte', 1),
              DIRECT_DAMAGE_CONDITION,
            ],
          }),
        ],
      },
    ]);
  }

  if (nodes.has('heavy-linked-mountains')) {
    addPassive('heavy-linked-mountains', '连山', [
      {
        id: 'sect.lingxiao.heavy-linked-mountains.bonus',
        eventType: GameplayTags.EVENT.COMBAT_RESOURCE_CHANGE,
        scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
        priority: 0,
        mapping: { caster: 'owner', target: 'owner' },
        effects: [
          counter(HEAVY_LINKED_MOUNTAINS, 'reset', {
            effects: [resource(resourceId, 1)],
            conditions: [
              counterCondition(HEAVY_LINKED_MOUNTAINS, 'gte', 1),
              resourceChangeCondition(resourceId, 'applied', 1),
              { type: 'ability_has_tag', params: { tag: generatorTag } },
            ],
          }),
        ],
      },
    ]);
  }

  if (nodes.has('heavy-steady-mountain') || nodes.has('heavy-ending-life')) {
    const listeners: NonNullable<AbilityConfig['listeners']> = [];
    if (nodes.has('heavy-steady-mountain')) {
      listeners.push(
        {
          id: 'sect.lingxiao.heavy-steady-mountain.action',
          eventType: GameplayTags.EVENT.ACTION_POST,
          scope: GameplayTags.SCOPE.OWNER_AS_ACTOR,
          priority: 0,
          mapping: { caster: 'owner', target: 'owner' },
          effects: [
            counter(HEAVY_IDLE_ACTIONS, 'add', {
              max: 2,
              conditions: [counterCondition(HEAVY_FINISHER_ACTION, 'lt', 1)],
            }),
            counter(HEAVY_IDLE_ACTIONS, 'reset', {
              conditions: [counterCondition(HEAVY_FINISHER_ACTION, 'gte', 1)],
            }),
            counter(HEAVY_FINISHER_ACTION, 'reset'),
          ],
        },
        {
          id: 'sect.lingxiao.heavy-steady-mountain.guard',
          eventType: GameplayTags.EVENT.DAMAGE_REQUEST,
          scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
          priority: DAMAGE_MODIFIER_PRIORITY,
          mapping: { caster: 'owner', target: 'owner' },
          conditions: [DIRECT_DAMAGE_CONDITION],
          effects: [
            {
              type: 'percent_damage_modifier',
              params: { mode: 'reduce', value: 0.1 },
              conditions: [
                {
                  type: 'combat_resource_at_least',
                  params: { resourceId, value: 6, scope: 'caster' },
                },
              ],
            },
          ],
        },
        {
          id: 'sect.lingxiao.heavy-steady-mountain.finisher',
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
                counterCondition(HEAVY_IDLE_ACTIONS, 'gte', 2),
              ],
            },
          ],
        },
      );
    }
    if (nodes.has('heavy-ending-life')) {
      listeners.push({
        id: 'sect.lingxiao.heavy-ending-life.damage',
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
    addPassive('heavy-finisher-modifiers', '重剑收束', listeners);
  }

  if (nodes.has('heavy-aftershock') || nodes.has('heavy-mountain-river-echo')) {
    addPassive('heavy-round-counters', '山势轮转', [
      {
        id: 'sect.lingxiao.heavy-round-counters.reset',
        eventType: GameplayTags.EVENT.ROUND_START,
        scope: GameplayTags.SCOPE.GLOBAL,
        priority: 0,
        mapping: { caster: 'owner', target: 'owner' },
        effects: [
          ...(nodes.has('heavy-aftershock')
            ? [counter(HEAVY_AFTERSHOCK_ROUND, 'reset')]
            : []),
          ...(nodes.has('heavy-mountain-river-echo')
            ? [counter(HEAVY_ECHO_COOLDOWN, 'subtract', { amount: 1 })]
            : []),
        ],
      },
    ]);
  }
  return values;
}

// ---------- Path snapshot entrypoint ----------
export function compileLingxiaoHeavy(
  context: SectProjectionContext,
  path: CultivatorSectPathState,
  nodes: ReadonlySet<string>,
  base: Readonly<SectCompiledBuild> = compileLingxiaoBase(context),
): SectCompiledBuild {
  const nodeSet = new Set(nodes);
  return {
    defaultAbilityId: base.defaultAbilityId,
    abilities: buildHeavy(base, context.sect, context.realm, path, nodeSet),
    resources: [
      {
        id: LINGXIAO_HEAVY_POSTURE,
        name: '剑架',
        initial: nodeSet.has('heavy-opening') ? 2 : 0,
        max: 6,
      },
    ],
    passives: heavyNodePassives(path, nodeSet),
  };
}
