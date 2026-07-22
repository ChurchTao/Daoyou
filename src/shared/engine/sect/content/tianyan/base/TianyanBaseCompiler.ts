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
import { TIANYAN_BASE_DEFINITION } from '../definition';
import {
  TIANYAN_BURN,
  TIANYAN_CHAIN_CONTROL,
  TIANYAN_DERIVATION,
  TIANYAN_DISPEL_TRUTH_COOLDOWN,
  TIANYAN_ELEMENT_SEAL,
  TIANYAN_FIRST_CHANGE,
  TIANYAN_HETU_PATH_ID,
  TIANYAN_HIDDEN_EDGE,
  TIANYAN_HIDDEN_FIRE,
  TIANYAN_INNER_ART,
  TIANYAN_INNER_NOURISH,
  TIANYAN_LANDING_ABILITY_IDS,
  TIANYAN_LAVA,
  TIANYAN_LUOSHU_PATH_ID,
  TIANYAN_MAIN_DAMAGE_MEMORY,
  TIANYAN_REVERSE_SHIFT,
  TIANYAN_SECRET_ART,
  TIANYAN_SECT_ID,
  TIANYAN_SHATTER_COOLDOWN,
  TIANYAN_TECHNIQUE,
  type TianyanLandingAbilityId,
} from '../ids';
import {
  createTianyanBuildSettings,
  type TianyanBuildSettings,
} from '../shared/buildFacades';
import {
  TIANYAN_ELEMENTS,
  TIANYAN_ELEMENT_ABILITY_TAGS,
  TIANYAN_ELEMENT_NAMES,
  getTianyanReaction,
  nextGeneratingElement,
  type TianyanElement,
  type TianyanReactionDefinition,
} from '../shared/reactions';
import {
  applySealEffect,
  clearSealEffect,
  hasNoSealConditions,
  hasSealCondition,
  sealConsumeLog,
  sealTransitionLog,
} from '../shared/seals';

const landingTag = GameplayTags.ABILITY.SECT.mechanic(
  TIANYAN_SECT_ID,
  TIANYAN_TECHNIQUE,
);
const innerArtTag = GameplayTags.ABILITY.SECT.mechanic(
  TIANYAN_SECT_ID,
  TIANYAN_INNER_ART,
);
const secretArtTag = GameplayTags.ABILITY.SECT.mechanic(
  TIANYAN_SECT_ID,
  TIANYAN_SECRET_ART,
);
const mismatchImmunityTag =
  GameplayTags.ABILITY.MECHANIC.IGNORE_SPIRITUAL_ROOT_MISMATCH;
const hiddenFireState = GameplayTags.STATUS.SECT.state(
  TIANYAN_SECT_ID,
  'HiddenFire',
);
const hiddenEdgeState = GameplayTags.STATUS.SECT.state(
  TIANYAN_SECT_ID,
  'HiddenEdge',
);
const firstChangeState = GameplayTags.STATUS.SECT.state(
  TIANYAN_SECT_ID,
  'FirstChangeUsed',
);
const reverseShiftState = GameplayTags.STATUS.SECT.state(
  TIANYAN_SECT_ID,
  'ReverseShift',
);
const shatterCooldownState = GameplayTags.STATUS.SECT.state(
  TIANYAN_SECT_ID,
  'ShatterCooldown',
);
const saveErrorCounter = 'sect.tianyan.save-error-used';
const dispelTruthCooldownState = GameplayTags.STATUS.SECT.state(
  TIANYAN_SECT_ID,
  'DispelTruthCooldown',
);

const sectAbilityTag = (abilityId: string) =>
  GameplayTags.ABILITY.SECT.ability(TIANYAN_SECT_ID, abilityId);

const definition = (id: string) => {
  const result = TIANYAN_BASE_DEFINITION.abilities.find((entry) => entry.id === id);
  if (!result) throw new Error(`天衍神通定义缺失: ${id}`);
  return result;
};

const condition = (
  type: ConditionConfig['type'],
  params: ConditionConfig['params'],
): ConditionConfig => ({ type, params });

function buff(
  id: string,
  name: string,
  type: BuffType,
  duration: number,
  options: Partial<BuffConfig> = {},
): BuffConfig {
  const typeTag =
    type === BuffType.BUFF
      ? GameplayTags.BUFF.TYPE.BUFF
      : type === BuffType.DEBUFF
        ? GameplayTags.BUFF.TYPE.DEBUFF
        : GameplayTags.BUFF.TYPE.CONTROL;
  return {
    id,
    name,
    type,
    duration,
    stackRule: StackRule.REFRESH_DURATION,
    tags: [typeTag, GameplayTags.BUFF.SECT.namespace(TIANYAN_SECT_ID, id)],
    ...options,
  };
}

const selfBuff = (buffConfig: BuffConfig, conditions?: ConditionConfig[]): EffectConfig => ({
  type: 'apply_buff',
  conditions,
  params: { target: 'caster', buffConfig },
});

const targetBuff = (
  buffConfig: BuffConfig,
  conditions?: ConditionConfig[],
  onResistEffects?: EffectConfig[],
): EffectConfig => ({
  type: 'apply_buff',
  conditions: [
    condition('hp_above', { scope: 'target', value: 0 }),
    ...(conditions ?? []),
  ],
  params: { target: 'target', buffConfig, onResistEffects },
});

const healHp = (
  ratio: number,
  conditions?: ConditionConfig[],
  multiplier = 1,
): EffectConfig => ({
  type: 'heal',
  conditions,
  params: {
    value: { targetMaxHpRatio: ratio * multiplier },
    recipient: 'caster',
    target: 'hp',
  },
});

const healMp = (ratio: number, conditions?: ConditionConfig[]): EffectConfig => ({
  type: 'heal',
  conditions,
  params: { value: { targetMaxMpRatio: ratio }, recipient: 'caster', target: 'mp' },
});

const shieldMagic = (
  coefficient: number,
  conditions?: ConditionConfig[],
  multiplier = 1,
): EffectConfig => ({
  type: 'shield',
  conditions,
  params: {
    value: { attribute: AttributeType.MAGIC_ATK, coefficient: coefficient * multiplier },
    target: 'caster',
  },
});

const shieldHp = (
  ratio: number,
  conditions?: ConditionConfig[],
  multiplier = 1,
): EffectConfig => ({
  type: 'shield',
  conditions,
  params: { value: { targetMaxHpRatio: ratio * multiplier }, target: 'caster' },
});

const gainDerivation = (amount = 1): EffectConfig => ({
  type: 'combat_resource_modify',
  params: {
    resourceId: TIANYAN_DERIVATION,
    operation: 'add',
    amount,
    target: 'caster',
    reason: 'gain',
  },
});

const resourceAtLeastThree = condition('combat_resource_at_least', {
  scope: 'caster',
  resourceId: TIANYAN_DERIVATION,
  value: 3,
});
const resourceBelowThree = condition('combat_resource_below', {
  scope: 'caster',
  resourceId: TIANYAN_DERIVATION,
  value: 3,
});

