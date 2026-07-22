import { StackRule } from '@shared/engine/battle-v5/buffs/Buff';
import type {
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
  ModifierType,
} from '@shared/engine/battle-v5/core/types';
import { GameplayTags } from '@shared/engine/shared/tag-domain';
import {
  SectAbilityFactory,
  type SectBuildBuilder,
  type SectProjectionContext,
} from '../../../core';
import { YOUDU_BASE_DEFINITION } from '../definition';
import {
  YOUDU_FORGETFUL_RIVER,
  YOUDU_NO_RETURN,
  YOUDU_RETURNING_SOUL,
  YOUDU_SECT_ID,
  YOUDU_SHADOW_REVEALED,
  YOUDU_SOUL_EROSION,
  YOUDU_SOUL_FIRE,
  YOUDU_SOUL_LOST,
  YOUDU_SOUL_PINNING_NAIL,
  youduAbilityTag,
} from '../ids';
import {
  createYouduBuildSettings,
  type YouduBuildSettings,
} from '../shared/buildFacade';

const factory = new SectAbilityFactory(YOUDU_SECT_ID);
const soulDamageTag = GameplayTags.ABILITY.SECT.mechanic(
  YOUDU_SECT_ID,
  'soul-damage',
);
const soulFireConsumerTag = GameplayTags.ABILITY.SECT.mechanic(
  YOUDU_SECT_ID,
  'soul-fire-consumer',
);

const YOUDU_LAYER_PRIORITY = {
  RETURNING_CLAMP: 1_000,
  FIFTH_LAYER_NODE: 600,
  SOUL_FIRE_GAIN: 550,
  SOUL_LOST: 500,
} as const;

const stateTag = (id: string) => GameplayTags.STATUS.SECT.state(YOUDU_SECT_ID, id);
const buffTag = (id: string) => GameplayTags.BUFF.SECT.namespace(YOUDU_SECT_ID, id);

const erosionTag = buffTag('soul-erosion');
const lostTag = buffTag('soul-lost');
const returningTag = stateTag('returning-soul');
const forgetTag = buffTag('forgetful-river');
const noReturnTag = buffTag('no-return');
const shadowTag = stateTag('shadow-revealed');
const heartUsedTag = stateTag('heart-dead-used');
const judgmentTag = stateTag('one-name-judgment');
const nameInYouduUsedTag = stateTag('name-in-youdu-used');

function definition(id: string) {
  const result = YOUDU_BASE_DEFINITION.abilities.find((ability) => ability.id === id);
  if (!result) throw new Error(`幽都神通定义缺失: ${id}`);
  return result;
}

function condition(
  type: ConditionConfig['type'],
  params: ConditionConfig['params'],
): ConditionConfig {
  return { type, params };
}

function coefficient(value: number): string {
  return value.toFixed(2);
}

