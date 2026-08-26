import { StackRule } from '@shared/engine/battle-v5/buffs/Buff';
import type {
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
import { JIUJIE_BASE_DEFINITION } from '../definition';
import {
  JIUJIE_CALAMITY,
  JIUJIE_BASIC_CHAIN_COUNTER,
  JIUJIE_BASIC_CHAIN_LOG,
  JIUJIE_BEHELD,
  JIUJIE_BORROW_SHIELD_MEMORY,
  JIUJIE_CONDEMNATION_PATH_ID,
  JIUJIE_CONTROL_OWNER_PUNISHMENT,
  JIUJIE_CONTROL_OWNER_SENTENCE,
  JIUJIE_CONTROL_SENTENCE,
  JIUJIE_CONTROL_TARGET_PUNISHMENT,
  JIUJIE_CRIME_LOCK,
  JIUJIE_CRIME_LOCK_LOG,
  JIUJIE_DAMAGE_SENTENCE,
  JIUJIE_DAMAGE_PUNISHMENT,
  JIUJIE_DEBT,
  JIUJIE_EYE,
  JIUJIE_EYE_HIT_COUNTER,
  JIUJIE_EYE_PATH_ID,
  JIUJIE_FULL_SPEND_SETTLEMENT,
  JIUJIE_FIRST_CRIME_READY,
  JIUJIE_OPENING_SHIELD_MEMORY,
  JIUJIE_PENDING_TRIAL,
  JIUJIE_PENDING_TRIAL_LOG,
  JIUJIE_QUIET_ROUND_COUNTER,
  JIUJIE_RECEIVE,
  JIUJIE_REOFFEND,
  JIUJIE_SECT_ID,
  JIUJIE_SETTLEMENT_REOPEN_LOCK,
  JIUJIE_SETTLEMENT_REOPEN_READY,
  JIUJIE_SIN_CONTROL,
  JIUJIE_SIN_DAMAGE,
  JIUJIE_SIN_SUPPORT,
  JIUJIE_SUPPORT_SENTENCE,
  JIUJIE_SUPPORT_PUNISHMENT,
  JIUJIE_THREE_POINT_SETTLEMENT,
  JIUJIE_THUNDER,
  JIUJIE_TWO_POINT_SETTLEMENT,
  jiujieAbilityTag,
  jiujieTag,
} from '../ids';
import type { JiujieBuildSettings } from '../shared/buildFacade';

const factory = new SectAbilityFactory(JIUJIE_SECT_ID);
const thunderTag = jiujieTag('thunder');
const debtTag = jiujieTag('debt');
const calamityTag = jiujieTag('calamity');
const eyeTag = jiujieTag('calamity-eye');
const reoffendTag = jiujieTag('reoffend');
const beheldTag = jiujieTag('beheld');
const crimeLockTag = jiujieTag('crime-lock');
const pendingTrialTag = jiujieTag('pending-trial');
const firstCrimeReadyTag = jiujieTag('first-crime-ready');
const receiveTag = jiujieTag('receive-calamity');
const settlementReopenLockTag = jiujieTag('settlement-reopen-lock');
const settlementReopenReadyTag = jiujieTag('settlement-reopen-ready');

const c = (
  type: ConditionConfig['type'],
  params: ConditionConfig['params'],
): ConditionConfig => ({ type, params });
const damage = (
  coefficient: number,
  source: DamageSource = DamageSource.DIRECT,
  damageType: DamageType = DamageType.MAGICAL,
  reactive = false,
): EffectConfig => ({
  type: 'damage',
  params: {
    value: { attribute: AttributeType.MAGIC_ATK, coefficient },
    damageType,
    damageSource: source,
    ...(reactive ? { canCrit: false, canLifesteal: false } : {}),
  },
});
const apply = (
  buffConfig: BuffConfig,
  target: 'caster' | 'target' = 'target',
): EffectConfig => ({ type: 'apply_buff', params: { buffConfig, target } });

const hiddenMarker = (
  id: string,
  name: string,
  tag: string,
  duration = 3,
  type: BuffType = BuffType.BUFF,
): BuffConfig => ({
  id,
  name,
  type,
  duration,
  stackRule: StackRule.REFRESH_DURATION,
  dispelPolicy: 'protected',
  countsAsStatus: false,
  logVisibility: 'debug',
  statusVisibility: 'hidden',
  tags: [tag],
  statusTags: [tag],
  removeOnDeath: true,
});

function thunderBuff(settings: JiujieBuildSettings): BuffConfig {
  return {
    id: JIUJIE_THUNDER,
    name: '劫雷',
    description: '不可驱散。目标主动行动时承受天罚。',
    type: BuffType.DEBUFF,
    duration: settings.thunderDuration,
    stackRule: StackRule.REFRESH_DURATION,
    dispelPolicy: 'protected',
    maxLayers: 1,
    tags: [
      GameplayTags.BUFF.TYPE.DEBUFF,
      GameplayTags.BUFF.DOT.ROOT,
      GameplayTags.BUFF.ELEMENT.THUNDER,
      thunderTag,
      calamityTag,
    ],
    statusTags: [GameplayTags.STATUS.CATEGORY.DOT, thunderTag, calamityTag],
    removeOnDeath: true,
  };
}

function thunderApplication(settings: JiujieBuildSettings): EffectConfig[] {
  return [
    ...(settings.condemnation.firstCrime
      ? [{
          ...apply(hiddenMarker(
            JIUJIE_FIRST_CRIME_READY,
            '初罪待立',
            firstCrimeReadyTag,
            settings.thunderDuration,
            BuffType.DEBUFF,
          )),
          conditions: [c('has_not_tag', { scope: 'target', tag: thunderTag })],
        }]
      : []),
    apply(thunderBuff(settings)),
  ];
}

function debtBuff(settings: JiujieBuildSettings): BuffConfig {
  return {
    id: JIUJIE_DEBT,
    name: '劫债',
    description: '不可驱散。重复主动行为会把劫债推向清算。',
    type: BuffType.DEBUFF,
    duration: settings.debtDuration,
    stackRule: StackRule.STACK_LAYER,
    maxLayers: 3,
    dispelPolicy: 'protected',
    tags: [GameplayTags.BUFF.TYPE.DEBUFF, debtTag, calamityTag],
    statusTags: [debtTag, calamityTag],
    removeOnDeath: true,
  };
}

function beheldBuff(): BuffConfig {
  return {
    id: JIUJIE_BEHELD,
    name: '照见',
    description: '此人将灾厄带入劫眼，部分神通会追究其来力。',
    type: BuffType.DEBUFF,
    duration: 4,
    stackRule: StackRule.REFRESH_DURATION,
    dispelPolicy: 'protected',
    countsAsStatus: false,
    tags: [beheldTag],
    statusTags: [beheldTag],
    removeOnDeath: true,
  };
}

function eyeBuff(settings: JiujieBuildSettings): BuffConfig {
  const firstHitEffects: EffectConfig[] = [
    {
      type: 'runtime_counter_modify',
      params: { key: JIUJIE_EYE_HIT_COUNTER, operation: 'set', amount: 1, target: 'caster' },
    },
    apply(beheldBuff()),
    ...(settings.eye.bearingMark
      ? [{ ...apply(debtBuff(settings)), conditions: [c('has_tag', { scope: 'target', tag: thunderTag })] }]
      : []),
    ...thunderApplication(settings),
    ...(settings.eye.firstLight
      ? [
          { type: 'shield', params: { value: { targetMaxHpRatio: 0.05 }, target: 'caster' } } satisfies EffectConfig,
          { type: 'combat_resource_modify', params: { resourceId: JIUJIE_CALAMITY, operation: 'add', amount: 1, target: 'caster', reason: 'gain' } } satisfies EffectConfig,
        ]
      : []),
    ...(settings.eye.calamityCycle
      ? [{
          type: 'consume_status_trigger',
          params: {
            match: { id: JIUJIE_SETTLEMENT_REOPEN_READY },
            displayName: '劫后再开',
            consume: 'all',
            target: 'caster',
            effects: [
              { type: 'combat_resource_modify', params: { resourceId: JIUJIE_CALAMITY, operation: 'add', amount: 1, target: 'caster', reason: 'refund' } },
              apply(hiddenMarker(JIUJIE_SETTLEMENT_REOPEN_LOCK, '劫后再开·调息', settlementReopenLockTag, 3), 'caster'),
            ],
          },
        } satisfies EffectConfig]
      : []),
  ];
  const listeners: ListenerConfig[] = [calamityGainListener(), {
    id: 'jiujie.eye.mark-attacker',
    eventType: GameplayTags.EVENT.DAMAGE_TAKEN,
    scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
    priority: EventPriorityLevel.DAMAGE_TAKEN + 1,
    mapping: { caster: 'owner', target: 'event.caster' },
    conditions: [
      c('damage_source_is', { damageSource: DamageSource.DIRECT }),
      c('runtime_counter_compare', { scope: 'caster', key: JIUJIE_EYE_HIT_COUNTER, op: 'lt', value: 1 }),
    ],
    effects: firstHitEffects,
  }];
  if (settings.eye.counterThunder) {
    listeners.push({
      id: 'jiujie.eye.counter-thunder',
      eventType: GameplayTags.EVENT.DAMAGE_TAKEN,
      scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
      priority: EventPriorityLevel.DAMAGE_TAKEN,
      mapping: { caster: 'owner', target: 'event.caster' },
      guard: { skipSecondaryDamageSource: true },
      triggerPolicy: { maxTriggers: 1, granularity: 'round' },
      conditions: [c('damage_source_is', { damageSource: DamageSource.DIRECT })],
      effects: [damage(0.20, DamageSource.COUNTER, DamageType.MAGICAL, true)],
    });
  }
  if (settings.eye.quietCalamity) {
    listeners.push(
      {
        id: 'jiujie.eye.quiet-observe',
        eventType: GameplayTags.EVENT.DAMAGE_TAKEN,
        scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
        priority: EventPriorityLevel.DAMAGE_TAKEN,
        mapping: { caster: 'owner', target: 'owner' },
        conditions: [c('damage_source_is', { damageSource: DamageSource.DIRECT })],
        effects: [{ type: 'runtime_counter_modify', params: { key: JIUJIE_QUIET_ROUND_COUNTER, operation: 'set', amount: 1 } }],
      },
      {
        id: 'jiujie.eye.quiet-calamity',
        eventType: GameplayTags.EVENT.ROUND_POST,
        scope: GameplayTags.SCOPE.OWNER_AS_ACTOR,
        priority: EventPriorityLevel.ROUND_POST_RECOVERY,
        mapping: { caster: 'owner', target: 'owner' },
        conditions: [c('runtime_counter_compare', { scope: 'caster', key: JIUJIE_QUIET_ROUND_COUNTER, op: 'lt', value: 1 })],
        effects: [
          { type: 'combat_resource_modify', params: { resourceId: JIUJIE_CALAMITY, operation: 'add', amount: 1, target: 'caster', reason: 'gain' } },
          { type: 'cooldown_modify', params: { cdModifyValue: -1, target: 'caster', tags: [jiujieAbilityTag('receive-calamity')] } },
        ],
      },
      {
        id: 'jiujie.eye.quiet-reset',
        eventType: GameplayTags.EVENT.ROUND_POST,
        scope: GameplayTags.SCOPE.OWNER_AS_ACTOR,
        priority: EventPriorityLevel.ROUND_POST_DRAIN,
        mapping: { caster: 'owner', target: 'owner' },
        effects: [{ type: 'runtime_counter_modify', params: { key: JIUJIE_QUIET_ROUND_COUNTER, operation: 'reset' } }],
      },
    );
  }
  return {
    id: JIUJIE_EYE,
    name: '劫眼',
    description: '直面来力，将承受的灾厄记入劫簿。',
    type: BuffType.BUFF,
    duration: settings.eyeDuration,
    stackRule: StackRule.REFRESH_DURATION,
    dispelPolicy: 'protected',
    countsAsStatus: false,
    statusTags: [eyeTag],
    listeners,
    removeOnDeath: true,
  };
}

function memoryListener(settings: JiujieBuildSettings): ListenerConfig {
  return {
    id: 'jiujie.eye.remember',
    eventType: GameplayTags.EVENT.DAMAGE_TAKEN,
    scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
    priority: EventPriorityLevel.DAMAGE_TAKEN,
    mapping: { caster: 'owner', target: 'owner' },
    conditions: [c('damage_source_is', { damageSource: DamageSource.DIRECT })],
    effects: [
      {
        type: 'damage_memory',
        params: {
          key: JIUJIE_EYE,
          mode: 'record',
          event: 'damage_taken',
          target: 'target',
          maxStoredValue: { targetMaxHpRatio: settings.eye.armorMemory ? 0.70 : settings.memoryCap },
          includeShieldAbsorbed: settings.eye.armorMemory,
        },
      },
    ],
  };
}

function calamityGainListener(): ListenerConfig {
  return {
    id: 'jiujie.eye.gain-calamity',
    eventType: GameplayTags.EVENT.DAMAGE_TAKEN,
    scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
    priority: EventPriorityLevel.DAMAGE_TAKEN,
    mapping: { caster: 'owner', target: 'owner' },
    triggerPolicy: { maxTriggers: 1, granularity: 'action' },
    conditions: [c('damage_source_is', { damageSource: DamageSource.DIRECT })],
    effects: [
      {
        type: 'combat_resource_modify',
        params: {
          resourceId: JIUJIE_CALAMITY,
          operation: 'add',
          amount: 1,
          target: 'caster',
          reason: 'gain',
        },
      },
    ],
  };
}

function directDamageReductionListener(reduction: number): ListenerConfig {
  return {
    id: 'jiujie.receive-calamity.reduce-direct',
    eventType: GameplayTags.EVENT.DAMAGE_REQUEST,
    scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
    priority: EventPriorityLevel.DAMAGE_REQUEST,
    mapping: { caster: 'owner', target: 'owner' },
    conditions: [c('damage_source_is', { damageSource: DamageSource.DIRECT })],
    effects: [
      {
        type: 'percent_damage_modifier',
        params: {
          mode: 'reduce',
          value: 1 - reduction,
          allowedDamageSources: [DamageSource.DIRECT],
        },
      },
    ],
  };
}

function receiveBuff(settings: JiujieBuildSettings): BuffConfig {
  const recordsCalamity = settings.pathId === JIUJIE_EYE_PATH_ID;
  const listeners = [directDamageReductionListener(settings.receiveReduction)];
  if (recordsCalamity) {
    listeners.push(memoryListener(settings));
  }
  if (settings.eye.lowHpGate) {
    listeners.push({
      id: 'jiujie.receive-calamity.low-hp-gate',
      eventType: GameplayTags.EVENT.DAMAGE_REQUEST,
      scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
      priority: EventPriorityLevel.DAMAGE_REQUEST + 1,
      mapping: { caster: 'owner', target: 'owner' },
      triggerPolicy: { maxTriggers: 1, granularity: 'round' },
      conditions: [
        c('damage_source_is', { damageSource: DamageSource.DIRECT }),
        c('hp_below', { scope: 'caster', value: 0.40 }),
        c('combat_resource_at_least', { scope: 'caster', resourceId: JIUJIE_CALAMITY, value: 1 }),
      ],
      effects: [
        { type: 'percent_damage_modifier', params: { mode: 'reduce', value: 0.20, allowedDamageSources: [DamageSource.DIRECT] } },
        { type: 'combat_resource_modify', params: { resourceId: JIUJIE_CALAMITY, operation: 'subtract', amount: 1, target: 'caster', reason: 'spend' } },
      ],
    });
  }
  return {
    id: JIUJIE_RECEIVE,
    name: '承天受劫',
    description: recordsCalamity
      ? '暂承来力，将受过的灾厄记入劫簿。'
      : '暂承来力，降低受到的直接伤害。',
    type: BuffType.BUFF,
    duration: settings.receiveDuration,
    stackRule: StackRule.REFRESH_DURATION,
    dispelPolicy: 'protected',
    tags: [receiveTag],
    statusTags: [receiveTag],
    listeners,
    removeOnDeath: true,
  };
}

function marker(id: string, name: string): BuffConfig {
  return {
    id,
    name,
    type: BuffType.DEBUFF,
    duration: 4,
    stackRule: StackRule.REFRESH_DURATION,
    dispelPolicy: 'protected',
    countsAsStatus: false,
    logVisibility: 'player',
    statusVisibility: 'player',
    tags: [id, jiujieTag('sin')],
    statusTags: [id],
    removeOnDeath: true,
  };
}

function reoffendBuff(): BuffConfig {
  return {
    id: JIUJIE_REOFFEND,
    name: '重犯',
    type: BuffType.DEBUFF,
    duration: 4,
    stackRule: StackRule.STACK_LAYER,
    maxLayers: 2,
    dispelPolicy: 'protected',
    countsAsStatus: false,
    logVisibility: 'player',
    statusVisibility: 'player',
    tags: [reoffendTag],
    statusTags: [reoffendTag],
    removeOnDeath: true,
  };
}

function damagePunishmentBuff(): BuffConfig {
  return {
    id: JIUJIE_DAMAGE_PUNISHMENT,
    name: '伤罪加刑',
    description: '物理与法术攻击降低12%。',
    type: BuffType.DEBUFF,
    duration: 1,
    stackRule: StackRule.REFRESH_DURATION,
    modifiers: [
      { attrType: AttributeType.ATK, type: ModifierType.ADD, value: -0.12 },
      { attrType: AttributeType.MAGIC_ATK, type: ModifierType.ADD, value: -0.12 },
    ],
    removeOnDeath: true,
  };
}

function supportPunishmentBuff(): BuffConfig {
  return {
    id: JIUJIE_SUPPORT_PUNISHMENT,
    name: '援罪断供',
    description: '受到的气血治疗削弱25%。',
    type: BuffType.DEBUFF,
    duration: 2,
    stackRule: StackRule.REFRESH_DURATION,
    modifiers: [{ attrType: AttributeType.HEAL_RECEIVED_REDUCTION, type: ModifierType.FIXED, value: 0.25 }],
    removeOnDeath: true,
  };
}

function controlPunishmentBuff(target = true): BuffConfig {
  return {
    id: target ? JIUJIE_CONTROL_TARGET_PUNISHMENT : JIUJIE_CONTROL_OWNER_PUNISHMENT,
    name: target ? '禁罪反照·迟滞' : '禁罪反照·定神',
    description: target ? '身法降低10%。' : '控制抗性提高30%。',
    type: target ? BuffType.DEBUFF : BuffType.BUFF,
    duration: target ? 2 : 1,
    stackRule: StackRule.REFRESH_DURATION,
    modifiers: [{
      attrType: target ? AttributeType.SPEED : AttributeType.CONTROL_RESISTANCE,
      type: target ? ModifierType.ADD : ModifierType.FIXED,
      value: target ? -0.10 : 0.30,
    }],
    removeOnDeath: true,
  };
}

function verdictBuff(id: string): BuffConfig {
  if (id === JIUJIE_DAMAGE_SENTENCE) {
    return { ...damagePunishmentBuff(), id, name: '判词·伤罪', duration: 2 };
  }
  if (id === JIUJIE_SUPPORT_SENTENCE) {
    return { ...supportPunishmentBuff(), id, name: '判词·援罪', duration: 2,
      modifiers: [{ attrType: AttributeType.HEAL_RECEIVED_REDUCTION, type: ModifierType.FIXED, value: 0.35 }] };
  }
  return {
    id,
    name: '判词·禁罪',
    description: '身法降低15%。',
    type: BuffType.DEBUFF,
    duration: 2,
    stackRule: StackRule.REFRESH_DURATION,
    modifiers: [{ attrType: AttributeType.SPEED, type: ModifierType.ADD, value: -0.15 }],
    removeOnDeath: true,
  };
}

function openingShieldMarker(): BuffConfig {
  return {
    ...hiddenMarker(
      JIUJIE_OPENING_SHIELD_MEMORY,
      '开门迎劫·护持',
      jiujieTag('opening-shield'),
      2,
    ),
    listeners: [{
      id: 'jiujie.eye.opening-shield-break',
      eventType: GameplayTags.EVENT.SHIELD_BREAK,
      scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
      priority: EventPriorityLevel.DAMAGE_TAKEN,
      mapping: { caster: 'owner', target: 'owner' },
      effects: [{
        type: 'consume_status_trigger',
        params: {
          match: { id: JIUJIE_OPENING_SHIELD_MEMORY },
          displayName: '开门迎劫',
          consume: 'all',
          target: 'caster',
          effects: [{ type: 'combat_resource_modify', params: { resourceId: JIUJIE_CALAMITY, operation: 'add', amount: 1, target: 'caster', reason: 'gain' } }],
        },
      }],
    }],
  };
}

function borrowShieldMarker(settings: JiujieBuildSettings): BuffConfig {
  return {
    ...hiddenMarker(
      JIUJIE_BORROW_SHIELD_MEMORY,
      '劫甲回生·护持',
      jiujieTag('borrow-shield'),
      2,
    ),
    listeners: [{
      id: 'jiujie.eye.borrow-shield-break',
      eventType: GameplayTags.EVENT.SHIELD_BREAK,
      scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
      priority: EventPriorityLevel.DAMAGE_TAKEN,
      mapping: { caster: 'owner', target: 'event.caster' },
      effects: [{
        type: 'consume_status_trigger',
        params: {
          match: { id: JIUJIE_BORROW_SHIELD_MEMORY },
          displayName: '劫甲回生',
          consume: 'all',
          target: 'caster',
          effects: [
            { type: 'heal', params: { value: { targetMaxHpRatio: 0.06 }, target: 'hp', recipient: 'caster' } },
            ...thunderApplication(settings),
          ],
        },
      }],
    }],
  };
}

function crimeConditionAlternatives(sin: string): ConditionConfig[][] {
  if (sin === JIUJIE_SIN_CONTROL) {
    return [[c('ability_has_tag', { tag: GameplayTags.ABILITY.FUNCTION.CONTROL })]];
  }
  if (sin === JIUJIE_SIN_SUPPORT) {
    return [
      [
        c('ability_has_not_tag', { tag: GameplayTags.ABILITY.FUNCTION.CONTROL }),
        c('ability_has_tag', { tag: GameplayTags.ABILITY.FUNCTION.HEAL }),
      ],
      [
        c('ability_has_not_tag', { tag: GameplayTags.ABILITY.FUNCTION.CONTROL }),
        c('ability_has_not_tag', { tag: GameplayTags.ABILITY.FUNCTION.HEAL }),
        c('ability_has_not_tag', { tag: GameplayTags.ABILITY.FUNCTION.DAMAGE }),
        c('ability_has_tag', { tag: GameplayTags.ABILITY.FUNCTION.BUFF }),
      ],
    ];
  }
  return [[
      c('ability_has_not_tag', { tag: GameplayTags.ABILITY.FUNCTION.CONTROL }),
      c('ability_has_not_tag', { tag: GameplayTags.ABILITY.FUNCTION.HEAL }),
      c('ability_has_tag', { tag: GameplayTags.ABILITY.FUNCTION.DAMAGE }),
  ]];
}

function repeatPunishment(settings: JiujieBuildSettings, sin: string): EffectConfig[] {
  if (sin === JIUJIE_SIN_DAMAGE && settings.condemnation.damagePunishment) {
    return [apply(damagePunishmentBuff())];
  }
  if (sin === JIUJIE_SIN_SUPPORT && settings.condemnation.supportPunishment) {
    return [
      { type: 'mana_burn', params: { value: { targetMaxMpRatio: 0.06 } } },
      apply(supportPunishmentBuff()),
    ];
  }
  if (sin === JIUJIE_SIN_CONTROL && settings.condemnation.controlPunishment) {
    return [apply(controlPunishmentBuff(true)), apply(controlPunishmentBuff(false), 'caster')];
  }
  return [];
}

function runtimeListeners(settings: JiujieBuildSettings): ListenerConfig[] {
  const common = [c('has_tag', { scope: 'target', tag: thunderTag })];
  const oncePerAction = { maxTriggers: 1, granularity: 'action' as const };
  const basicEffects: EffectConfig[] = [
    damage(
      settings.thunderCoefficient * (settings.condemnation.basicRecorded ? 1.30 : 1),
      DamageSource.DELAYED,
      DamageType.DOT,
      true,
    ),
  ];
  if (settings.condemnation.twoBasicsCrime) {
    basicEffects.push({
      type: 'runtime_counter_modify',
      params: {
        key: JIUJIE_BASIC_CHAIN_COUNTER,
        operation: 'add',
        amount: 1,
        target: 'target',
        max: 2,
        effects: [
          {
            type: 'mechanic_log',
            conditions: [c('runtime_counter_compare', { scope: 'target', key: JIUJIE_BASIC_CHAIN_COUNTER, op: 'gte', value: 2 })],
            params: { mechanic: 'named_trigger', internalKey: JIUJIE_BASIC_CHAIN_LOG, displayName: '两避成罪', target: 'target' },
          },
          { ...apply(debtBuff(settings)), conditions: [c('runtime_counter_compare', { scope: 'target', key: JIUJIE_BASIC_CHAIN_COUNTER, op: 'gte', value: 2 })] },
          { type: 'runtime_counter_modify', conditions: [c('runtime_counter_compare', { scope: 'target', key: JIUJIE_BASIC_CHAIN_COUNTER, op: 'gte', value: 2 })], params: { key: JIUJIE_BASIC_CHAIN_COUNTER, operation: 'reset', target: 'target' } },
        ],
      },
    });
  }
  const basicOnly: ListenerConfig = {
    id: 'jiujie.law.basic-trigger',
    eventType: GameplayTags.EVENT.SKILL_CAST,
    scope: GameplayTags.SCOPE.GLOBAL,
    priority: EventPriorityLevel.ACTION_TRIGGER,
    mapping: { caster: 'owner', target: 'event.caster' },
    triggerPolicy: oncePerAction,
    conditions: [...common, c('ability_has_exact_tag', { tag: GameplayTags.ABILITY.KIND.BASIC })],
    effects: basicEffects,
  };
  const basicExtension: ListenerConfig[] = settings.condemnation.basicRecorded
    ? [{
        id: 'jiujie.law.basic-extension',
        eventType: GameplayTags.EVENT.SKILL_CAST,
        scope: GameplayTags.SCOPE.GLOBAL,
        priority: EventPriorityLevel.ACTION_TRIGGER + 1,
        mapping: { caster: 'owner', target: 'event.caster' },
        triggerPolicy: { maxTriggers: 1, granularity: 'round' },
        conditions: [...common, c('ability_has_exact_tag', { tag: GameplayTags.ABILITY.KIND.BASIC })],
        effects: [apply(thunderBuff({ ...settings, thunderDuration: settings.thunderDuration + 1 }))],
      }]
    : [];
  const activeEffects: EffectConfig[] = [
    damage(settings.thunderCoefficient, DamageSource.DELAYED, DamageType.DOT, true),
    apply(debtBuff(settings)),
    { type: 'combat_resource_modify', params: { resourceId: JIUJIE_CALAMITY, operation: 'add', amount: 1, target: 'caster', reason: 'gain' } },
  ];
  if (settings.condemnation.firstCrime) {
    activeEffects.push({
      type: 'consume_status_trigger',
      params: {
        match: { id: JIUJIE_FIRST_CRIME_READY },
        displayName: '初罪立案',
        consume: 'all',
        effects: [{ type: 'combat_resource_modify', params: { resourceId: JIUJIE_CALAMITY, operation: 'add', amount: 1, target: 'caster', reason: 'gain' } }],
      },
    });
  }
  if (settings.condemnation.twoBasicsCrime) {
    activeEffects.push({ type: 'runtime_counter_modify', params: { key: JIUJIE_BASIC_CHAIN_COUNTER, operation: 'reset', target: 'target' } });
  }
  const activeOnly: ListenerConfig = {
    id: 'jiujie.law.active-trigger',
    eventType: GameplayTags.EVENT.SKILL_CAST,
    scope: GameplayTags.SCOPE.GLOBAL,
    priority: EventPriorityLevel.ACTION_TRIGGER,
    mapping: { caster: 'owner', target: 'event.caster' },
    triggerPolicy: oncePerAction,
    conditions: [...common, c('ability_has_not_tag', { tag: GameplayTags.ABILITY.KIND.BASIC })],
    effects: activeEffects,
  };
  const repeats: ListenerConfig[] = [];
  if (settings.pathId === JIUJIE_CONDEMNATION_PATH_ID) {
    for (const sin of [JIUJIE_SIN_DAMAGE, JIUJIE_SIN_SUPPORT, JIUJIE_SIN_CONTROL]) {
      for (const [alternativeIndex, conditions] of crimeConditionAlternatives(sin).entries()) repeats.push({
        id: `jiujie.law.repeat.${sin}.${alternativeIndex}`,
        eventType: GameplayTags.EVENT.SKILL_CAST,
        scope: GameplayTags.SCOPE.GLOBAL,
        priority: EventPriorityLevel.ACTION_TRIGGER + 3,
        mapping: { caster: 'owner', target: 'event.caster' },
        triggerPolicy: { ...oncePerAction, group: `jiujie.repeat.${sin}` },
        conditions: [
          ...common,
          c('ability_has_not_tag', { tag: GameplayTags.ABILITY.KIND.BASIC }),
          c('has_not_tag', { scope: 'target', tag: pendingTrialTag }),
          c('has_tag', { scope: 'target', tag: sin }),
          ...conditions,
        ],
        effects: [apply(debtBuff(settings)), apply(reoffendBuff()), ...repeatPunishment(settings, sin)],
      });
      if (settings.condemnation.pendingTrial) {
        repeats.push({
          id: `jiujie.law.pending-trial.${sin}`,
          eventType: GameplayTags.EVENT.SKILL_CAST,
          scope: GameplayTags.SCOPE.GLOBAL,
          priority: EventPriorityLevel.ACTION_TRIGGER + 4,
          mapping: { caster: 'owner', target: 'event.caster' },
          triggerPolicy: { ...oncePerAction, group: `jiujie.repeat.${sin}` },
          conditions: [
            ...common,
            c('ability_has_not_tag', { tag: GameplayTags.ABILITY.KIND.BASIC }),
            c('has_tag', { scope: 'target', tag: pendingTrialTag }),
            c('has_tag', { scope: 'target', tag: sin }),
          ],
          effects: [
            apply(debtBuff(settings)),
            apply(reoffendBuff()),
            ...repeatPunishment(settings, sin),
            { type: 'consume_status_trigger', params: { match: { id: JIUJIE_PENDING_TRIAL }, displayName: '候审', consume: 'all', effects: [] } },
          ],
        });
      }
    }
  }
  const cleanup: ListenerConfig[] = settings.condemnation.twoBasicsCrime
    ? [{
        id: 'jiujie.law.basic-chain-cleanup',
        eventType: GameplayTags.EVENT.BUFF_REMOVED,
        scope: GameplayTags.SCOPE.GLOBAL,
        priority: 0,
        mapping: { caster: 'owner', target: 'event.target' },
        conditions: [c('source_has_tag', { tag: thunderTag })],
        effects: [{ type: 'runtime_counter_modify', params: { key: JIUJIE_BASIC_CHAIN_COUNTER, operation: 'reset', target: 'target' } }],
      }]
    : [];
  return [basicOnly, ...basicExtension, activeOnly, ...crimeListeners(settings), ...repeats, ...cleanup];
}

function crimeListeners(settings: JiujieBuildSettings): ListenerConfig[] {
  if (settings.pathId !== JIUJIE_CONDEMNATION_PATH_ID) return [];
  const allSins = [JIUJIE_SIN_DAMAGE, JIUJIE_SIN_SUPPORT, JIUJIE_SIN_CONTROL];
  const replace = (id: string, name: string): EffectConfig[] => [
    ...(settings.condemnation.changingCrimePunished
      ? allSins.filter((sin) => sin !== id).map((sin) => ({
          ...apply(debtBuff(settings)),
          conditions: [c('has_tag', { scope: 'target', tag: sin })],
        }))
      : []),
    { type: 'consume_status_trigger', params: { match: { tags: [jiujieTag('sin')] }, displayName: '主罪', consume: 'all', effects: [] } },
    apply(marker(id, name)),
  ];
  const baseConditions: ConditionConfig[] = [
    c('has_tag', { scope: 'target', tag: thunderTag }),
    c('ability_has_not_tag', { tag: GameplayTags.ABILITY.KIND.BASIC }),
  ];
  const listener = (
    id: string,
    conditions: ConditionConfig[],
    effects: EffectConfig[],
  ): ListenerConfig => ({
    id,
    eventType: GameplayTags.EVENT.SKILL_CAST,
    scope: GameplayTags.SCOPE.GLOBAL,
    priority: EventPriorityLevel.ACTION_TRIGGER + 2,
    mapping: { caster: 'owner', target: 'event.caster' },
    triggerPolicy: { maxTriggers: 1, granularity: 'action' },
    conditions: [
      ...baseConditions,
      ...(settings.condemnation.lockCrime
        ? [c('has_not_tag', { scope: 'target', tag: crimeLockTag })]
        : []),
      ...conditions,
    ],
    effects,
  });
  const listeners: ListenerConfig[] = [
    ...crimeConditionAlternatives(JIUJIE_SIN_DAMAGE).map((conditions, index) => listener(`jiujie.law.crime.damage.${index}`, conditions, replace(JIUJIE_SIN_DAMAGE, '主罪·伤害'))),
    ...crimeConditionAlternatives(JIUJIE_SIN_SUPPORT).map((conditions, index) => listener(`jiujie.law.crime.support.${index}`, conditions, replace(JIUJIE_SIN_SUPPORT, '主罪·扶持'))),
    ...crimeConditionAlternatives(JIUJIE_SIN_CONTROL).map((conditions, index) => listener(`jiujie.law.crime.control.${index}`, conditions, replace(JIUJIE_SIN_CONTROL, '主罪·控制'))),
  ];
  if (settings.condemnation.lockCrime) {
    for (const nextSin of allSins) {
      const differentCurrent = allSins.filter((sin) => sin !== nextSin);
      for (const currentSin of differentCurrent) {
        for (const [alternativeIndex, conditions] of crimeConditionAlternatives(nextSin).entries()) listeners.push({
          id: `jiujie.law.crime-lock.${currentSin}.${nextSin}.${alternativeIndex}`,
          eventType: GameplayTags.EVENT.SKILL_CAST,
          scope: GameplayTags.SCOPE.GLOBAL,
          priority: EventPriorityLevel.ACTION_TRIGGER + 1,
          mapping: { caster: 'owner', target: 'event.caster' },
          triggerPolicy: { maxTriggers: 1, granularity: 'action', group: 'jiujie.crime-lock' },
          conditions: [
            ...baseConditions,
            c('has_tag', { scope: 'target', tag: crimeLockTag }),
            c('has_tag', { scope: 'target', tag: currentSin }),
            ...conditions,
          ],
          effects: [{ type: 'consume_status_trigger', params: { match: { id: JIUJIE_CRIME_LOCK }, displayName: '定罪成册', consume: 'all', effects: [] } }],
        });
      }
    }
  }
  return listeners;
}

function compileRuntime(
  builder: SectBuildBuilder,
  settings: JiujieBuildSettings,
): void {
  const definition = JIUJIE_BASE_DEFINITION.abilities.find(
    (a) => a.id === 'jiujie-tianwei-runtime',
  );
  if (!definition || definition.kind !== 'passive')
    throw new Error('九劫天宫基础被动定义缺失');
  const tianweiConditions: ConditionConfig[] = [
    c('ability_has_not_tag', { tag: GameplayTags.ABILITY.KIND.BASIC }),
    c('ability_has_any_tag', {
      tags: [
        GameplayTags.ABILITY.CHANNEL.MAGIC,
        GameplayTags.ABILITY.FUNCTION.DEBUFF,
      ],
    }),
    c('chance', { value: 0.2 }),
  ];
  builder.setAbility(
    'jiujie-tianwei-runtime',
    factory.passive({
      definition,
      listeners: [
        {
          id: 'jiujie.tianwei',
          eventType: GameplayTags.EVENT.SKILL_PRE_CAST,
          scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
          priority: EventPriorityLevel.ACTION_TRIGGER,
          mapping: { caster: 'owner', target: 'owner' },
          conditions: tianweiConditions,
          effects: [{ type: 'skill_immunity', params: { reason: '天威裁决' } }],
        },
      ],
      detailRows: ['受到敌方主动法术或负面技能时，有20%几率免疫整个技能。'],
    }),
  );
  const runtime = JIUJIE_BASE_DEFINITION.abilities.find(
    (a) => a.id === 'jiujie-law-runtime',
  );
  if (!runtime || runtime.kind !== 'passive')
    throw new Error('九劫天宫劫律定义缺失');
  builder.setAbility(
    'jiujie-law-runtime',
    factory.passive({
      definition: runtime,
      listeners: runtimeListeners(settings),
      extraTags: [GameplayTags.ABILITY.ELEMENT.THUNDER],
      detailRows: ['劫雷在目标主动行动时触发；普攻只承受基础天罚。'],
    }),
  );
}

function ability(
  builder: SectBuildBuilder,
  id: string,
  spec: Parameters<SectAbilityFactory['active']>[0],
): void {
  builder.setAbility(id, factory.active(spec));
}

export function compileJiujieBase(
  context: SectProjectionContext,
  builder: SectBuildBuilder,
  settings: JiujieBuildSettings,
): void {
  builder.setResource({
    id: JIUJIE_CALAMITY,
    name: '劫数',
    icon: '⚡',
    initial: 0,
    max: settings.resourceMax,
  });
  compileRuntime(builder, settings);
  const d = (id: string) => {
    const item = JIUJIE_BASE_DEFINITION.abilities.find((a) => a.id === id);
    if (!item || (item.kind !== 'active' && item.kind !== 'default'))
      throw new Error(`九劫天宫神通缺失: ${id}`);
    return item;
  };
  ability(builder, 'thunder-finger', {
    definition: d('thunder-finger'),
    effects: [damage(0.8)],
    targetPolicy: { team: 'enemy', scope: 'single' },
    extraTags: [GameplayTags.ABILITY.ELEMENT.THUNDER],
    detailRows: ['普攻，仅造成基础雷属性伤害。'],
  });
  ability(builder, 'heaven-hearing', {
    definition: d('heaven-hearing'),
    effects: [
      damage(0.45),
      ...(settings.condemnation.hearingRecords
        ? [{ ...apply(debtBuff(settings)), conditions: [c('has_tag', { scope: 'target', tag: thunderTag })] }]
        : []),
      ...thunderApplication(settings),
    ],
    targetPolicy: { team: 'enemy', scope: 'single' },
    extraTags: [GameplayTags.ABILITY.ELEMENT.THUNDER],
    detailRows: [`施加不可驱散劫雷，持续${settings.thunderDuration}回合。`],
  });
  ability(builder, 'receive-calamity', {
    definition: d('receive-calamity'),
    effects: [
      ...(settings.eye.openingShield
        ? [
            { type: 'shield', params: { value: { targetMaxHpRatio: 0.08 }, target: 'caster' } } satisfies EffectConfig,
            apply(openingShieldMarker(), 'caster'),
          ]
        : []),
      apply(receiveBuff(settings)),
      ...(settings.pathId === JIUJIE_EYE_PATH_ID
        ? [apply(eyeBuff(settings), 'caster')]
        : []),
    ],
    castEffects: settings.pathId === JIUJIE_EYE_PATH_ID
      ? [
          { type: 'runtime_counter_modify', params: { key: JIUJIE_EYE_HIT_COUNTER, operation: 'reset', target: 'caster' } },
          { type: 'runtime_counter_modify', params: { key: JIUJIE_QUIET_ROUND_COUNTER, operation: 'reset', target: 'caster' } },
        ]
      : [],
    targetPolicy: { team: 'self', scope: 'single' },
    detailRows: [
      `${settings.receiveDuration}回合内降低${Math.round((1 - settings.receiveReduction) * 100)}%直接伤害。`,
      ...(settings.pathId === JIUJIE_EYE_PATH_ID
        ? [
            `承劫量最多记录自身最大气血的${Math.round((settings.eye.armorMemory ? 0.70 : settings.memoryCap) * 100)}%。`,
            `劫眼持续${settings.eyeDuration}回合；期间首次直接受击标记攻击者，并按行动获得劫数。`,
          ]
        : []),
    ],
  });
  ability(builder, 'calamity-seal', {
    definition: d('calamity-seal'),
    effects: [
      {
        type: 'apply_buff',
        conditions: [c('has_tag', { scope: 'target', tag: thunderTag })],
        params: { buffConfig: debtBuff(settings) },
      },
      ...(settings.condemnation.lockCrime
        ? [JIUJIE_SIN_DAMAGE, JIUJIE_SIN_SUPPORT, JIUJIE_SIN_CONTROL].flatMap((sin) => [
            {
              ...apply(hiddenMarker(JIUJIE_CRIME_LOCK, '定罪成册', crimeLockTag, 3, BuffType.DEBUFF)),
              conditions: [c('has_tag', { scope: 'target', tag: sin })],
            } satisfies EffectConfig,
            {
              type: 'mechanic_log',
              conditions: [c('has_tag', { scope: 'target', tag: sin })],
              params: { mechanic: 'status_transition', internalKey: JIUJIE_CRIME_LOCK_LOG, displayName: '定罪成册', target: 'target', operation: 'apply' },
            } satisfies EffectConfig,
          ])
        : []),
      ...(settings.condemnation.sealQuickensQuestion
        ? [JIUJIE_SIN_DAMAGE, JIUJIE_SIN_SUPPORT, JIUJIE_SIN_CONTROL].map((sin) => ({
            type: 'cooldown_modify',
            conditions: [c('has_tag', { scope: 'target', tag: sin })],
            params: { cdModifyValue: -1, target: 'caster', tags: [jiujieAbilityTag('thunder-prison-question')] },
          }) satisfies EffectConfig)
        : []),
      ...thunderApplication(settings),
    ],
    targetPolicy: { team: 'enemy', scope: 'single' },
    extraTags: [GameplayTags.ABILITY.ELEMENT.THUNDER],
    detailRows: [
      '为目标施加或刷新不可驱散劫雷；目标已有劫雷时额外增加1层劫债。',
    ],
  });
  ability(builder, 'thunder-prison-question', {
    definition: d('thunder-prison-question'),
    castConditions: [c('has_tag', { scope: 'target', tag: thunderTag })],
    effects: [
      damage(settings.questionCoefficient),
      apply(thunderBuff(settings)),
      apply(debtBuff(settings)),
      ...(settings.eye.questionBeheld
        ? [
            { ...apply(debtBuff(settings)), conditions: [c('has_tag', { scope: 'target', tag: beheldTag })] },
            {
              type: 'cooldown_modify',
              conditions: [c('has_tag', { scope: 'target', tag: beheldTag })],
              params: { cdModifyValue: -1, target: 'caster', tags: [jiujieAbilityTag('receive-calamity')] },
            } satisfies EffectConfig,
          ]
        : []),
      ...(settings.eye.questionPursuit
        ? [
            { ...damage(0.25, DamageSource.FOLLOW_UP, DamageType.MAGICAL, true), conditions: [c('has_tag', { scope: 'target', tag: beheldTag })] },
            { ...apply(eyeBuff({ ...settings, eyeDuration: 1 }), 'caster'), conditions: [c('has_tag', { scope: 'target', tag: beheldTag }), c('has_tag', { scope: 'caster', tag: eyeTag })] },
          ]
        : []),
      ...(settings.condemnation.questionEvidence
        ? [
            ...[JIUJIE_SIN_DAMAGE, JIUJIE_SIN_SUPPORT, JIUJIE_SIN_CONTROL].map((sin) => ({
              ...apply(reoffendBuff()),
              conditions: [c('has_tag', { scope: 'target', tag: sin })],
            })),
          ]
        : []),
      ...(settings.condemnation.pendingTrial
        ? [
            {
              ...apply(hiddenMarker(JIUJIE_PENDING_TRIAL, '候审', pendingTrialTag, 2, BuffType.DEBUFF)),
              conditions: [c('buff_layer_at_least', { scope: 'target', id: JIUJIE_DEBT, value: 2 })],
            },
            {
              type: 'mechanic_log',
              conditions: [c('buff_layer_at_least', { scope: 'target', id: JIUJIE_DEBT, value: 2 })],
              params: { mechanic: 'status_transition', internalKey: JIUJIE_PENDING_TRIAL_LOG, displayName: '三问成案·候审', target: 'target', operation: 'apply' },
            } satisfies EffectConfig,
          ]
        : []),
    ],
    targetPolicy: { team: 'enemy', scope: 'single' },
    extraTags: [GameplayTags.ABILITY.ELEMENT.THUNDER],
    detailRows: ['造成雷伤，延长劫雷，并推进劫债。'],
  });
  ability(builder, 'borrow-calamity', {
    definition: d('borrow-calamity'),
    castConditions: [
      c('combat_resource_at_least', { resourceId: JIUJIE_CALAMITY, value: 1 }),
    ],
    effects: [
      {
        type: 'combat_resource_modify',
        params: {
          resourceId: JIUJIE_CALAMITY,
          operation: 'subtract',
          amount: 1,
          target: 'caster',
          reason: 'spend',
        },
      },
      {
        type: 'shield',
        params: {
          value: { targetMaxHpRatio: settings.borrowShieldRatio },
          target: 'caster',
        },
      },
      ...(settings.eye.shieldRebirth ? [apply(borrowShieldMarker(settings), 'caster')] : []),
      ...(settings.eye.borrowExtendsEye
        ? [
            {
              ...apply(eyeBuff({ ...settings, eyeDuration: settings.eyeDuration + 1 }), 'caster'),
              conditions: [c('has_tag', { scope: 'caster', tag: eyeTag })],
            },
            {
              ...apply(receiveBuff({ ...settings, receiveDuration: settings.receiveDuration + 1 }), 'caster'),
              conditions: [c('has_tag', { scope: 'caster', tag: receiveTag })],
            },
          ]
        : []),
    ],
    targetPolicy: { team: 'self', scope: 'single' },
    detailRows: ['消耗1点劫数，获得15%最大气血护盾。'],
  });
  const debtBonus = (coefficient: number): EffectConfig[] => [
    damage(coefficient),
    {
      type: 'damage',
      conditions: [
        c('buff_layer_at_least', {
          id: JIUJIE_DEBT,
          scope: 'target',
          value: 1,
        }),
      ],
      params: {
        value: { attribute: AttributeType.MAGIC_ATK, coefficient: 0.1 },
        damageType: DamageType.MAGICAL,
        damageSource: DamageSource.FOLLOW_UP,
      },
    },
    {
      type: 'damage',
      conditions: [
        c('buff_layer_at_least', {
          id: JIUJIE_DEBT,
          scope: 'target',
          value: 2,
        }),
      ],
      params: {
        value: { attribute: AttributeType.MAGIC_ATK, coefficient: 0.1 },
        damageType: DamageType.MAGICAL,
        damageSource: DamageSource.FOLLOW_UP,
      },
    },
    {
      type: 'damage',
      conditions: [
        c('buff_layer_at_least', {
          id: JIUJIE_DEBT,
          scope: 'target',
          value: 3,
        }),
      ],
      params: {
        value: { attribute: AttributeType.MAGIC_ATK, coefficient: 0.1 },
        damageType: DamageType.MAGICAL,
        damageSource: DamageSource.FOLLOW_UP,
      },
    },
  ];
  ability(builder, 'causal-echo', {
    definition: d('causal-echo'),
    effects: [
      ...debtBonus(0.45),
      ...(settings.eye.echoMemory
        ? [{
            type: 'damage_memory',
            conditions: [c('has_tag', { scope: 'target', tag: beheldTag })],
            params: { key: JIUJIE_EYE, mode: 'release', ratio: 0.20, releaseAs: 'follow_up', target: 'caster', damageType: DamageType.MAGICAL, consume: false },
          } satisfies EffectConfig]
        : []),
      ...(settings.condemnation.echoExpedites
        ? [{
            type: 'buff_layer_modify',
            conditions: [c('buff_layer_at_least', { scope: 'target', id: JIUJIE_DEBT, value: 3 })],
            params: {
              match: { id: JIUJIE_DEBT }, operation: 'subtract', layers: 1,
              effects: [
                { type: 'combat_resource_modify', params: { resourceId: JIUJIE_CALAMITY, operation: 'add', amount: 1, target: 'caster', reason: 'gain' } },
                damage(0.30, DamageSource.FOLLOW_UP, DamageType.MAGICAL, true),
              ],
            },
          } satisfies EffectConfig]
        : []),
    ],
    targetPolicy: { team: 'enemy', scope: 'single' },
    extraTags: [
      GameplayTags.ABILITY.ELEMENT.THUNDER,
      ...(settings.condemnation.echoExpedites
        ? [GameplayTags.ABILITY.SECT.mechanic(JIUJIE_SECT_ID, 'heavy-statute')]
        : []),
    ],
    detailRows: ['造成基础追击雷伤，并根据劫债层数追加回响雷伤。'],
  });
  const twoPointFullDebtMarker = JIUJIE_TWO_POINT_SETTLEMENT;
  const threePointFullDebtMarker = JIUJIE_THREE_POINT_SETTLEMENT;
  const fullSpendMarker = JIUJIE_FULL_SPEND_SETTLEMENT;
  const memoryDamageRatio = settings.eye.trueMemory
    ? (settings.eye.fullMemory ? 0.60 : 0.45)
    : (settings.eye.fullMemory ? 1 : settings.finishMemoryRatio);
  const settlementEffects: EffectConfig[] = [
    ...(settings.condemnation.fullDebtSettlement
      ? [
          {
            ...apply(hiddenMarker(twoPointFullDebtMarker, '三债终审·二劫', jiujieTag('settlement-two-point'), 1), 'caster'),
            conditions: [
              c('buff_layer_at_least', { scope: 'target', id: JIUJIE_DEBT, value: 3 }),
              c('combat_resource_below', { scope: 'caster', resourceId: JIUJIE_CALAMITY, value: 3 }),
            ],
          },
          {
            ...apply(hiddenMarker(threePointFullDebtMarker, '三债终审·三劫', jiujieTag('settlement-three-point'), 1), 'caster'),
            conditions: [
              c('buff_layer_at_least', { scope: 'target', id: JIUJIE_DEBT, value: 3 }),
              c('combat_resource_at_least', { scope: 'caster', resourceId: JIUJIE_CALAMITY, value: 3 }),
            ],
          },
        ]
      : []),
    ...(settings.eye.settlementReopen
      ? [{
          ...apply(hiddenMarker(fullSpendMarker, '清算留门·三劫', jiujieTag('settlement-full-spend'), 1), 'caster'),
          conditions: [c('combat_resource_at_least', { scope: 'caster', resourceId: JIUJIE_CALAMITY, value: 3 })],
        }]
      : []),
    {
      type: 'resource_scaled_damage',
      params: {
        resourceId: JIUJIE_CALAMITY,
        baseCoefficient: 0.8,
        coefficientPerPoint: 0.3,
        maxPoints: 3,
        consume: 'all',
        attribute: AttributeType.MAGIC_ATK,
        damageType: DamageType.MAGICAL,
        damageSource: DamageSource.DIRECT,
      },
    },
    ...(settings.condemnation.fullDebtSettlement
      ? [
          {
            ...damage(0.30),
            conditions: [c('has_tag', { scope: 'caster', tag: jiujieTag('settlement-two-point') })],
          } satisfies EffectConfig,
          {
            type: 'combat_resource_modify',
            conditions: [c('has_tag', { scope: 'caster', tag: jiujieTag('settlement-three-point') })],
            params: {
              resourceId: JIUJIE_CALAMITY,
              operation: 'add',
              amount: 1,
              target: 'caster',
              reason: 'refund',
            },
          } satisfies EffectConfig,
        ]
      : []),
    ...(settings.eye.memoryHeal
      ? [{
          type: 'damage_memory',
          params: { key: JIUJIE_EYE, mode: 'release', ratio: 0.25, releaseAs: 'heal', target: 'caster', consume: false },
        } satisfies EffectConfig]
      : []),
    ...(settings.eye.memoryShield
      ? [{
          type: 'damage_memory',
          params: { key: JIUJIE_EYE, mode: 'release', ratio: 0.60, releaseAs: 'shield', target: 'caster', consume: false },
        } satisfies EffectConfig]
      : []),
    ...(memoryDamageRatio > 0
      ? [{
          type: 'damage_memory',
          params: {
            key: JIUJIE_EYE,
            mode: 'release',
            ratio: memoryDamageRatio,
            releaseAs: settings.eye.trueMemory ? 'damage' : 'follow_up',
            target: 'caster',
            damageType: settings.eye.trueMemory ? DamageType.TRUE : DamageType.MAGICAL,
            consume: true,
          },
        } satisfies EffectConfig]
      : []),
    ...(settings.settlementThunderDuration > 0
      ? [
          {
            type: 'buff_duration_modify',
            params: {
              rounds: settings.settlementThunderDuration,
              tags: [thunderTag],
            },
          } satisfies EffectConfig,
        ]
      : []),
    {
      type: 'consume_status_trigger',
      params: {
        match: { id: JIUJIE_DEBT },
        displayName: '劫债',
        consume: 'all',
        scaleEffectsByLayer: true,
        target: 'target',
        effects: [
          damage(settings.finishDebtCoefficient, DamageSource.FOLLOW_UP),
        ],
      },
    },
    {
      type: 'consume_status_trigger',
      params: {
        match: { id: JIUJIE_REOFFEND },
        displayName: '重犯',
        consume: 'all',
        scaleEffectsByLayer: true,
        target: 'target',
        effects: [
          damage(settings.reoffendBonus, DamageSource.FOLLOW_UP, DamageType.MAGICAL, true),
          ...(settings.condemnation.repeatedThunder
            ? [damage(settings.thunderCoefficient * 0.50, DamageSource.FOLLOW_UP, DamageType.DOT, true)]
            : []),
        ],
      },
    },
    ...(settings.condemnation.crimeVerdict
      ? [
          { ...apply(verdictBuff(JIUJIE_DAMAGE_SENTENCE)), conditions: [c('has_tag', { scope: 'target', tag: JIUJIE_SIN_DAMAGE })] },
          { type: 'mana_burn', conditions: [c('has_tag', { scope: 'target', tag: JIUJIE_SIN_SUPPORT })], params: { value: { targetMaxMpRatio: 0.08 } } } satisfies EffectConfig,
          { ...apply(verdictBuff(JIUJIE_SUPPORT_SENTENCE)), conditions: [c('has_tag', { scope: 'target', tag: JIUJIE_SIN_SUPPORT })] },
          { ...apply(verdictBuff(JIUJIE_CONTROL_SENTENCE)), conditions: [c('has_tag', { scope: 'target', tag: JIUJIE_SIN_CONTROL })] },
          {
            ...apply({ ...controlPunishmentBuff(false), id: JIUJIE_CONTROL_OWNER_SENTENCE, name: '判词·禁罪定神', duration: 2,
              modifiers: [{ attrType: AttributeType.CONTROL_RESISTANCE, type: ModifierType.FIXED, value: 0.40 }] }, 'caster'),
            conditions: [c('has_tag', { scope: 'target', tag: JIUJIE_SIN_CONTROL })],
          },
        ]
      : []),
    ...(settings.pathId === JIUJIE_CONDEMNATION_PATH_ID
        && !settings.condemnation.preserveCrime
      ? [
          {
            type: 'consume_status_trigger',
            params: {
              match: { tags: [jiujieTag('sin')] },
              displayName: '主罪',
              consume: 'all',
              target: 'target',
              effects: [],
            },
          } satisfies EffectConfig,
        ]
      : []),
    ...(settings.condemnation.twoBasicsCrime
      ? [{ type: 'runtime_counter_modify', params: { key: JIUJIE_BASIC_CHAIN_COUNTER, operation: 'reset', target: 'target' } } satisfies EffectConfig]
      : []),
    ...(settings.condemnation.endlessCondemnation
      ? [
          ...thunderApplication({ ...settings, thunderDuration: 2 }),
          apply(debtBuff(settings)),
          ...(settings.condemnation.firstCrime
            ? [apply(hiddenMarker(
                JIUJIE_FIRST_CRIME_READY,
                '初罪待立',
                firstCrimeReadyTag,
                2,
                BuffType.DEBUFF,
              ))]
            : []),
        ]
      : []),
    ...(settings.eye.settlementReopen && !settings.eye.calamityCycle
      ? [
          {
            ...apply(receiveBuff({ ...settings, receiveDuration: 1 }), 'caster'),
            conditions: [c('has_tag', { scope: 'caster', tag: jiujieTag('settlement-full-spend') })],
          },
          {
            ...apply(eyeBuff({ ...settings, eyeDuration: 1 }), 'caster'),
            conditions: [c('has_tag', { scope: 'caster', tag: jiujieTag('settlement-full-spend') })],
          },
        ]
      : []),
    ...(settings.eye.calamityCycle
      ? [
          apply(receiveBuff({ ...settings, receiveDuration: 1 }), 'caster'),
          apply(eyeBuff({ ...settings, eyeDuration: 2 }), 'caster'),
          {
            ...apply(hiddenMarker(JIUJIE_SETTLEMENT_REOPEN_READY, '劫后再开·待应', settlementReopenReadyTag, 2), 'caster'),
            conditions: [c('has_not_tag', { scope: 'caster', tag: settlementReopenLockTag })],
          },
        ]
      : []),
    ...(settings.eye.settlementReopen || settings.eye.calamityCycle
      ? [
          { type: 'runtime_counter_modify', params: { key: JIUJIE_EYE_HIT_COUNTER, operation: 'reset', target: 'caster' } } satisfies EffectConfig,
          { type: 'runtime_counter_modify', params: { key: JIUJIE_QUIET_ROUND_COUNTER, operation: 'reset', target: 'caster' } } satisfies EffectConfig,
        ]
      : []),
    ...[twoPointFullDebtMarker, threePointFullDebtMarker, fullSpendMarker].map((id) => ({
      type: 'consume_status_trigger' as const,
      params: { match: { id }, displayName: '清算标记', consume: 'all' as const, target: 'caster' as const, effects: [] },
    })),
  ];
  ability(builder, 'nine-sky-settlement', {
    definition: d('nine-sky-settlement'),
    castConditions: [
      c('combat_resource_at_least', {
        scope: 'caster',
        resourceId: JIUJIE_CALAMITY,
        value: 2,
      }),
      c('has_tag', { scope: 'target', tag: calamityTag }),
    ],
    effects: settlementEffects,
    targetPolicy: { team: 'enemy', scope: 'single' },
    extraTags: [GameplayTags.ABILITY.ELEMENT.THUNDER],
    detailRows: ['消耗2～3点劫数，清算劫债与重犯记录，并按道途节点维持劫雷。'],
  });
}