function periodicDamageBuff(
  id: string,
  name: string,
  coefficient: number,
  element: TianyanElement,
): BuffConfig {
  const periodic: EffectConfig = {
    type: 'damage',
    params: {
      value: { attribute: AttributeType.MAGIC_ATK, coefficient },
      damageType: DamageType.DOT,
      damageSource: DamageSource.DELAYED,
    },
  };
  return buff(id, name, BuffType.DEBUFF, 2, {
    description: `${name}每次行动前造成持续法术伤害。`,
    tags: [
      GameplayTags.BUFF.TYPE.DEBUFF,
      GameplayTags.BUFF.DOT.ROOT,
      TIANYAN_ELEMENT_ABILITY_TAGS[element],
      ...(id === TIANYAN_BURN ? [GameplayTags.BUFF.DOT.BURN] : []),
      GameplayTags.BUFF.SECT.namespace(TIANYAN_SECT_ID, id),
      mismatchImmunityTag,
    ],
    statusTags: element === 'fire' && id === TIANYAN_BURN
      ? [GameplayTags.STATUS.STATE.BURNED]
      : undefined,
    listeners: [
      {
        id: `${id}.periodic`,
        eventType: GameplayTags.EVENT.ACTION_PRE,
        scope: GameplayTags.SCOPE.OWNER_AS_CASTER,
        priority: EventPriorityLevel.ACTION_TRIGGER,
        mapping: { caster: 'owner', target: 'owner' },
        effects: [periodic],
      },
    ],
    manualSettlementEffects: [periodic],
  });
}

function slowBuff(id: string, value: number, duration: number): BuffConfig {
  return buff(id, '迟滞', BuffType.DEBUFF, duration, {
    modifiers: [
      { attrType: AttributeType.SPEED, type: ModifierType.ADD, value: -value },
    ],
  });
}

function magicAttackDownBuff(id: string, value: number, duration: number): BuffConfig {
  return buff(id, '法攻削弱', BuffType.DEBUFF, duration, {
    modifiers: [
      { attrType: AttributeType.MAGIC_ATK, type: ModifierType.ADD, value: -value },
    ],
  });
}

function incomingDamageGuard(id: string, reduction: number): BuffConfig {
  return buff(id, '地载', BuffType.BUFF, 2, {
    listeners: [
      {
        id: `${id}.direct-reduction`,
        eventType: GameplayTags.EVENT.DAMAGE_REQUEST,
        scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
        priority: EventPriorityLevel.DAMAGE_REQUEST,
        mapping: { caster: 'event.caster', target: 'owner' },
        conditions: [
          condition('damage_source_is', { damageSource: DamageSource.DIRECT }),
        ],
        effects: [
          {
            type: 'percent_damage_modifier',
            params: {
              mode: 'reduce',
              value: reduction,
              allowedDamageSources: [DamageSource.DIRECT],
            },
          },
        ],
      },
    ],
  });
}

function oneUseDamageBuff(
  id: string,
  name: string,
  stateTag: string,
  value: number,
): BuffConfig {
  return buff(id, name, BuffType.BUFF, -1, {
    dispelPolicy: 'protected',
    countsAsStatus: false,
    statusTags: [stateTag],
    listeners: [
      {
        id: `${id}.damage`,
        eventType: GameplayTags.EVENT.DAMAGE_REQUEST,
        scope: GameplayTags.SCOPE.OWNER_AS_CASTER,
        priority: EventPriorityLevel.DAMAGE_REQUEST + 10,
        mapping: { caster: 'owner', target: 'event.target' },
        conditions: [
          condition('ability_has_tag', { tag: landingTag }),
          condition('damage_source_is', { damageSource: DamageSource.DIRECT }),
        ],
        budget: { maxTriggers: 1, reset: 'buff_lifetime' },
        effects: [
          {
            type: 'percent_damage_modifier',
            params: { mode: 'increase', value, allowedDamageSources: [DamageSource.DIRECT] },
          },
          {
            type: 'buff_layer_modify',
            params: {
              match: { id },
              operation: 'clear',
              target: 'caster',
              logVisibility: 'debug',
            },
          },
        ],
      },
    ],
  });
}

function nextReactionDamageBuff(
  id: string,
  name: string,
  stateTag: string,
  value: number,
): BuffConfig {
  const listeners: ListenerConfig[] = [];
  for (const incoming of TIANYAN_ELEMENTS) {
    for (const oldSeal of TIANYAN_ELEMENTS) {
      const relation = getTianyanReaction(oldSeal, incoming);
      if (relation.kind !== 'generation' && relation.kind !== 'overcoming') continue;
      listeners.push({
        id: `${id}.${oldSeal}-to-${incoming}`,
        eventType: GameplayTags.EVENT.DAMAGE_REQUEST,
        scope: GameplayTags.SCOPE.OWNER_AS_CASTER,
        priority: EventPriorityLevel.DAMAGE_REQUEST + 10,
        mapping: { caster: 'owner', target: 'event.target' },
        conditions: [
          condition('ability_has_tag', {
            tag: TIANYAN_ELEMENT_ABILITY_TAGS[incoming],
          }),
          condition('damage_source_is', { damageSource: DamageSource.DIRECT }),
          hasSealCondition(oldSeal),
        ],
        budget: { maxTriggers: 1, reset: 'buff_lifetime' },
        effects: [
          {
            type: 'percent_damage_modifier',
            params: {
              mode: 'increase',
              value,
              allowedDamageSources: [DamageSource.DIRECT],
            },
          },
          {
            type: 'buff_layer_modify',
            params: {
              match: { id },
              operation: 'clear',
              target: 'caster',
              logVisibility: 'debug',
            },
          },
        ],
      });
    }
  }
  return buff(id, name, BuffType.BUFF, 2, {
    dispelPolicy: 'protected',
    countsAsStatus: false,
    statusTags: [stateTag],
    listeners,
  });
}

function directDamage(
  coefficient: number,
  element: TianyanElement,
  bypassDefenseRatio: number,
  settings: TianyanBuildSettings,
  context: SectProjectionContext,
  options: {
    dynamicMissingHpCap?: number;
    allowHiddenEdge?: boolean;
  } = {},
): EffectConfig[] {
  const value = {
    attribute: AttributeType.MAGIC_ATK,
    coefficient: coefficient * settings.loadoutMultiplier,
  };
  const common = {
    value,
    damageType: DamageType.MAGICAL,
    damageSource: DamageSource.DIRECT,
    dynamicScalars: options.dynamicMissingHpCap
      ? [
          {
            source: 'target_missing_hp_ratio' as const,
            attribute: AttributeType.MAGIC_ATK,
            coefficientCap: options.dynamicMissingHpCap,
            minMissingHpRatio: 0.65,
            timing: 'cast' as const,
          },
        ]
      : undefined,
  };
  const allowHiddenEdge = options.allowHiddenEdge ?? true;
  const withoutEdge = condition('has_not_tag', {
    scope: 'caster', tag: hiddenEdgeState,
  });
  const withEdge = condition('has_tag_on', {
    scope: 'caster', tag: hiddenEdgeState,
  });
  if (!allowHiddenEdge) {
    return [
      {
        type: 'damage',
        params: { ...common, bypassDefenseRatio },
      },
    ];
  }
  return [
    {
      type: 'damage',
      conditions: [withoutEdge],
      params: { ...common, bypassDefenseRatio },
    },
    {
      type: 'damage',
      conditions: [withEdge],
      params: {
        ...common,
        bypassDefenseRatio: Math.max(
          bypassDefenseRatio,
          0.25 * settings.repositoryMultiplier,
        ),
      },
    },
    {
      type: 'buff_layer_modify',
      conditions: [withEdge],
      params: {
        match: { id: TIANYAN_HIDDEN_EDGE },
        operation: 'clear',
        target: 'caster',
        logVisibility: 'debug',
      },
    },
  ];
}

interface LandingSpec {
  id: TianyanLandingAbilityId;
  element: TianyanElement;
  coefficient: number;
  baseEffects: (
    reaction: TianyanReactionDefinition | undefined,
    settings: TianyanBuildSettings,
    context: SectProjectionContext,
  ) => EffectConfig[];
}