function percentage(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function debuffTags(...tags: string[]): string[] {
  return [GameplayTags.BUFF.TYPE.DEBUFF, ...tags];
}

function controlTags(...tags: string[]): string[] {
  return [
    GameplayTags.BUFF.TYPE.DEBUFF,
    GameplayTags.BUFF.TYPE.CONTROL,
    ...tags,
  ];
}

function layerCurveDetail(label: string, values: readonly number[]): string {
  const groups: Array<{ start: number; end: number; value: number }> = [];
  values.forEach((value, index) => {
    const layer = index + 1;
    const previous = groups[groups.length - 1];
    if (previous?.value === value) {
      previous.end = layer;
    } else {
      groups.push({ start: layer, end: layer, value });
    }
  });
  return `${label}：${groups.map(({ start, end, value }) => {
    const range = start === end ? `${start}层` : `${start}～${end}层`;
    return `${range}${percentage(value)}`;
  }).join('，')}`;
}

function erosionDetailRows(settings: YouduBuildSettings): string[] {
  return [
    layerCurveDetail(
      '物攻、法攻、物防、法防、身法',
      settings.erosionAttributeCurve,
    ),
    layerCurveDetail('受治疗削弱', settings.erosionHealCurve),
    '普通驱散每次只移除1层蚀魂',
  ];
}

function soulFireDetail(settings: YouduBuildSettings): string {
  return `拥有3点魂火时：本次魂伤提高${percentage(settings.soulFireBonus)}，伤害后消耗全部魂火`;
}

function hiddenMarker(id: string, name: string, tag: string): BuffConfig {
  return {
    id,
    name,
    type: BuffType.BUFF,
    duration: -1,
    stackRule: StackRule.IGNORE,
    logVisibility: 'debug',
    statusVisibility: 'hidden',
    countsAsStatus: false,
    dispelPolicy: 'protected',
    statusTags: [tag],
  };
}

function deathCleanupListener(id: string): ListenerConfig {
  return {
    id: `${id}.death-cleanup`,
    eventType: GameplayTags.EVENT.UNIT_DEAD,
    scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
    priority: EventPriorityLevel.POST_SETTLE,
    mapping: { caster: 'owner', target: 'owner' },
    guard: { requireOwnerAlive: false },
    effects: [{
      type: 'buff_layer_modify',
      params: { match: { id }, operation: 'clear' },
    }],
  };
}

function applyBuff(
  buffConfig: BuffConfig,
  target: 'caster' | 'target' = 'target',
  extras: Partial<Extract<EffectConfig, { type: 'apply_buff' }>['params']> = {},
): EffectConfig {
  return {
    type: 'apply_buff',
    params: { buffConfig, target, ...extras },
  };
}

function soulDamage(
  coefficient: number,
  extras: Partial<Extract<EffectConfig, { type: 'damage' }>['params']> = {},
): EffectConfig {
  return {
    type: 'damage',
    params: {
      value: { attribute: AttributeType.MAGIC_ATK, coefficient },
      damageType: DamageType.TRUE,
      damageSource: DamageSource.DIRECT,
      canCrit: false,
      canLifesteal: false,
      ...extras,
    },
  };
}

function magicalDamage(coefficient: number): EffectConfig {
  return {
    type: 'damage',
    params: {
      value: { attribute: AttributeType.MAGIC_ATK, coefficient },
      damageType: DamageType.MAGICAL,
      damageSource: DamageSource.DIRECT,
    },
  };
}

function gainSoulFire(amount = 1, target: 'caster' | 'target' = 'caster'): EffectConfig {
  return {
    type: 'combat_resource_modify',
    params: {
      resourceId: YOUDU_SOUL_FIRE,
      operation: 'add',
      amount,
      target,
      reason: 'gain',
    },
  };
}

function returningSoulBuff(): BuffConfig {
  return {
    id: YOUDU_RETURNING_SOUL,
    name: '归窍',
    description: '魂魄方归，短时间内蚀魂最多只能达到四层。',
    type: BuffType.BUFF,
    duration: 1,
    stackRule: StackRule.REFRESH_DURATION,
    dispelPolicy: 'protected',
    countsAsStatus: false,
    tags: [buffTag('returning-soul')],
    statusTags: [returningTag],
    listeners: [{
      id: 'sect.youdu.returning-soul-clamp',
      eventType: GameplayTags.EVENT.BUFF_LAYER_CHANGED,
      scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
      priority: YOUDU_LAYER_PRIORITY.RETURNING_CLAMP,
      mapping: { caster: 'owner', target: 'owner' },
      conditions: [
        condition('source_has_tag', { tag: erosionTag }),
        condition('buff_layer_change', {
          tag: erosionTag,
          eventField: 'currentLayer',
          op: 'gte',
          value: 5,
        }),
      ],
      effects: [{
        type: 'buff_layer_modify',
        params: {
          match: { id: YOUDU_SOUL_EROSION },
          operation: 'set',
          layers: 4,
        },
      }],
    }, deathCleanupListener(YOUDU_RETURNING_SOUL)],
  };
}

function temporaryPenalty(
  id: string,
  name: string,
  attack: number,
  speed = 0,
): BuffConfig {
  return {
    id,
    name,
    type: BuffType.DEBUFF,
    duration: 1,
    stackRule: StackRule.REFRESH_DURATION,
    tags: debuffTags(),
    modifiers: [
      { attrType: AttributeType.ATK, type: ModifierType.ADD, value: attack },
      { attrType: AttributeType.MAGIC_ATK, type: ModifierType.ADD, value: attack },
      ...(speed
        ? [{ attrType: AttributeType.SPEED, type: ModifierType.ADD, value: speed }]
        : []),
    ],
  };
}

function convergeLostSoul(
  settings: YouduBuildSettings,
  branch: 'success' | 'resist' | 'other',
): EffectConfig[] {
  return [
    {
      type: 'buff_layer_modify',
      params: {
        match: { id: YOUDU_SOUL_EROSION },
        operation: 'set',
        layers: 3,
      },
    },
    applyBuff(returningSoulBuff()),
    ...(branch === 'resist' && settings.lostResistPenalty
      ? [applyBuff(temporaryPenalty(
          'sect.youdu.measured-punishment',
          '魂刑有度',
          -0.20,
          -0.20,
        ))]
      : []),
    ...(branch === 'success' && settings.lostAfterPenalty
      ? [applyBuff(temporaryPenalty(
          'sect.youdu.five-souls-penalty',
          '五魄俱散',
          -0.15,
        ))]
      : []),
  ];
}

function soulLostBuff(settings: YouduBuildSettings): BuffConfig {
  return {
    id: YOUDU_SOUL_LOST,
    name: '失魂',
    description: '下一次正常行动被跳过，期间无法受到气血治疗。',
    type: BuffType.CONTROL,
    duration: 1,
    stackRule: StackRule.IGNORE,
    dispelPolicy: 'protected',
    tags: controlTags(
      lostTag,
      GameplayTags.STATUS.CONTROL.NO_ACTION,
    ),
    statusTags: [GameplayTags.STATUS.CONTROL.NO_ACTION],
    modifiers: [{
      attrType: AttributeType.HEAL_RECEIVED_REDUCTION,
      type: ModifierType.FIXED,
      value: 1,
    }],
    listeners: [{
      id: 'sect.youdu.soul-lost-skip-converge',
      eventType: GameplayTags.EVENT.CONTROLLED_SKIP,
      scope: GameplayTags.SCOPE.OWNER_AS_ACTOR,
      priority: EventPriorityLevel.POST_SETTLE,
      mapping: { caster: 'owner', target: 'owner' },
      effects: convergeLostSoul(settings, 'success'),
    }, deathCleanupListener(YOUDU_SOUL_LOST)],
  };
}

function forgetfulRiverBuff(settings: YouduBuildSettings): BuffConfig {
  const dotBase = settings.forgetDotCoefficient;
  const highCoefficient = dotBase * (1 + settings.forgetHighLayerBonus);
  const fourCoefficient = dotBase * (
    1 + settings.forgetHighLayerBonus + settings.forgetFourLayerBonus
  );
  const damageEffects: EffectConfig[] = [
    {
      ...soulDamage(fourCoefficient, { damageSource: DamageSource.DELAYED }),
      conditions: [condition('buff_layer_at_least', {
        id: YOUDU_SOUL_EROSION, scope: 'target', value: 4,
      })],
    },
    {
      ...soulDamage(highCoefficient, { damageSource: DamageSource.DELAYED }),
      conditions: [
        condition('buff_layer_at_least', {
          id: YOUDU_SOUL_EROSION, scope: 'target', value: 3,
        }),
        condition('buff_layer_below', {
          id: YOUDU_SOUL_EROSION, scope: 'target', value: 4,
        }),
      ],
    },
    {
      ...soulDamage(dotBase, { damageSource: DamageSource.DELAYED }),
      conditions: [condition('buff_layer_below', {
        id: YOUDU_SOUL_EROSION, scope: 'target', value: 3,
      })],
    },
  ];
  return {
    id: YOUDU_FORGETFUL_RIVER,
    name: '忘川',
    description: '每次行动前受到魂伤，且受到的气血治疗降低。',
    type: BuffType.DEBUFF,
    duration: settings.forgetDuration,
    stackRule: StackRule.REFRESH_DURATION,
    tags: debuffTags(forgetTag, GameplayTags.BUFF.DOT.ROOT),
    statusTags: [stateTag('forgetful-river')],
    modifiers: [
      {
        attrType: AttributeType.HEAL_RECEIVED_REDUCTION,
        type: ModifierType.FIXED,
        value: settings.forgetHealReduction,
      },
      ...(settings.forgetSpeedReduction
        ? [{
            attrType: AttributeType.SPEED,
            type: ModifierType.ADD,
            value: settings.forgetSpeedReduction,
          }]
        : []),
    ],
    manualSettlementEffects: damageEffects,
    listeners: [
      {
        id: 'sect.youdu.forgetful-river-dot',
        eventType: GameplayTags.EVENT.ACTION_PRE,
        scope: GameplayTags.SCOPE.OWNER_AS_ACTOR,
        priority: EventPriorityLevel.ROUND_PRE,
        mapping: { caster: 'owner', target: 'owner' },
        effects: damageEffects,
      },
      ...(settings.pathId === 'tide'
        ? [{
            id: 'sect.youdu.long-night-soul-fire',
            eventType: GameplayTags.EVENT.DAMAGE_TAKEN,
            scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
            priority: EventPriorityLevel.DAMAGE_TAKEN,
            mapping: { caster: 'event.caster', target: 'owner' },
            budget: { maxTriggers: 1, reset: 'round' as const },
            conditions: [
              condition('source_has_tag', { tag: forgetTag }),
              condition('damage_source_is', { damageSource: DamageSource.DELAYED }),
              condition('damage_taken_at_least', { value: 1 }),
            ],
            effects: [gainSoulFire()],
          } satisfies ListenerConfig]
        : []),
      ...(settings.crossingEcho
        ? [{
            id: 'sect.youdu.crossing-echo',
            eventType: GameplayTags.EVENT.DAMAGE_TAKEN,
            scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
            priority: EventPriorityLevel.DAMAGE_TAKEN,
            mapping: { caster: 'event.caster', target: 'owner' },
            budget: { maxTriggers: 1, reset: 'round' as const },
            conditions: [
              condition('source_has_tag', { tag: forgetTag }),
              condition('damage_source_is', { damageSource: DamageSource.DELAYED }),
              condition('buff_layer_at_least', {
                id: YOUDU_SOUL_EROSION, scope: 'target', value: 4,
              }),
            ],
            effects: [soulDamage(0.12, { damageSource: DamageSource.FOLLOW_UP })],
          } satisfies ListenerConfig]
        : []),
      deathCleanupListener(YOUDU_FORGETFUL_RIVER),
    ],
  };
}

function soulErosionBuff(settings: YouduBuildSettings): BuffConfig {
  const listeners: ListenerConfig[] = [
    {
      id: 'sect.youdu.erosion-gain-soul-fire',
      eventType: GameplayTags.EVENT.BUFF_LAYER_CHANGED,
      scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
      priority: YOUDU_LAYER_PRIORITY.SOUL_FIRE_GAIN,
      mapping: { caster: 'event.source', target: 'owner' },
      budget: { maxTriggers: 1, reset: 'source_action' },
      conditions: [
        condition('buff_layer_change', {
          tag: erosionTag, eventField: 'delta', op: 'gt', value: 0,
        }),
        condition('has_not_tag', { scope: 'target', tag: returningTag }),
      ],
      effects: [gainSoulFire()],
    },
    {
      id: 'sect.youdu.erosion-gain-soul-fire',
      eventType: GameplayTags.EVENT.BUFF_LAYER_CHANGED,
      scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
      priority: YOUDU_LAYER_PRIORITY.SOUL_FIRE_GAIN,
      mapping: { caster: 'event.source', target: 'owner' },
      budget: { maxTriggers: 1, reset: 'source_action' },
      conditions: [
        condition('buff_layer_change', {
          tag: erosionTag, eventField: 'delta', op: 'gt', value: 0,
        }),
        condition('buff_layer_change', {
          tag: erosionTag, eventField: 'previousLayer', op: 'lt', value: 4,
        }),
        condition('has_tag', { scope: 'target', tag: returningTag }),
      ],
      effects: [gainSoulFire()],
    },
    ...(settings.firstErosionExtraFire
      ? [{
          id: 'sect.youdu.first-soul-lantern',
          eventType: GameplayTags.EVENT.BUFF_LAYER_CHANGED,
          scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
          priority: 190,
          mapping: { caster: 'event.source', target: 'owner' },
          budget: { maxTriggers: 1, reset: 'battle' as const },
          conditions: [condition('buff_layer_change', {
            tag: erosionTag, eventField: 'delta', op: 'gt', value: 0,
          })],
          effects: [gainSoulFire()],
        } satisfies ListenerConfig]
      : []),
    {
      id: 'sect.youdu.erosion-trigger-soul-lost',
      eventType: GameplayTags.EVENT.BUFF_LAYER_CHANGED,
      scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
      priority: YOUDU_LAYER_PRIORITY.SOUL_LOST,
      mapping: { caster: 'event.source', target: 'owner' },
      conditions: [
        condition('buff_layer_change', {
          tag: erosionTag, eventField: 'previousLayer', op: 'lt', value: 5,
        }),
        condition('buff_layer_change', {
          tag: erosionTag, eventField: 'currentLayer', op: 'gte', value: 5,
        }),
        condition('buff_layer_at_least', {
          id: YOUDU_SOUL_EROSION, scope: 'target', value: 5,
        }),
        condition('has_not_tag', { scope: 'target', tag: returningTag }),
      ],
      effects: [applyBuff(soulLostBuff(settings), 'target', {
        controlHitBonus: settings.highLayerControlHitBonus,
        onResistEffects: convergeLostSoul(settings, 'resist'),
      })],
    },
    {
      id: 'sect.youdu.erosion-soul-lost-immune',
      eventType: GameplayTags.EVENT.BUFF_IMMUNE,
      scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
      priority: YOUDU_LAYER_PRIORITY.SOUL_LOST,
      mapping: { caster: 'owner', target: 'owner' },
      conditions: [condition('source_has_tag', { tag: lostTag })],
      effects: convergeLostSoul(settings, 'other'),
    },
    {
      id: 'sect.youdu.erosion-soul-lost-manual-remove',
      eventType: GameplayTags.EVENT.BUFF_REMOVED,
      scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
      priority: YOUDU_LAYER_PRIORITY.SOUL_LOST,
      mapping: { caster: 'owner', target: 'owner' },
      conditions: [condition('buff_removed_reason_is', {
        tag: lostTag, reason: 'manual',
      })],
      effects: convergeLostSoul(settings, 'other'),
    },
    {
      id: 'sect.youdu.shadow-vulnerability',
      eventType: GameplayTags.EVENT.DAMAGE_REQUEST,
      scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
      priority: EventPriorityLevel.HIT_CHECK,
      mapping: { caster: 'event.caster', target: 'owner' },
      conditions: [condition('has_tag', { scope: 'target', tag: shadowTag })],
      effects: [{
        type: 'percent_damage_modifier',
        params: { mode: 'increase', value: 0.02, scaleByBuffLayer: true, cap: 0.10 },
      }],
    },
  ];

  if (settings.pathId === 'decree') {
    listeners.push(
      {
        id: 'sect.youdu.decree-direct-soul-bonus',
        eventType: GameplayTags.EVENT.DAMAGE_REQUEST,
        scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
        priority: EventPriorityLevel.HIT_CHECK,
        mapping: { caster: 'event.caster', target: 'owner' },
        conditions: [
          condition('damage_type_is', { damageType: DamageType.TRUE }),
          condition('ability_has_tag', {
            tag: GameplayTags.ABILITY.SECT.path(YOUDU_SECT_ID, 'decree'),
          }),
          condition('buff_layer_at_least', {
            id: YOUDU_SOUL_EROSION, scope: 'target', value: 3,
          }),
        ],
        effects: [{
          type: 'percent_damage_modifier',
          params: { mode: 'increase', value: settings.decreeDirectSoulBonus },
        }],
      },
      {
        id: 'sect.youdu.decree-shadow-layer-bonus',
        eventType: GameplayTags.EVENT.DAMAGE_REQUEST,
        scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
        priority: EventPriorityLevel.HIT_CHECK,
        mapping: { caster: 'event.caster', target: 'owner' },
        conditions: [
          condition('damage_type_is', { damageType: DamageType.TRUE }),
          condition('ability_has_tag', {
            tag: GameplayTags.ABILITY.SECT.path(YOUDU_SECT_ID, 'decree'),
          }),
          condition('has_tag', { scope: 'target', tag: shadowTag }),
        ],
        effects: [{
          type: 'percent_damage_modifier',
          params: {
            mode: 'increase',
            value: settings.decreeShadowLayerBonus,
            scaleByBuffLayer: true,
            cap: 0.05,
          },
        }],
      },
    );
  }

  if (settings.cleanseToll) {
    listeners.push({
      id: 'sect.youdu.cleanse-toll',
      eventType: GameplayTags.EVENT.BUFF_LAYER_CHANGED,
      scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
      priority: 100,
      mapping: { caster: 'event.source', target: 'owner' },
      budget: { maxTriggers: 1, reset: 'action' },
      conditions: [condition('buff_layer_change', {
        tag: erosionTag,
        reason: 'dispel',
        eventField: 'delta',
        op: 'lt',
        value: 0,
      })],
      effects: [soulDamage(0.12, { damageSource: DamageSource.FOLLOW_UP })],
    });
  }

  const fifthLayerEffects: EffectConfig[] = [];
  if (settings.hundredGhosts) {
    fifthLayerEffects.push(soulDamage(0.30, { damageSource: DamageSource.FOLLOW_UP }));
  }
  if (settings.dreamInvasion) {
    fifthLayerEffects.push({
      ...applyBuff(forgetfulRiverBuff(settings)),
      conditions: [condition('has_tag', {
        scope: 'target', tag: stateTag('forgetful-river'),
      })],
    });
  }
  if (settings.lastFerry) {
    fifthLayerEffects.push({
      type: 'mana_burn',
      conditions: [condition('has_tag', {
        scope: 'target', tag: stateTag('forgetful-river'),
      })],
      params: { value: { targetMaxMpRatio: 0.10 } },
    });
  }
  if (fifthLayerEffects.length) {
    listeners.push({
      id: 'sect.youdu.fifth-layer-node-effects',
      eventType: GameplayTags.EVENT.BUFF_LAYER_CHANGED,
      scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
      priority: YOUDU_LAYER_PRIORITY.FIFTH_LAYER_NODE,
      mapping: { caster: 'event.source', target: 'owner' },
      budget: settings.hundredGhosts
        ? { maxTriggers: 1, reset: 'battle' }
        : undefined,
      conditions: [
        condition('buff_layer_change', {
          tag: erosionTag, eventField: 'previousLayer', op: 'lt', value: 5,
        }),
        condition('buff_layer_change', {
          tag: erosionTag, eventField: 'currentLayer', op: 'gte', value: 5,
        }),
        condition('buff_layer_at_least', {
          id: YOUDU_SOUL_EROSION, scope: 'target', value: 5,
        }),
      ],
      effects: fifthLayerEffects,
    });
  }

  if (settings.oneNameOneJudgment) {
    listeners.push({
      id: 'sect.youdu.mark-first-four-layers',
      eventType: GameplayTags.EVENT.BUFF_LAYER_CHANGED,
      scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
      priority: 300,
      mapping: { caster: 'event.source', target: 'owner' },
      budget: { maxTriggers: 1, reset: 'battle' },
      conditions: [
        condition('buff_layer_change', {
          tag: erosionTag, eventField: 'previousLayer', op: 'lt', value: 4,
        }),
        condition('buff_layer_change', {
          tag: erosionTag, eventField: 'currentLayer', op: 'gte', value: 4,
        }),
      ],
      effects: [applyBuff(hiddenMarker(
        'sect.youdu.one-name-judgment',
        '一名一判',
        judgmentTag,
      ))],
    });
  }
  listeners.push(deathCleanupListener(YOUDU_SOUL_EROSION));

  return {
    id: YOUDU_SOUL_EROSION,
    name: '蚀魂',
    description: '攻防、速度与受治疗能力随层数逐步衰败。',
    type: BuffType.DEBUFF,
    duration: 3,
    stackRule: StackRule.STACK_LAYER,
    maxLayers: 5,
    dispelMode: 'one_layer',
    tags: debuffTags(erosionTag),
    statusTags: [stateTag('soul-erosion')],
    modifiers: [
      ...[
        AttributeType.ATK,
        AttributeType.MAGIC_ATK,
        AttributeType.DEF,
        AttributeType.MAGIC_DEF,
        AttributeType.SPEED,
      ].map((attrType) => ({
        attrType,
        type: ModifierType.ADD,
        value: 0,
        valueByLayer: settings.erosionAttributeCurve,
      })),
      {
        attrType: AttributeType.HEAL_RECEIVED_REDUCTION,
        type: ModifierType.FIXED,
        value: 0,
        valueByLayer: settings.erosionHealCurve,
      },
    ],
    listeners,
  };
}

function applyErosion(layers: number, settings: YouduBuildSettings): EffectConfig {
  return {
    ...applyBuff(soulErosionBuff(settings), 'target', { layers }),
    conditions: [condition('hp_above', { scope: 'target', value: 0 })],
  };
}

function noReturnBuff(settings: YouduBuildSettings): BuffConfig {
  return {
    id: YOUDU_NO_RETURN,
    name: '不归',
    description: '受到的气血治疗降低80%，速度降低。',
    type: BuffType.DEBUFF,
    duration: 2,
    stackRule: StackRule.REFRESH_DURATION,
    tags: debuffTags(noReturnTag),
    statusTags: [stateTag('no-return')],
    modifiers: [
      {
        attrType: AttributeType.HEAL_RECEIVED_REDUCTION,
        type: ModifierType.FIXED,
        value: 0.80,
      },
      {
        attrType: AttributeType.SPEED,
        type: ModifierType.ADD,
        value: settings.noReturnSpeedReduction,
      },
    ],
    listeners: [deathCleanupListener(YOUDU_NO_RETURN)],
  };
}

function shadowBuff(settings: YouduBuildSettings): BuffConfig {
  return {
    id: YOUDU_SHADOW_REVEALED,
    name: '照影',
    description: '闪避属性按零计算但仍保留最低闪避，蚀魂会实时放大受到的伤害。',
    type: BuffType.DEBUFF,
    duration: settings.shadowDuration,
    stackRule: StackRule.REFRESH_DURATION,
    tags: debuffTags(buffTag('shadow-revealed')),
    statusTags: [shadowTag],
    modifiers: [{
      attrType: AttributeType.EVASION_RATE,
      type: ModifierType.OVERRIDE,
      value: 0,
    }],
    listeners: [deathCleanupListener(YOUDU_SHADOW_REVEALED)],
  };
}

function pinBuff(duration: number): BuffConfig {
  return {
    id: YOUDU_SOUL_PINNING_NAIL,
    name: '镇魂钉',
    description: '无法施展主动技能，且受到的气血治疗为零。',
    type: BuffType.CONTROL,
    duration,
    stackRule: StackRule.REFRESH_DURATION,
    tags: controlTags(
      buffTag('soul-pinning-nail'),
      GameplayTags.STATUS.CONTROL.NO_SKILL,
    ),
    statusTags: [GameplayTags.STATUS.CONTROL.NO_SKILL],
    modifiers: [{
      attrType: AttributeType.HEAL_RECEIVED_REDUCTION,
      type: ModifierType.FIXED,
      value: 1,
    }],
    listeners: [deathCleanupListener(YOUDU_SOUL_PINNING_NAIL)],
  };
}

function heartImmunityBuff(controlTag: string): BuffConfig {
  const controlSuffix = controlTag.split('.').slice(-1)[0].toLowerCase();
  const controlLabel = controlTag === GameplayTags.STATUS.CONTROL.NO_ACTION
    ? '禁行'
    : controlTag === GameplayTags.STATUS.CONTROL.NO_SKILL
      ? '封印'
      : '禁普攻';
  return {
    id: `sect.youdu.heart-immunity.${controlSuffix}`,
    name: `心死神活·免${controlLabel}`,
    description: `1回合内免疫${controlLabel}类控制。`,
    type: BuffType.BUFF,
    duration: 1,
    stackRule: StackRule.REFRESH_DURATION,
    dispelPolicy: 'protected',
    countsAsStatus: false,
    listeners: [{
      id: `sect.youdu.heart-immunity-listener.${controlTag}`,
      eventType: GameplayTags.EVENT.BUFF_ADD,
      scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
      priority: EventPriorityLevel.BUFF_INTERCEPT,
      mapping: { caster: 'owner', target: 'owner' },
      effects: [{ type: 'buff_immunity', params: { tags: [controlTag] } }],
    }],
  };
}

function compileRuntime(
  builder: SectBuildBuilder,
  settings: YouduBuildSettings,
): void {
  const runtime = definition('youdu-runtime');
  if (runtime.kind !== 'passive') throw new Error('心死神活定义错误');
  const listeners: ListenerConfig[] = [];
  for (const [index, controlTag] of [
    GameplayTags.STATUS.CONTROL.NO_ACTION,
    GameplayTags.STATUS.CONTROL.NO_SKILL,
    GameplayTags.STATUS.CONTROL.NO_BASIC,
  ].entries()) {
    const heartEffects: EffectConfig[] = [
      {
        type: 'buff_layer_modify',
        params: { match: { tags: [controlTag] }, operation: 'clear', target: 'caster' },
      },
      applyBuff(hiddenMarker(
        'sect.youdu.heart-dead-used',
        '心死神活·已触发',
        heartUsedTag,
      ), 'caster'),
      applyBuff(heartImmunityBuff(controlTag), 'caster'),
      ...(settings.heartShield
        ? [{
            type: 'shield',
            params: { value: { targetMaxHpRatio: 0.10 }, target: 'caster' },
          } satisfies EffectConfig]
        : []),
    ];
    listeners.push({
      id: `sect.youdu.heart-dead-release.${index}`,
      eventType: GameplayTags.EVENT.BUFF_APPLIED,
      scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
      priority: EventPriorityLevel.BUFF_INTERCEPT,
      mapping: { caster: 'owner', target: 'owner' },
      conditions: [
        condition('has_not_tag', { scope: 'caster', tag: heartUsedTag }),
        condition('source_has_tag', { tag: controlTag }),
      ],
      effects: heartEffects,
    });
  }
  listeners.push({
    id: 'sect.youdu.soul-fire-empower',
    eventType: GameplayTags.EVENT.DAMAGE_REQUEST,
    scope: GameplayTags.SCOPE.OWNER_AS_CASTER,
    priority: EventPriorityLevel.HIT_CHECK,
    mapping: { caster: 'owner', target: 'event.target' },
    budget: { maxTriggers: 1, reset: 'source_action' },
    conditions: [
      condition('combat_resource_at_least', {
        scope: 'caster', resourceId: YOUDU_SOUL_FIRE, value: 3,
      }),
      condition('damage_type_is', { damageType: DamageType.TRUE }),
      condition('ability_has_tag', { tag: soulFireConsumerTag }),
    ],
    effects: [{
      type: 'percent_damage_modifier',
      params: { mode: 'increase', value: settings.soulFireBonus },
    }],
  });
  if (settings.pathId === 'decree') {
    for (const controlTag of [
      GameplayTags.STATUS.CONTROL.NO_ACTION,
      GameplayTags.STATUS.CONTROL.NO_SKILL,
      GameplayTags.STATUS.CONTROL.NO_BASIC,
    ]) {
      listeners.push({
        id: 'sect.youdu.decree-control-response-fire',
        eventType: GameplayTags.EVENT.BUFF_APPLIED,
        scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
        priority: EventPriorityLevel.BUFF_INTERCEPT + 1,
        mapping: { caster: 'owner', target: 'owner' },
        budget: { maxTriggers: 1, reset: 'round' },
        conditions: [
          condition('has_not_tag', { scope: 'caster', tag: heartUsedTag }),
          condition('source_has_tag', { tag: controlTag }),
        ],
        effects: [gainSoulFire(settings.heartSoulFireGain)],
      });
    }
    listeners.push({
      id: 'sect.youdu.decree-control-response-fire',
      eventType: GameplayTags.EVENT.CONTROL_RESIST,
      scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
      priority: EventPriorityLevel.POST_SETTLE,
      mapping: { caster: 'owner', target: 'owner' },
      budget: { maxTriggers: 1, reset: 'round' },
      effects: [gainSoulFire()],
    });
  }
  if (settings.firstShadowExtraLayer) {
    listeners.push({
      id: 'sect.youdu.first-shadow-extra-layer',
      eventType: GameplayTags.EVENT.HIT_CHECK,
      scope: GameplayTags.SCOPE.OWNER_AS_CASTER,
      priority: EventPriorityLevel.POST_SETTLE,
      mapping: { caster: 'owner', target: 'event.target' },
      budget: { maxTriggers: 1, reset: 'battle' },
      conditions: [
        condition('is_hit', {}),
        condition('ability_has_tag', {
          tag: GameplayTags.ABILITY.SECT.namespace(YOUDU_SECT_ID),
        }),
        condition('has_tag', { scope: 'target', tag: shadowTag }),
      ],
      effects: [applyErosion(1, settings)],
    });
  }
  builder.setAbility('youdu-runtime', factory.passive({
    definition: runtime,
    pathId: settings.pathId,
    modifiers: [{
      attrType: AttributeType.CONTROL_RESISTANCE,
      type: ModifierType.FIXED,
      value: 0.30 + settings.extraControlResistance,
    }],
    listeners,
    detailRows: [
      `控制抗性 +${percentage(0.30 + settings.extraControlResistance)}`,
      '本场首次成功受控后立即解除，并短暂免疫同类控制',
      ...(settings.heartSoulFireGain > 0
        ? [
            `首次解控时获得${settings.heartSoulFireGain}点魂火；每回合首次成功抵抗控制时获得1点魂火`,
          ]
        : []),
      ...(settings.heartShield
        ? ['首次解控后获得10%最大气血护盾']
        : []),
      ...(settings.firstShadowExtraLayer
        ? ['每场首次命中照影目标的幽都神通额外增加1层蚀魂']
        : []),
    ],
  }));

}

function consumeSoulFire(): EffectConfig {
  return {
    type: 'combat_resource_modify',
    conditions: [condition('combat_resource_at_least', {
      scope: 'caster', resourceId: YOUDU_SOUL_FIRE, value: 3,
    })],
    params: {
      resourceId: YOUDU_SOUL_FIRE,
      operation: 'consume_all',
      target: 'caster',
      reason: 'spend',
    },
  };
}

function compileAbilities(
  builder: SectBuildBuilder,
  settings: YouduBuildSettings,
): void {
  const oneSigh = definition('one-sigh');
  if (oneSigh.kind === 'passive') throw new Error('一叹定义错误');
  builder.setAbility('one-sigh', factory.active({
    definition: oneSigh,
    pathId: settings.pathId,
    targetPolicy: { team: 'enemy', scope: 'single' },
    effects: [
      {
        ...magicalDamage(0.65 * (1 + settings.sighForgetBonus)),
        conditions: [condition('has_tag', { scope: 'target', tag: stateTag('forgetful-river') })],
      },
      {
        ...magicalDamage(0.65),
        conditions: [condition('has_not_tag', { scope: 'target', tag: stateTag('forgetful-river') })],
      },
      applyErosion(1, settings),
    ],
    detailRows: [
      `${coefficient(0.65)} × 法术攻击（术伤）`,
      ...(settings.sighForgetBonus > 0
        ? [`目标有忘川时伤害提高${percentage(settings.sighForgetBonus)}`]
        : []),
      '命中后增加1层蚀魂',
      ...erosionDetailRows(settings),
    ],
  }));

  const sever = definition('soul-severing-call');
  if (sever.kind === 'passive') throw new Error('离魂引定义错误');
  const severLayers: AbilityEffectLayerConfig[] = [
    {
      id: 'sever-low',
      displayName: '目标施法前少于3层蚀魂时',
      effects: [soulDamage(0.52)],
    },
    {
      id: 'sever-high',
      displayName: '目标施法前至少3层蚀魂时',
      effects: [soulDamage(0.52 * (1 + settings.severHighLayerBonus))],
    },
  ];
  const severPlans: AbilityEffectPlanConfig[] = [
    {
      id: 'sever-high', name: sever.baseName, priority: 20,
      conditions: [condition('buff_layer_at_least', {
        id: YOUDU_SOUL_EROSION, scope: 'target', value: 3,
      })],
      layerIds: ['sever-high'],
    },
    {
      id: 'sever-low', name: sever.baseName, priority: 10,
      conditions: [condition('buff_layer_below', {
        id: YOUDU_SOUL_EROSION, scope: 'target', value: 3,
      })],
      layerIds: ['sever-low'],
    },
  ];
  builder.setAbility('soul-severing-call', factory.active({
    definition: sever,
    pathId: settings.pathId,
    targetPolicy: { team: 'enemy', scope: 'single' },
    effects: [],
    completionEffects: [consumeSoulFire(), applyErosion(2, settings)],
    effectLayers: severLayers,
    effectPlans: severPlans,
    extraTags: [soulDamageTag, soulFireConsumerTag],
    selectionProfile: { intents: ['damage'] },
    detailRows: [
      `${coefficient(0.52)} × 法术攻击（魂伤）`,
      `施法前至少3层蚀魂时魂伤提高${percentage(settings.severHighLayerBonus)}`,
      '命中后增加2层蚀魂',
      soulFireDetail(settings),
    ],
  }));

  const reveal = definition('reveal-shadow');
  if (reveal.kind === 'passive') throw new Error('照影定义错误');
  builder.setAbility('reveal-shadow', factory.active({
    definition: reveal,
    pathId: settings.pathId,
    targetPolicy: { team: 'enemy', scope: 'single' },
    hitPolicy: 'guaranteed',
    effects: [applyBuff(shadowBuff(settings))],
    selectionProfile: { intents: ['buff'] },
    detailRows: [
      '本技能必然命中',
      `持续${settings.shadowDuration}回合`,
      '目标闪避属性按零计算，仍保留最低闪避',
      `每层蚀魂使其受到伤害提高${percentage(0.02 + settings.decreeShadowLayerBonus)}`,
    ],
  }));

  const forget = definition('forgetful-river-tide');
  if (forget.kind === 'passive') throw new Error('忘川潮定义错误');
  builder.setAbility('forgetful-river-tide', factory.active({
    definition: forget,
    pathId: settings.pathId,
    targetPolicy: { team: 'enemy', scope: 'single' },
    effects: [
      soulDamage(settings.forgetDirectCoefficient),
      applyErosion(1, settings),
      {
        ...applyBuff(forgetfulRiverBuff(settings)),
        conditions: [condition('hp_above', { scope: 'target', value: 0 })],
      },
    ],
    extraTags: [soulDamageTag],
    detailRows: [
      `${settings.forgetDirectCoefficient.toFixed(2)} × 法术攻击（魂伤）`,
      `忘川持续${settings.forgetDuration}回合，每次行动前造成${coefficient(settings.forgetDotCoefficient)} × 法术攻击（魂伤）`,
      `受治疗效果额外降低${Math.round(settings.forgetHealReduction * 100)}%`,
      ...(settings.forgetSpeedReduction < 0
        ? [`忘川期间速度降低${percentage(-settings.forgetSpeedReduction)}`]
        : []),
      ...(settings.forgetHighLayerBonus > 0
        ? [`至少3层蚀魂时持续魂伤提高${percentage(settings.forgetHighLayerBonus)}`]
        : []),
      ...(settings.forgetFourLayerBonus > 0
        ? [`至少4层蚀魂时持续魂伤额外提高${percentage(settings.forgetFourLayerBonus)}`]
        : []),
      ...(settings.crossingEcho
        ? ['每回合首次对至少4层目标结算忘川时，追加0.12 × 法术攻击魂伤']
        : []),
      '命中后增加1层蚀魂',
    ],
  }));

  const seize = definition('seize-soul');
  if (seize.kind === 'passive') throw new Error('夺魄定义错误');
  const seizeReduction: BuffConfig = {
    id: 'sect.youdu.seize-soul-attack-down',
    name: '夺魄',
    type: BuffType.DEBUFF,
    duration: settings.seizeDuration,
    stackRule: StackRule.REFRESH_DURATION,
    tags: debuffTags(),
    modifiers: [
      { attrType: AttributeType.ATK, type: ModifierType.ADD, value: -0.20 },
      { attrType: AttributeType.MAGIC_ATK, type: ModifierType.ADD, value: -0.20 },
    ],
  };
  builder.setAbility('seize-soul', factory.active({
    definition: seize,
    pathId: settings.pathId,
    targetPolicy: { team: 'enemy', scope: 'single' },
    effects: [
      magicalDamage(0.20 * settings.mixedDamageMultiplier),
      soulDamage(0.20 * settings.mixedDamageMultiplier),
      consumeSoulFire(),
      applyErosion(2, settings),
      {
        ...applyBuff(seizeReduction),
        conditions: [condition('hp_above', { scope: 'target', value: 0 })],
      },
    ],
    extraTags: [soulDamageTag, soulFireConsumerTag],
    detailRows: [
      `术伤与魂伤各${coefficient(0.20 * settings.mixedDamageMultiplier)} × 法术攻击`,
      '命中后增加2层蚀魂',
      `攻击降低20%，持续${settings.seizeDuration}回合`,
      soulFireDetail(settings),
    ],
  }));

  const pin = definition('pin-soul');
  if (pin.kind === 'passive') throw new Error('镇魂定义错误');
  const pinLow: EffectConfig = {
    ...applyBuff(pinBuff(1), 'target', { controlHitBonus: 0 }),
    conditions: [condition('hp_above', { scope: 'target', value: 0 })],
  };
  const pinHighEffects: EffectConfig[] = [
    {
      ...applyBuff(pinBuff(2), 'target', {
        controlHitBonus: settings.highLayerControlHitBonus,
      }),
      conditions: [condition('hp_above', { scope: 'target', value: 0 })],
    },
    ...(settings.pinHighLayerSlow
      ? [{
          ...applyBuff({
            id: 'sect.youdu.four-gates-slow',
            name: '四门皆闭',
            type: BuffType.DEBUFF,
            duration: 2,
            stackRule: StackRule.REFRESH_DURATION,
            tags: debuffTags(),
            modifiers: [{
              attrType: AttributeType.SPEED,
              type: ModifierType.ADD,
              value: -0.20,
            }],
          }),
          conditions: [condition('hp_above', { scope: 'target', value: 0 })],
        } satisfies EffectConfig]
      : []),
  ];
  builder.setAbility('pin-soul', factory.active({
    definition: pin,
    pathId: settings.pathId,
    mpCost: settings.pinMpCost,
    targetPolicy: { team: 'enemy', scope: 'single' },
    effects: [
      magicalDamage(0.20 * settings.mixedDamageMultiplier),
      soulDamage(0.20 * settings.mixedDamageMultiplier),
      consumeSoulFire(),
      applyErosion(2, settings),
    ],
    effectLayers: [
      {
        id: 'pin-low',
        displayName: '目标施法前少于4层蚀魂时',
        effects: [pinLow],
      },
      {
        id: 'pin-high',
        displayName: '目标施法前至少4层蚀魂时',
        effects: pinHighEffects,
      },
    ],
    effectPlans: [
      {
        id: 'pin-high', name: pin.baseName, priority: 20,
        conditions: [condition('buff_layer_at_least', {
          id: YOUDU_SOUL_EROSION, scope: 'target', value: 4,
        })],
        layerIds: ['pin-high'],
      },
      {
        id: 'pin-low', name: pin.baseName, priority: 10,
        conditions: [condition('buff_layer_below', {
          id: YOUDU_SOUL_EROSION, scope: 'target', value: 4,
        })],
        layerIds: ['pin-low'],
      },
    ],
    extraTags: [soulDamageTag, soulFireConsumerTag],
    selectionProfile: { intents: ['damage', 'control'] },
    detailRows: [
      `术伤与魂伤各${coefficient(0.20 * settings.mixedDamageMultiplier)} × 法术攻击`,
      '命中后增加2层蚀魂',
      `封印1回合；施法前至少4层时延长至2回合${settings.highLayerControlHitBonus > 0 ? `，本次控制命中提高${percentage(settings.highLayerControlHitBonus)}` : ''}`,
      '镇魂钉期间无法施展主动技能，且受到的气血治疗降低100%',
      ...(settings.pinHighLayerSlow
        ? ['施法前至少4层时，目标速度降低20%，持续2回合']
        : []),
      soulFireDetail(settings),
    ],
  }));

  const finish = definition('soul-shall-not-return');
  if (finish.kind === 'passive') throw new Error('魂兮不归定义错误');
  const finishCompletion: EffectConfig[] = [
    {
      type: 'buff_layer_modify',
      params: {
        match: { id: YOUDU_SOUL_EROSION },
        operation: settings.finishRetainedLayers > 0 ? 'set' : 'clear',
        layers: settings.finishRetainedLayers || undefined,
      },
    },
    {
      ...applyBuff(noReturnBuff(settings)),
      conditions: [condition('hp_above', { scope: 'target', value: 0 })],
    },
    ...(settings.finishAddsForget
      ? [{
          ...applyBuff(forgetfulRiverBuff(settings)),
          conditions: [condition('hp_above', { scope: 'target', value: 0 })],
        }]
      : []),
    consumeSoulFire(),
  ];
  if (settings.oneNameOneJudgment) {
    finishCompletion.push(
      {
        type: 'refund_paid_cost',
        conditions: [condition('has_tag', { scope: 'target', tag: judgmentTag })],
        params: { ratio: 0.25, resource: 'mp' },
      },
      {
        type: 'buff_layer_modify',
        conditions: [condition('has_tag', { scope: 'target', tag: judgmentTag })],
        params: {
          match: { id: 'sect.youdu.one-name-judgment' },
          operation: 'clear',
        },
      },
    );
  }
  if (settings.nameInYoudu) {
    const nameConditions = [
      condition('hp_below', { scope: 'target', value: 0.20 }),
      condition('has_not_tag', { scope: 'caster', tag: nameInYouduUsedTag }),
    ];
    finishCompletion.push(
      {
        ...gainSoulFire(3),
        conditions: nameConditions,
      },
      {
        type: 'cooldown_modify',
        conditions: nameConditions,
        params: {
          cdModifyValue: -2,
          tags: [youduAbilityTag('soul-shall-not-return')],
          includeCurrent: true,
          target: 'caster',
        },
      },
      {
        ...applyBuff(hiddenMarker(
          'sect.youdu.name-in-youdu-used',
          '名落幽都·已触发',
          nameInYouduUsedTag,
        ), 'caster'),
        conditions: nameConditions,
      },
    );
  }
  builder.setAbility('soul-shall-not-return', factory.active({
    definition: finish,
    pathId: settings.pathId,
    targetPolicy: { team: 'enemy', scope: 'single' },
    castConditions: [condition('buff_layer_at_least', {
      id: YOUDU_SOUL_EROSION, scope: 'target', value: 4,
    })],
    effects: [soulDamage(settings.finishBaseCoefficient, {
      buffLayerScalar: {
        match: { id: YOUDU_SOUL_EROSION },
        attribute: AttributeType.MAGIC_ATK,
        coefficientPerLayer: settings.finishPerLayerCoefficient,
        minLayers: 4,
        maxLayers: 5,
      },
    })],
    completionEffects: finishCompletion,
    extraTags: [soulDamageTag, soulFireConsumerTag],
    detailRows: [
      `(${settings.finishBaseCoefficient.toFixed(2)} + ${settings.finishPerLayerCoefficient.toFixed(2)} × 蚀魂层数) × 法术攻击（魂伤）`,
      '施放条件：目标至少4层蚀魂',
      settings.finishRetainedLayers > 0 ? '结算后保留2层蚀魂' : '伤害后清除全部蚀魂',
      '施加不归2回合',
      `不归期间受到的气血治疗降低80%，速度降低${percentage(-settings.noReturnSpeedReduction)}`,
      ...(settings.finishAddsForget
        ? [`结算后施加忘川，持续${settings.forgetDuration}回合`]
        : []),
      ...(settings.oneNameOneJudgment
        ? ['目标每场首次进入4层时获得标记；下一次终结命中后返还20点已支付法力并消耗标记']
        : []),
      ...(settings.nameInYoudu
        ? ['结算后若目标气血低于20%，获得3点魂火并减少2回合冷却，每场一次']
        : []),
      soulFireDetail(settings),
    ],
  }));
}

export function compileYouduBuild(
  _context: SectProjectionContext,
  builder: SectBuildBuilder,
  settings: YouduBuildSettings,
): void {
  builder.setResource({
    id: YOUDU_SOUL_FIRE,
    name: '魂火',
    icon: '◈',
    initial: 0,
    max: 3,
  });
  compileAbilities(builder, settings);
  compileRuntime(builder, settings);
}

export function compileYouduBase(
  context: SectProjectionContext,
  builder: SectBuildBuilder,
): void {
  compileYouduBuild(context, builder, createYouduBuildSettings());
}