function reactionLog(reaction: TianyanReactionDefinition): EffectConfig {
  return {
    type: 'mechanic_log',
    params: {
      mechanic: 'named_trigger',
      internalKey: `sect.tianyan.reaction.${reaction.id}`,
      displayName: reaction.name ?? '五行反应',
      target: 'target',
      triggerBasis: {
        left: {
          id: `sect.tianyan.seal.${reaction.oldSeal}`,
          displayName: `${TIANYAN_ELEMENT_NAMES[reaction.oldSeal]}印`,
        },
        relation: {
          id: `sect.tianyan.relation.${reaction.kind}`,
          displayName: reaction.kind === 'generation' ? '化生' : '冲克',
        },
        right: {
          id: `sect.tianyan.element.${reaction.incoming}`,
          displayName: `${TIANYAN_ELEMENT_NAMES[reaction.incoming]}术`,
        },
      },
    },
  };
}

function followUp(
  reaction: TianyanReactionDefinition,
  ratio: number,
  element?: TianyanElement,
): EffectConfig {
  return {
    type: 'damage_memory',
    conditions: [condition('hp_above', { scope: 'target', value: 0 })],
    params: {
      key: TIANYAN_MAIN_DAMAGE_MEMORY,
      mode: 'release',
      ratio,
      releaseAs: 'resolved_follow_up',
      damageType: DamageType.MAGICAL,
      damageTags: element ? [TIANYAN_ELEMENT_ABILITY_TAGS[element]] : undefined,
      cause: {
        kind: 'mechanic',
        id: `sect.tianyan.reaction.${reaction.id}`,
        displayName: `冲克·${reaction.name}`,
      },
      target: 'caster',
      consume: false,
    },
  };
}

function reactionValueConditions(
  settings: TianyanBuildSettings,
): { normal?: ConditionConfig[]; empowered?: ConditionConfig[] } {
  if (settings.pathId !== TIANYAN_LUOSHU_PATH_ID) return {};
  return {
    normal: [resourceBelowThree],
    empowered: [resourceAtLeastThree],
  };
}

function reactionEffects(
  reaction: TianyanReactionDefinition,
  settings: TianyanBuildSettings,
): EffectConfig[] {
  const valueBonus = 1 + settings.hetuReactionValueBonus;
  if (reaction.kind === 'generation') {
    switch (reaction.id) {
      case 'wildfire':
        return [
          {
            type: 'buff_periodic_settlement',
            conditions: [condition('hp_above', { scope: 'target', value: 0 })],
            params: {
              match: { id: TIANYAN_BURN },
              mode: 'once_keep_duration',
              target: 'target',
              source: 'caster',
              cause: {
                kind: 'mechanic',
                id: 'sect.tianyan.reaction.wildfire',
                displayName: '燎原',
              },
            },
          },
        ];
      case 'lava':
        return [
          targetBuff(
            periodicDamageBuff(
              TIANYAN_LAVA,
              '熔岩',
              settings.lavaDotCoefficient * valueBonus,
              'fire',
            ),
          ),
        ];
      case 'forge-edge':
      case 'cold-spring':
        return [];
      case 'flourish':
        return [healHp(0.15 * valueBonus, undefined, settings.loadoutMultiplier)];
      default:
        return [];
    }
  }

  const conditions = reactionValueConditions(settings);
  const enhancedDebuff = (base: number) =>
    base * (1 + settings.luoshuDebuffBonus) * valueBonus;
  switch (reaction.id) {
    case 'vaporize':
      return [
        followUp(reaction, settings.vaporizeRatio),
        {
          type: 'buff_periodic_settlement',
          conditions: [condition('hp_above', { scope: 'target', value: 0 })],
          params: {
            match: { id: TIANYAN_BURN },
            mode: 'remaining_remove',
            target: 'target',
            source: 'caster',
            cause: {
              kind: 'mechanic',
              id: 'sect.tianyan.reaction.vaporize',
              displayName: '蒸发',
            },
          },
        },
      ];
    case 'quagmire': {
      const resist = targetBuff(
        slowBuff(
          'sect.tianyan.quagmire-resist-slow',
          settings.quagmireResistSlow,
          1,
        ),
      );
      return [
        followUp(reaction, settings.quagmireRatio, 'earth'),
        targetBuff(
          buff('sect.tianyan.rooted', '定身', BuffType.CONTROL, 1, {
            tags: [GameplayTags.BUFF.TYPE.CONTROL],
            statusTags: [GameplayTags.STATUS.CONTROL.NO_ACTION],
          }),
          undefined,
          [resist],
        ),
      ];
    }
    case 'root-collapse': {
      const basic = buff('sect.tianyan.root-collapse', '崩根', BuffType.DEBUFF, 2, {
        modifiers: [
          {
            attrType: AttributeType.MAGIC_DEF,
            type: ModifierType.ADD,
            value: -settings.rootCollapseMagicDefReduction * valueBonus,
          },
        ],
      });
      const empowered = buff(
        'sect.tianyan.root-collapse',
        '崩根',
        BuffType.DEBUFF,
        2,
        {
          modifiers: [
            {
              attrType: AttributeType.MAGIC_DEF,
              type: ModifierType.ADD,
              value: -enhancedDebuff(settings.rootCollapseMagicDefReduction),
            },
          ],
        },
      );
      return [
        followUp(reaction, reaction.followUpRatio ?? 0.5, 'wood'),
        targetBuff(basic, conditions.normal),
        ...(conditions.empowered ? [targetBuff(empowered, conditions.empowered)] : []),
      ];
    }
    case 'sever-meridian': {
      const resist = targetBuff(
        magicAttackDownBuff(
          'sect.tianyan.sever-resist',
          settings.severResistMagicAttackReduction,
          1,
        ),
      );
      return [
        followUp(reaction, settings.severMeridianRatio, 'metal'),
        targetBuff(
          buff('sect.tianyan.no-skill', '禁法', BuffType.CONTROL, 1, {
            tags: [GameplayTags.BUFF.TYPE.CONTROL],
            statusTags: [GameplayTags.STATUS.CONTROL.NO_SKILL],
          }),
          undefined,
          [resist],
        ),
      ];
    }
    case 'melt-metal': {
      const make = (value: number) =>
        buff('sect.tianyan.melt-metal', '熔金', BuffType.DEBUFF, 2, {
          modifiers: [
            { attrType: AttributeType.ATK, type: ModifierType.ADD, value: -value },
            { attrType: AttributeType.MAGIC_ATK, type: ModifierType.ADD, value: -value },
          ],
        });
      return [
        followUp(reaction, reaction.followUpRatio ?? 0.5, 'fire'),
        targetBuff(
          make(settings.meltMetalAttackReduction * valueBonus),
          conditions.normal,
        ),
        ...(conditions.empowered
          ? [
              targetBuff(
                make(enhancedDebuff(settings.meltMetalAttackReduction)),
                conditions.empowered,
              ),
            ]
          : []),
      ];
    }
    default:
      return [];
  }
}

function baseLandingEffects(
  spec: LandingSpec,
  reaction: TianyanReactionDefinition | undefined,
  settings: TianyanBuildSettings,
  context: SectProjectionContext,
): EffectConfig[] {
  return spec.baseEffects(reaction, settings, context);
}

function mainDamageBonus(
  reaction: TianyanReactionDefinition | undefined,
  settings: TianyanBuildSettings,
): number {
  if (!reaction || reaction.kind !== 'generation') return 0;
  if (reaction.id === 'wildfire') return settings.wildfireBonus;
  return reaction.mainDamageBonus ?? 0;
}

function sealPlacement(
  incoming: TianyanElement,
  oldSeal: TianyanElement | undefined,
  reaction: TianyanReactionDefinition | undefined,
  settings: TianyanBuildSettings,
): EffectConfig[] {
  const operation = !oldSeal
    ? 'apply'
    : oldSeal === incoming
      ? 'refresh'
      : 'replace';
  const transition = sealTransitionLog(incoming, operation, oldSeal);
  const targetAlive = condition('hp_above', { scope: 'target', value: 0 });
  if (reaction && settings.pathId === TIANYAN_HETU_PATH_ID) {
    return [
      {
        ...applySealEffect(incoming, settings.sealDuration + settings.hetuSealExtension),
        conditions: [resourceAtLeastThree, targetAlive],
      },
      {
        ...applySealEffect(incoming, settings.sealDuration),
        conditions: [resourceBelowThree, targetAlive],
      },
      { ...transition, conditions: [targetAlive] },
    ];
  }
  if (reaction && settings.pathId === TIANYAN_LUOSHU_PATH_ID && settings.luoshuRetain) {
    return [
      {
        ...applySealEffect(incoming, Math.max(3, settings.sealDuration)),
        conditions: [resourceAtLeastThree, targetAlive],
      },
      {
        ...applySealEffect(incoming, settings.sealDuration),
        conditions: [resourceBelowThree, targetAlive],
      },
      { ...transition, conditions: [targetAlive] },
    ];
  }
  return [
    { ...applySealEffect(incoming, settings.sealDuration), conditions: [targetAlive] },
    { ...transition, conditions: [targetAlive] },
  ];
}

function trinaryEffects(settings: TianyanBuildSettings): EffectConfig[] {
  if (settings.pathId === TIANYAN_HETU_PATH_ID) {
    return [
      {
        type: 'mechanic_log',
        conditions: [resourceAtLeastThree],
        params: {
          mechanic: 'named_trigger',
          internalKey: 'sect.tianyan.hetu-cycle',
          displayName: '河图周天',
          target: 'caster',
        },
      },
      healHp(
        settings.hetuHpRatio,
        [resourceAtLeastThree],
        settings.loadoutMultiplier,
      ),
      healMp(settings.hetuMpRatio, [resourceAtLeastThree]),
      {
        type: 'combat_resource_modify',
        conditions: [resourceAtLeastThree],
        params: {
          resourceId: TIANYAN_DERIVATION,
          operation: 'consume_all',
          target: 'caster',
          reason: 'spend',
          effects: settings.hetuRetain ? [gainDerivation(1)] : undefined,
        },
      },
    ];
  }
  if (settings.pathId === TIANYAN_LUOSHU_PATH_ID) {
    return [
      {
        type: 'mechanic_log',
        conditions: [resourceAtLeastThree],
        params: {
          mechanic: 'named_trigger',
          internalKey: 'sect.tianyan.luoshu-break',
          displayName: '洛书断局',
          target: 'caster',
        },
      },
      {
        type: 'damage_memory',
        conditions: [resourceAtLeastThree],
        params: {
          key: TIANYAN_MAIN_DAMAGE_MEMORY,
          mode: 'release',
          ratio: settings.luoshuFollowUpRatio,
          releaseAs: 'resolved_follow_up',
          damageType: DamageType.MAGICAL,
          cause: {
            kind: 'mechanic',
            id: 'sect.tianyan.luoshu-break',
            displayName: '洛书断局',
          },
          target: 'caster',
          consume: false,
        },
      },
      {
        type: 'combat_resource_modify',
        conditions: [resourceAtLeastThree],
        params: {
          resourceId: TIANYAN_DERIVATION,
          operation: 'consume_all',
          target: 'caster',
          reason: 'spend',
          effects: settings.luoshuRetain ? [gainDerivation(1)] : undefined,
        },
      },
    ];
  }
  return [];
}

function commonReactionPrelude(
  reaction: TianyanReactionDefinition,
  settings: TianyanBuildSettings,
): EffectConfig[] {
  const effects: EffectConfig[] = [gainDerivation()];
  if (settings.innerOuter) {
    effects.push({
      type: 'buff_layer_modify',
      params: {
        match: { id: TIANYAN_INNER_NOURISH },
        operation: 'clear',
        target: 'caster',
        logVisibility: 'debug',
        effects: [gainDerivation()],
      },
    });
  }
  if (settings.threeTalents) {
    effects.push({
      type: 'element_history',
      params: {
        key: 'sect.tianyan.hetu.three-talents',
        threshold: 3,
        effects: [
          selfBuff(
            oneUseDamageBuff(
              'sect.tianyan.three-talents-damage',
              '三才合契',
              GameplayTags.STATUS.SECT.state(TIANYAN_SECT_ID, 'ThreeTalents'),
              0.20,
            ),
          ),
        ],
      },
    });
  }
  if (reaction.kind === 'generation' && settings.generationHealRatio > 0) {
    effects.push(
      healHp(
        settings.generationHealRatio,
        undefined,
        settings.loadoutMultiplier,
      ),
    );
  }
  if (reaction.kind === 'overcoming' && settings.overcomingShieldRatio > 0) {
    effects.push(
      shieldHp(
        settings.overcomingShieldRatio,
        undefined,
        settings.loadoutMultiplier,
      ),
    );
  }
  if (settings.reactionManaRefund > 0) {
    effects.push({
      type: 'refund_paid_cost',
      params: { ratio: settings.reactionManaRefund, resource: 'mp' },
    });
  }
  return effects;
}

function chainControlEffects(
  settings: TianyanBuildSettings,
  isReaction: boolean,
): EffectConfig[] {
  if (!settings.chainControl) return [];
  if (!isReaction) {
    return [
      {
        type: 'buff_layer_modify',
        params: {
          match: { id: TIANYAN_CHAIN_CONTROL },
          operation: 'clear',
          target: 'caster',
          logVisibility: 'debug',
        },
      },
    ];
  }
  return [
    selfBuff(
      buff(TIANYAN_CHAIN_CONTROL, '连环制化', BuffType.BUFF, -1, {
        stackRule: StackRule.STACK_LAYER,
        maxLayers: 3,
        dispelPolicy: 'protected',
        countsAsStatus: false,
        listeners: [
          {
            id: `${TIANYAN_CHAIN_CONTROL}.damage`,
            eventType: GameplayTags.EVENT.DAMAGE_REQUEST,
            scope: GameplayTags.SCOPE.OWNER_AS_CASTER,
            priority: EventPriorityLevel.DAMAGE_REQUEST + 5,
            mapping: { caster: 'owner', target: 'event.target' },
            conditions: [
              condition('ability_has_tag', { tag: landingTag }),
              condition('damage_source_is', { damageSource: DamageSource.DIRECT }),
            ],
            effects: [
              {
                type: 'percent_damage_modifier',
                params: {
                  mode: 'increase',
                  value: 0.08,
                  cap: 0.24,
                  scaleByBuffLayer: true,
                  allowedDamageSources: [DamageSource.DIRECT],
                },
              },
            ],
          },
        ],
      }),
    ),
  ];
}

function shatterEffects(settings: TianyanBuildSettings, incoming: TianyanElement): EffectConfig[] {
  if (!settings.shatterSeal) return [];
  const conditions = [
    condition('hp_above', { scope: 'target', value: 0 }),
    condition('hp_below', { scope: 'target', value: 0.40 }),
    condition('has_not_tag', { scope: 'caster', tag: shatterCooldownState }),
  ];
  return [
    { ...clearSealEffect(), conditions },
    { ...sealConsumeLog(incoming), conditions },
    {
      type: 'damage_memory',
      conditions,
      params: {
        key: TIANYAN_MAIN_DAMAGE_MEMORY,
        mode: 'release',
        ratio: 0.45,
        releaseAs: 'resolved_follow_up',
        damageType: DamageType.MAGICAL,
        cause: {
          kind: 'mechanic',
          id: 'sect.tianyan.shatter-seal',
          displayName: '碎印夺机',
        },
        target: 'caster',
        consume: false,
      },
    },
    selfBuff(
      buff(TIANYAN_SHATTER_COOLDOWN, '碎印夺机·息', BuffType.BUFF, 3, {
        dispelPolicy: 'protected',
        countsAsStatus: false,
        logVisibility: 'debug',
        statusTags: [shatterCooldownState],
      }),
      conditions,
    ),
  ];
}

function buildLandingBranch(
  spec: LandingSpec,
  oldSeal: TianyanElement | undefined,
  settings: TianyanBuildSettings,
  context: SectProjectionContext,
): EffectConfig[] {
  const reaction = oldSeal ? getTianyanReaction(oldSeal, spec.element) : undefined;
  const isReaction = reaction?.kind === 'generation' || reaction?.kind === 'overcoming';
  const generationBonus = mainDamageBonus(reaction, settings);
  const forgeBypass = reaction?.id === 'forge-edge' ? settings.forgeEdgeBypass : 0;
  const dynamicCap = settings.heavenEnds && reaction?.kind === 'overcoming' ? 0.60 : undefined;
  const effects: EffectConfig[] = [
    {
      type: 'damage_memory',
      params: { key: TIANYAN_MAIN_DAMAGE_MEMORY, mode: 'clear', target: 'caster' },
    },
  ];

  if (isReaction && reaction) {
    if (settings.dispelOnOvercoming && reaction.kind === 'overcoming') {
      const available = condition('has_not_tag', {
        scope: 'caster',
        tag: dispelTruthCooldownState,
      });
      effects.push(
        {
          type: 'dispel',
          conditions: [available],
          params: { maxCount: 1, status: 'positive' },
        },
        selfBuff(
          buff(
            TIANYAN_DISPEL_TRUTH_COOLDOWN,
            '斩护见真·息',
            BuffType.BUFF,
            3,
            {
              dispelPolicy: 'protected',
              countsAsStatus: false,
              logVisibility: 'debug',
              statusTags: [dispelTruthCooldownState],
            },
          ),
          [available],
        ),
      );
    }
    effects.push(...commonReactionPrelude(reaction, settings));
  }

  effects.push(
    ...directDamage(
      spec.coefficient * (1 + generationBonus),
      spec.element,
      forgeBypass,
      settings,
      context,
      { dynamicMissingHpCap: dynamicCap },
    ),
    ...baseLandingEffects(spec, reaction, settings, context),
  );

  if (isReaction && reaction) {
    effects.push({
      ...reactionLog(reaction),
      conditions: [condition('hp_above', { scope: 'target', value: 0 })],
    });
    effects.push(...reactionEffects(reaction, settings));
  }

  const firstChange = settings.firstChange && !oldSeal;
  const saveError =
    settings.saveError && oldSeal && reaction?.kind === 'none';
  if (firstChange) {
    const unused = condition('has_not_tag', {
      scope: 'caster', tag: firstChangeState,
    });
    const alreadyUsed = condition('has_tag_on', {
      scope: 'caster', tag: firstChangeState,
    });
    const targetAlive = condition('hp_above', { scope: 'target', value: 0 });
    effects.push(
      {
        ...applySealEffect(spec.element, settings.sealDuration),
        conditions: [alreadyUsed, targetAlive],
      },
      {
        ...sealTransitionLog(spec.element, 'apply'),
        conditions: [alreadyUsed, targetAlive],
      },
      {
        ...applySealEffect(spec.element, 3),
        conditions: [unused, targetAlive],
      },
      {
        ...sealTransitionLog(spec.element, 'apply'),
        conditions: [unused, targetAlive],
      },
      {
        type: 'refund_paid_cost',
        conditions: [unused],
        params: { ratio: 1, resource: 'mp' },
      },
      selfBuff(
        buff(TIANYAN_FIRST_CHANGE, '第一变', BuffType.BUFF, -1, {
          dispelPolicy: 'protected',
          countsAsStatus: false,
          logVisibility: 'debug',
          statusTags: [firstChangeState],
        }),
        [unused],
      ),
    );
  } else if (saveError) {
    const unused = condition('runtime_counter_compare', {
      scope: 'caster', key: saveErrorCounter, op: 'lt', value: 1,
    });
    const alreadyUsed = condition('runtime_counter_compare', {
      scope: 'caster', key: saveErrorCounter, op: 'gte', value: 1,
    });
    effects.push(
      ...sealPlacement(spec.element, oldSeal, reaction, settings).map((effect) => ({
        ...effect,
        conditions: [...(effect.conditions ?? []), alreadyUsed],
      })),
      {
        type: 'runtime_counter_modify',
        conditions: [unused],
        params: {
          key: saveErrorCounter,
          operation: 'set',
          amount: 1,
          target: 'caster',
        },
      },
    );
  } else {
    effects.push(...sealPlacement(spec.element, oldSeal, reaction, settings));
  }

  if (isReaction) {
    effects.push(...trinaryEffects(settings));
    effects.push(...shatterEffects(settings, spec.element));
  }
  effects.push(...chainControlEffects(settings, Boolean(isReaction)));
  effects.push({
    type: 'damage_memory',
    params: { key: TIANYAN_MAIN_DAMAGE_MEMORY, mode: 'clear', target: 'caster' },
  });
  return effects;
}

function compileLandingAbility(
  builder: SectBuildBuilder,
  factory: SectAbilityFactory,
  spec: LandingSpec,
  settings: TianyanBuildSettings,
  context: SectProjectionContext,
): void {
  const branchEntries = [undefined, ...TIANYAN_ELEMENTS] as const;
  const layers: AbilityEffectLayerConfig[] = branchEntries.map((oldSeal) => ({
    id: oldSeal ? `old-${oldSeal}` : 'no-seal',
    effects: buildLandingBranch(spec, oldSeal, settings, context),
  }));
  const plans: AbilityEffectPlanConfig[] = branchEntries.map((oldSeal, index) => ({
    id: oldSeal ? `old-${oldSeal}` : 'no-seal',
    name: definition(spec.id).baseName,
    priority: 200 - index,
    conditions: oldSeal ? [hasSealCondition(oldSeal)] : hasNoSealConditions(),
    layerIds: [oldSeal ? `old-${oldSeal}` : 'no-seal'],
  }));
  const abilityDefinition = definition(spec.id);
  if (abilityDefinition.kind === 'passive') {
    throw new Error(`落印术 ${spec.id} 不能是被动能力`);
  }
  builder.setAbility(
    spec.id,
    factory.active({
      definition: abilityDefinition,
      pathId: settings.pathId,
      targetPolicy: { team: 'enemy', scope: 'single' },
      effects: [],
      effectLayers: layers,
      effectPlans: plans,
      extraTags: [
        landingTag,
        TIANYAN_ELEMENT_ABILITY_TAGS[spec.element],
        mismatchImmunityTag,
      ],
      selectionProfile: { intents: ['damage'] },
      detailRows: [
        `落印术·${TIANYAN_ELEMENT_NAMES[spec.element]}`,
        `法印持续：${settings.sealDuration}回合`,
      ],
    }),
  );
}

function innerNourish(settings: TianyanBuildSettings): EffectConfig[] {
  if (!settings.innerOuter) return [];
  return [
    selfBuff(
      buff(TIANYAN_INNER_NOURISH, '内外相养', BuffType.BUFF, 2, {
        dispelPolicy: 'protected',
        countsAsStatus: false,
        logVisibility: 'debug',
      }),
    ),
  ];
}

function compileUtilityAbilities(
  builder: SectBuildBuilder,
  factory: SectAbilityFactory,
  settings: TianyanBuildSettings,
  context: SectProjectionContext,
): void {
  const primordial = definition('primordial-ray');
  if (primordial.kind === 'passive') throw new Error('太初玄光定义错误');
  builder.setAbility(
    'primordial-ray',
    factory.active({
      definition: primordial,
      targetPolicy: { team: 'enemy', scope: 'single' },
      effects: [
        ...directDamage(0.65, 'wood', 0, settings, context, {
          allowHiddenEdge: false,
        }),
      ],
      extraTags: [],
      selectionProfile: { intents: ['damage'] },
      notes: ['无属性法术，不施加、触发、消费或覆盖法印。'],
    }),
  );

  const renewal = definition('myriad-wood-renewal');
  if (renewal.kind === 'passive') throw new Error('万木回春定义错误');
  const renewalRatio = 0.12
    * settings.woodHealingMultiplier
    * settings.loadoutMultiplier;
  const renewalTick = 0.03
    * settings.woodHealingMultiplier
    * settings.loadoutMultiplier;
  const renewalBuff = buff('sect.tianyan.renewal', '回春', BuffType.BUFF, 2, {
    tags: [
      GameplayTags.BUFF.TYPE.BUFF,
      GameplayTags.BUFF.SECT.namespace(TIANYAN_SECT_ID, 'renewal'),
      TIANYAN_ELEMENT_ABILITY_TAGS.wood,
    ],
    listeners: [
      {
        id: 'sect.tianyan.renewal.tick',
        eventType: GameplayTags.EVENT.ACTION_PRE,
        scope: GameplayTags.SCOPE.OWNER_AS_CASTER,
        priority: EventPriorityLevel.ACTION_TRIGGER,
        mapping: { caster: 'owner', target: 'owner' },
        effects: [
          {
            type: 'heal',
            params: {
              value: { targetMaxHpRatio: renewalTick },
              recipient: 'target',
              target: 'hp',
            },
          },
        ],
      },
    ],
  });
  builder.setAbility(
    'myriad-wood-renewal',
    factory.active({
      definition: renewal,
      pathId: settings.pathId,
      targetPolicy: { team: 'ally', scope: 'single' },
      effects: [
        {
          type: 'heal',
          params: {
            value: { targetMaxHpRatio: renewalRatio },
            recipient: 'target',
            target: 'hp',
          },
        },
        targetBuff(renewalBuff),
        ...innerNourish(settings),
      ],
      extraTags: [innerArtTag, TIANYAN_ELEMENT_ABILITY_TAGS.wood],
      selectionProfile: { intents: ['heal_hp'] },
    }),
  );

  const lotus = definition('lotus-in-fire');
  if (lotus.kind === 'passive') throw new Error('火里种莲定义错误');
  builder.setAbility(
    'lotus-in-fire',
    factory.active({
      definition: lotus,
      pathId: settings.pathId,
      costs: [
        {
          resource: 'hp',
          mode: 'current_hp_ratio',
          ratio: settings.lotusHpRatio,
          minimum: 1,
          retain: 1,
        },
      ],
      targetPolicy: { team: 'self', scope: 'single' },
      effects: [
        {
          type: 'dispel',
          params: { recipient: 'caster', status: 'negative', maxCount: 2 },
        },
        selfBuff(
          buff('sect.tianyan.lotus', '种莲', BuffType.BUFF, 2, {
            modifiers: [
              { attrType: AttributeType.MAGIC_ATK, type: ModifierType.ADD, value: 0.20 },
            ],
          }),
        ),
        ...innerNourish(settings),
      ],
      extraTags: [innerArtTag, TIANYAN_ELEMENT_ABILITY_TAGS.fire],
      selectionProfile: { intents: ['buff'] },
    }),
  );

  const earth = definition('boundless-earth');
  if (earth.kind === 'passive') throw new Error('地载无疆定义错误');
  builder.setAbility(
    'boundless-earth',
    factory.active({
      definition: earth,
      pathId: settings.pathId,
      targetPolicy: { team: 'ally', scope: 'single' },
      effects: [
        {
          type: 'shield',
          params: {
            value: {
              targetMaxHpRatio: 0.12
                * settings.earthShieldMultiplier
                * settings.loadoutMultiplier,
            },
            target: 'target',
          },
        },
        targetBuff(incomingDamageGuard('sect.tianyan.earth-bearing', settings.earthReduction)),
        ...innerNourish(settings),
      ],
      extraTags: [innerArtTag, TIANYAN_ELEMENT_ABILITY_TAGS.earth],
      selectionProfile: { intents: ['defensive'] },
    }),
  );

  const river = definition('heavenly-river-cleansing');
  if (river.kind === 'passive') throw new Error('天河洗心定义错误');
  builder.setAbility(
    'heavenly-river-cleansing',
    factory.active({
      definition: river,
      pathId: settings.pathId,
      targetPolicy: { team: 'self', scope: 'single' },
      effects: [
        {
          type: 'dispel',
          params: {
            recipient: 'caster', status: 'negative', maxCount: settings.riverCleanseCount,
          },
        },
        healMp(settings.riverMpRatio),
        selfBuff(
          buff('sect.tianyan.river-mind', '天河洗心', BuffType.BUFF, 2, {
            modifiers: [
              {
                attrType: AttributeType.CONTROL_RESISTANCE,
                type: ModifierType.FIXED,
                value: settings.riverControlResistance,
              },
            ],
          }),
        ),
        ...innerNourish(settings),
      ],
      extraTags: [innerArtTag, TIANYAN_ELEMENT_ABILITY_TAGS.water],
      selectionProfile: { intents: ['restore_mp', 'buff'] },
    }),
  );
}

function compileSecrets(
  builder: SectBuildBuilder,
  factory: SectAbilityFactory,
  settings: TianyanBuildSettings,
): void {
  const sealRequired = [
    condition('buff_layer_at_least', {
      scope: 'target', id: TIANYAN_ELEMENT_SEAL, value: 1,
    }),
  ];
  const shift = definition('shift-palace');
  if (shift.kind === 'passive') throw new Error('移宫换宿定义错误');
  const shiftLayers: AbilityEffectLayerConfig[] = TIANYAN_ELEMENTS.map((oldSeal) => {
    const incoming = nextGeneratingElement(oldSeal, settings.shiftSteps);
    return {
      id: `shift-${oldSeal}`,
      effects: [
        applySealEffect(incoming, settings.sealDuration),
        sealTransitionLog(incoming, 'replace', oldSeal),
        ...(settings.shiftReactionBonus > 0
          ? [
              selfBuff(
                nextReactionDamageBuff(
                  TIANYAN_REVERSE_SHIFT,
                  '倒演两宫',
                  reverseShiftState,
                  settings.shiftReactionBonus,
                ),
              ),
            ]
          : []),
      ],
    };
  });
  builder.setAbility(
    'shift-palace',
    factory.active({
      definition: shift,
      pathId: settings.pathId,
      mpCost: settings.shiftCost,
      cooldown: settings.shiftCooldown,
      castConditions: sealRequired,
      targetPolicy: { team: 'enemy', scope: 'single' },
      effects: [],
      effectLayers: shiftLayers,
      effectPlans: TIANYAN_ELEMENTS.map((oldSeal, index) => ({
        id: `shift-${oldSeal}`,
        name: shift.baseName,
        priority: 100 - index,
        conditions: [hasSealCondition(oldSeal)],
        layerIds: [`shift-${oldSeal}`],
      })),
      extraTags: [secretArtTag],
      selectionProfile: { intents: ['buff'] },
    }),
  );

  const repository = definition('five-qi-repository');
  if (repository.kind === 'passive') throw new Error('五气归藏定义错误');
  const multiplier = settings.repositoryMultiplier;
  const repositoryEffects: Record<TianyanElement, EffectConfig[]> = {
    wood: [healHp(0.10 * multiplier, undefined, settings.loadoutMultiplier)],
    fire: [
      selfBuff(
        oneUseDamageBuff(
          TIANYAN_HIDDEN_FIRE,
          '藏火',
          hiddenFireState,
          0.25 * multiplier,
        ),
      ),
    ],
    earth: [
      shieldMagic(0.45 * multiplier, undefined, settings.loadoutMultiplier),
    ],
    metal: [
      selfBuff(
        buff(TIANYAN_HIDDEN_EDGE, '藏锋', BuffType.BUFF, -1, {
          dispelPolicy: 'protected',
          countsAsStatus: false,
          statusTags: [hiddenEdgeState],
        }),
      ),
    ],
    water: [healMp(0.15 * multiplier)],
  };
  const repositoryLayers: AbilityEffectLayerConfig[] = TIANYAN_ELEMENTS.map((oldSeal) => ({
    id: `repository-${oldSeal}`,
    effects: [
      clearSealEffect(),
      sealConsumeLog(oldSeal),
      ...repositoryEffects[oldSeal],
      ...(settings.repositoryGain > 0 ? [gainDerivation(settings.repositoryGain)] : []),
    ],
  }));
  builder.setAbility(
    'five-qi-repository',
    factory.active({
      definition: repository,
      pathId: settings.pathId,
      castConditions: sealRequired,
      targetPolicy: { team: 'enemy', scope: 'single' },
      effects: [],
      effectLayers: repositoryLayers,
      effectPlans: TIANYAN_ELEMENTS.map((oldSeal, index) => ({
        id: `repository-${oldSeal}`,
        name: repository.baseName,
        priority: 100 - index,
        conditions: [hasSealCondition(oldSeal)],
        layerIds: [`repository-${oldSeal}`],
      })),
      extraTags: [secretArtTag],
      selectionProfile: { intents: ['buff', 'heal_hp', 'restore_mp'] },
    }),
  );
}

function runtimeListeners(settings: TianyanBuildSettings): ListenerConfig[] {
  const listeners: ListenerConfig[] = [
    {
      id: 'sect.tianyan.record-main-damage',
      eventType: GameplayTags.EVENT.DAMAGE_TAKEN,
      scope: GameplayTags.SCOPE.OWNER_AS_CASTER,
      priority: EventPriorityLevel.DAMAGE_TAKEN,
      mapping: { caster: 'owner', target: 'event.target' },
      guard: { skipSecondaryDamageSource: true },
      budget: { maxTriggers: 1, reset: 'source_action' },
      conditions: [
        condition('ability_has_tag', { tag: landingTag }),
        condition('damage_source_is', { damageSource: DamageSource.DIRECT }),
      ],
      effects: [
        {
          type: 'damage_memory',
          params: {
            key: TIANYAN_MAIN_DAMAGE_MEMORY,
            mode: 'record',
            event: 'damage_dealt',
            includeShieldAbsorbed: true,
            target: 'caster',
          },
        },
      ],
    },
  ];
  if (settings.blankBreath) {
    listeners.push({
      id: 'sect.tianyan.blank-breath',
      eventType: GameplayTags.EVENT.DAMAGE_TAKEN,
      scope: GameplayTags.SCOPE.OWNER_AS_CASTER,
      priority: EventPriorityLevel.DAMAGE_TAKEN,
      mapping: { caster: 'owner', target: 'event.target' },
      budget: { maxTriggers: 1, reset: 'round' },
      guard: { skipSecondaryDamageSource: true },
      conditions: [
        condition('ability_has_tag', { tag: sectAbilityTag('primordial-ray') }),
        condition('damage_source_is', { damageSource: DamageSource.DIRECT }),
        condition('buff_layer_at_least', {
          scope: 'target', id: TIANYAN_ELEMENT_SEAL, value: 1,
        }),
      ],
      effects: [healMp(0.04)],
    });
  }
  if (settings.shiftGain > 0) {
    listeners.push({
      id: 'sect.tianyan.shift-carries',
      eventType: 'MechanicLogEvent',
      scope: GameplayTags.SCOPE.OWNER_AS_CASTER,
      priority: EventPriorityLevel.ACTION_TRIGGER,
      mapping: { caster: 'owner', target: 'event.target' },
      budget: { maxTriggers: 1, reset: 'round' },
      conditions: [
        condition('ability_has_tag', { tag: sectAbilityTag('shift-palace') }),
      ],
      effects: [gainDerivation(settings.shiftGain)],
    });
  }
  if (settings.saveError) {
    listeners.push({
      id: 'sect.tianyan.save-error-reset',
      eventType: GameplayTags.EVENT.ROUND_START,
      scope: GameplayTags.SCOPE.GLOBAL,
      priority: EventPriorityLevel.ROUND_PRE,
      mapping: { caster: 'owner', target: 'owner' },
      effects: [
        {
          type: 'runtime_counter_modify',
          params: {
            key: saveErrorCounter,
            operation: 'reset',
            target: 'caster',
          },
        },
      ],
    });
  }
  if (settings.woodFullHealthShield > 0) {
    listeners.push({
      id: 'sect.tianyan.verdant-endless-shield',
      eventType: 'HealEvent',
      scope: GameplayTags.SCOPE.OWNER_AS_CASTER,
      priority: EventPriorityLevel.ACTION_TRIGGER,
      mapping: { caster: 'owner', target: 'event.target' },
      budget: { maxTriggers: 1, reset: 'source_action' },
      conditions: [
        condition('source_has_tag', {
          tag: TIANYAN_ELEMENT_ABILITY_TAGS.wood,
        }),
        condition('hp_above', { scope: 'target', value: 0.999 }),
      ],
      effects: [
        shieldHp(
          settings.woodFullHealthShield,
          undefined,
          settings.loadoutMultiplier,
        ),
      ],
    });
  }
  if (settings.pathId === TIANYAN_HETU_PATH_ID) {
    listeners.push({
      id: 'sect.tianyan.hetu-cycle-damage',
      eventType: GameplayTags.EVENT.DAMAGE_REQUEST,
      scope: GameplayTags.SCOPE.OWNER_AS_CASTER,
      priority: EventPriorityLevel.DAMAGE_REQUEST + 2,
      mapping: { caster: 'owner', target: 'event.target' },
      conditions: [
        condition('ability_has_tag', { tag: landingTag }),
        condition('damage_source_is', { damageSource: DamageSource.DIRECT }),
        resourceAtLeastThree,
      ],
      effects: [
        {
          type: 'percent_damage_modifier',
          params: {
            mode: 'increase',
            value: settings.hetuMainBonus,
            allowedDamageSources: [DamageSource.DIRECT],
          },
        },
      ],
    });
  }
  if (settings.observeSealDamageBonus > 0) {
    listeners.push({
      id: 'sect.tianyan.observe-seal-gap',
      eventType: GameplayTags.EVENT.DAMAGE_REQUEST,
      scope: GameplayTags.SCOPE.OWNER_AS_CASTER,
      priority: EventPriorityLevel.DAMAGE_REQUEST + 1,
      mapping: { caster: 'owner', target: 'event.target' },
      conditions: [
        condition('ability_has_tag', {
          tag: GameplayTags.ABILITY.SECT.namespace(TIANYAN_SECT_ID),
        }),
        condition('damage_source_is', { damageSource: DamageSource.DIRECT }),
        condition('buff_layer_at_least', {
          scope: 'target', id: TIANYAN_ELEMENT_SEAL, value: 1,
        }),
      ],
      effects: [
        {
          type: 'percent_damage_modifier',
          params: {
            mode: 'increase', value: settings.observeSealDamageBonus,
            allowedDamageSources: [DamageSource.DIRECT],
          },
        },
      ],
    });
  }
  if (settings.exploitWeaknessBonus > 0) {
    listeners.push({
      id: 'sect.tianyan.exploit-weakness',
      eventType: GameplayTags.EVENT.DAMAGE_REQUEST,
      scope: GameplayTags.SCOPE.OWNER_AS_CASTER,
      priority: EventPriorityLevel.DAMAGE_REQUEST + 1,
      mapping: { caster: 'owner', target: 'event.target' },
      conditions: [
        condition('ability_has_tag', {
          tag: GameplayTags.ABILITY.SECT.namespace(TIANYAN_SECT_ID),
        }),
        condition('damage_source_is', { damageSource: DamageSource.DIRECT }),
        condition('debuff_count_at_least', { scope: 'target', value: 1 }),
      ],
      effects: [
        {
          type: 'percent_damage_modifier',
          params: {
            mode: 'increase', value: settings.exploitWeaknessBonus,
            allowedDamageSources: [DamageSource.DIRECT],
          },
        },
      ],
    });
  }
  return listeners;
}

function compileRuntimePassives(
  builder: SectBuildBuilder,
  factory: SectAbilityFactory,
  settings: TianyanBuildSettings,
): void {
  const runtime = definition('tianyan-runtime');
  if (runtime.kind !== 'passive') throw new Error('太初衍脉定义错误');
  builder.setAbility(
    'tianyan-runtime',
    factory.passive({
      definition: runtime,
      listeners: runtimeListeners(settings),
      extraTags: [GameplayTags.ABILITY.SECT.mechanic(TIANYAN_SECT_ID, 'runtime')],
    }),
  );
  if (settings.pathId === TIANYAN_HETU_PATH_ID) {
    const hetu = definition('hetu-runtime');
    if (hetu.kind !== 'passive') throw new Error('河图周天定义错误');
    builder.setAbility(
      'hetu-runtime',
      factory.passive({
        definition: hetu,
        pathId: TIANYAN_HETU_PATH_ID,
        extraTags: [GameplayTags.ABILITY.SECT.mechanic(TIANYAN_SECT_ID, 'hetu-cycle')],
      }),
    );
  }
  if (settings.pathId === TIANYAN_LUOSHU_PATH_ID) {
    const luoshu = definition('luoshu-runtime');
    if (luoshu.kind !== 'passive') throw new Error('洛书断局定义错误');
    builder.setAbility(
      'luoshu-runtime',
      factory.passive({
        definition: luoshu,
        pathId: TIANYAN_LUOSHU_PATH_ID,
        modifiers: settings.controlHitBonus > 0
          ? [
              {
                attrType: AttributeType.CONTROL_HIT,
                type: ModifierType.FIXED,
                value: settings.controlHitBonus,
              },
            ]
          : undefined,
        extraTags: [GameplayTags.ABILITY.SECT.mechanic(TIANYAN_SECT_ID, 'luoshu-break')],
      }),
    );
  }
}

const LANDING_SPECS: LandingSpec[] = [
  {
    id: 'verdant-pulse',
    element: 'wood',
    coefficient: 0.68,
    baseEffects: (_reaction, settings) => [
      healHp(
        0.03 * settings.woodHealingMultiplier,
        undefined,
        settings.loadoutMultiplier,
      ),
    ],
  },
  {
    id: 'flowing-flame',
    element: 'fire',
    coefficient: 0.82,
    baseEffects: () => [
      targetBuff(periodicDamageBuff(TIANYAN_BURN, '灼烧', 0.16, 'fire')),
    ],
  },
  {
    id: 'earth-bearing-seal',
    element: 'earth',
    coefficient: 0.62,
    baseEffects: (_reaction, settings) => [
      shieldMagic(0.32, undefined, settings.loadoutMultiplier),
    ],
  },
  {
    id: 'metal-cloud-cutter',
    element: 'metal',
    coefficient: 0.88,
    baseEffects: () => [
      targetBuff(
        buff('sect.tianyan.metal-cut', '破锋', BuffType.DEBUFF, 2, {
          modifiers: [
            { attrType: AttributeType.MAGIC_DEF, type: ModifierType.ADD, value: -0.15 },
          ],
        }),
      ),
    ].map((effect) => ({
      ...effect,
      params: { ...effect.params, chance: 0.40 },
    })) as EffectConfig[],
  },
  {
    id: 'white-star-breaker',
    element: 'metal',
    coefficient: 0.50,
    baseEffects: () => [
      { type: 'dispel', params: { maxCount: 1, status: 'positive' } },
    ],
  },
  {
    id: 'dark-water-return',
    element: 'water',
    coefficient: 0.72,
    baseEffects: (reaction, settings) => {
      if (reaction?.id !== 'cold-spring') {
        return [
          targetBuff(slowBuff('sect.tianyan.water-slow', 0.15, 2)),
        ];
      }
      const base = settings.coldSpringSlow * (1 + settings.hetuReactionValueBonus);
      if (settings.pathId !== TIANYAN_LUOSHU_PATH_ID) {
        return [targetBuff(slowBuff('sect.tianyan.water-slow', base, 2))];
      }
      return [
        targetBuff(
          slowBuff('sect.tianyan.water-slow', base, 2),
          [resourceBelowThree],
        ),
        targetBuff(
          slowBuff(
            'sect.tianyan.water-slow',
            base * (1 + settings.luoshuDebuffBonus),
            2,
          ),
          [resourceAtLeastThree],
        ),
      ];
    },
  },
];

export function compileTianyanBuild(
  context: SectProjectionContext,
  builder: SectBuildBuilder,
  settings: TianyanBuildSettings,
): void {
  const nonLandingCount = context.sect.abilityLoadout.filter(
    (id) =>
      id &&
      id !== 'primordial-ray' &&
      !TIANYAN_LANDING_ABILITY_IDS.includes(id as TianyanLandingAbilityId),
  ).length;
  settings.loadoutMultiplier = 1
    + Math.min(2, nonLandingCount) * settings.nonLandingSlotBonus;
  const factory = new SectAbilityFactory(TIANYAN_SECT_ID);
  for (const spec of LANDING_SPECS) {
    compileLandingAbility(builder, factory, spec, settings, context);
  }
  compileUtilityAbilities(builder, factory, settings, context);
  compileSecrets(builder, factory, settings);
  compileRuntimePassives(builder, factory, settings);
  builder.setResource({
    id: TIANYAN_DERIVATION,
    name: '衍数',
    icon: '✦',
    initial: settings.initialDerivation,
    max: 3,
  });
}

export function compileTianyanBase(
  context: SectProjectionContext,
  builder: SectBuildBuilder,
): void {
  compileTianyanBuild(context, builder, createTianyanBuildSettings());
}
