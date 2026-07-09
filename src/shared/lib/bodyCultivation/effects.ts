import { AttributeType, ModifierType } from '@shared/engine/battle-v5/core/types';
import type {
  AttributeModifierConfig,
  BuffConfig,
} from '@shared/engine/battle-v5/core/configs';
import { BuffType } from '@shared/engine/battle-v5/core/types';
import { GameplayTags } from '@shared/engine/shared/tag-domain';
import type {
  BodyCultivationRealm,
  BodyCultivationTrackKey,
  CultivatorCondition,
} from '@shared/types/condition';
import { BODY_CULTIVATION_REALM_ORDER } from './config';
import { normalizeBodyCultivationState } from './normalize';

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function getLevel(
  condition: CultivatorCondition | undefined,
  key: BodyCultivationTrackKey,
): number {
  return normalizeBodyCultivationState(condition).tracks[key].level;
}

function isBodyRealmAtLeast(
  current: BodyCultivationRealm,
  required: BodyCultivationRealm,
): boolean {
  return (
    BODY_CULTIVATION_REALM_ORDER.indexOf(current) >=
    BODY_CULTIVATION_REALM_ORDER.indexOf(required)
  );
}

export function buildBodyCultivationAttributeModifiers(
  condition: CultivatorCondition | undefined,
): AttributeModifierConfig[] {
  const skin = getLevel(condition, 'skin');
  const sinewBone = getLevel(condition, 'sinew_bone');
  const organs = getLevel(condition, 'organs');
  const qiBlood = getLevel(condition, 'qi_blood');
  const primordialSpirit = getLevel(condition, 'primordial_spirit');

  return [
    {
      attrType: AttributeType.DEF,
      type: ModifierType.ADD,
      value: clamp(skin * 0.006, 0, 0.45),
    },
    {
      attrType: AttributeType.MAGIC_DEF,
      type: ModifierType.ADD,
      value: clamp(skin * 0.004, 0, 0.3),
    },
    {
      attrType: AttributeType.MAX_HP,
      type: ModifierType.ADD,
      value: clamp(sinewBone * 0.008 + qiBlood * 0.012, 0, 1.1),
    },
    {
      attrType: AttributeType.CRIT_DAMAGE_REDUCTION,
      type: ModifierType.FIXED,
      value: clamp(sinewBone * 0.008, 0, 0.5),
    },
    {
      attrType: AttributeType.ATK,
      type: ModifierType.ADD,
      value: clamp(organs * 0.005, 0, 0.35),
    },
    {
      attrType: AttributeType.MAGIC_ATK,
      type: ModifierType.ADD,
      value: clamp(organs * 0.004, 0, 0.3),
    },
    {
      attrType: AttributeType.HEAL_AMPLIFY,
      type: ModifierType.FIXED,
      value: clamp(qiBlood * 0.004, 0, 0.25),
    },
    {
      attrType: AttributeType.CONTROL_RESISTANCE,
      type: ModifierType.FIXED,
      value: clamp(primordialSpirit * 0.008, 0, 0.45),
    },
    {
      attrType: AttributeType.CRIT_RESIST,
      type: ModifierType.FIXED,
      value: clamp(primordialSpirit * 0.005, 0, 0.3),
    },
  ].filter((modifier) => modifier.value > 0);
}

export function getBodyCultivationNaturalRecoveryMultiplier(
  condition: CultivatorCondition | undefined,
): number {
  const sinewBone = getLevel(condition, 'sinew_bone');
  const qiBlood = getLevel(condition, 'qi_blood');

  return clamp(1 + sinewBone * 0.006 + qiBlood * 0.008, 1, 1.75);
}

export interface BodyCultivationBattleSettleHooks {
  lowHpRecoveryPercent: number;
  woundDowngradeSteps: number;
  defeatProtection: {
    hpFloor: number;
    woundStatus: 'major_wound';
  } | null;
}

export interface BodyCultivationBattleInitHooks {
  startingShieldPercent: number;
  startingBuffs: BuffConfig[];
}

export interface BodyCultivationExternalResourceLossHooks {
  hpLossMultiplier: number;
  mpLossMultiplier: number;
}

export interface BodyCultivationBreakthroughPressureHooks {
  expLossMultiplier: number;
  insightLossMultiplier: number;
  deviationGainMultiplier: number;
  innerDemonChanceMultiplier: number;
}

export type BodyCultivationDungeonEventType =
  | 'erosion'
  | 'impact'
  | 'elemental_overload'
  | 'attrition'
  | 'spirit_intrusion'
  | 'generic';

export interface BodyCultivationDungeonEventFeedback {
  eventType: BodyCultivationDungeonEventType;
  track: BodyCultivationTrackKey;
  trackLabel: string;
  triggerText: string;
}

interface DungeonEventRule {
  eventType: Exclude<BodyCultivationDungeonEventType, 'generic'>;
  track: BodyCultivationTrackKey;
  trackLabel: string;
  keywords: readonly string[];
  format(resourceLabel: string, preventedLoss: number): string;
}

const DUNGEON_EVENT_RULES: readonly DungeonEventRule[] = [
  {
    eventType: 'spirit_intrusion',
    track: 'primordial_spirit',
    trackLabel: '元神',
    keywords: [
      '幻境',
      '幻术',
      '魅惑',
      '夺舍',
      '心魔',
      '神魂',
      '魂魄',
      '识海',
      'spirit',
      'soul',
      'illusion',
      'charm',
    ],
    format: (resourceLabel, preventedLoss) =>
      `元神生效：降低神魂侵蚀，已抵消 ${preventedLoss} 点${resourceLabel}损耗`,
  },
  {
    eventType: 'erosion',
    track: 'skin',
    trackLabel: '皮肤',
    keywords: [
      '瘴',
      '毒',
      '毒雾',
      '腐蚀',
      '侵蚀',
      '寒煞',
      '魔气',
      '外邪',
      'poison',
      'miasma',
      'corrosion',
      'erosion',
    ],
    format: (resourceLabel, preventedLoss) =>
      `皮肤生效：降低外邪侵蚀，已抵消 ${preventedLoss} 点${resourceLabel}损耗`,
  },
  {
    eventType: 'impact',
    track: 'sinew_bone',
    trackLabel: '筋骨',
    keywords: [
      '坠落',
      '跌落',
      '重压',
      '地磁',
      '崩塌',
      '撞击',
      '硬抗',
      '机关',
      '骨',
      'fall',
      'gravity',
      'impact',
      'collapse',
    ],
    format: (resourceLabel, preventedLoss) =>
      `筋骨生效：降低冲击重压，已抵消 ${preventedLoss} 点${resourceLabel}损耗`,
  },
  {
    eventType: 'elemental_overload',
    track: 'organs',
    trackLabel: '脏腑',
    keywords: [
      '火毒',
      '真火',
      '雷火',
      '五行',
      '冲突',
      '内息',
      '爆发',
      '灼烧',
      '焚',
      'fire',
      'elemental',
      'overload',
    ],
    format: (resourceLabel, preventedLoss) =>
      `脏腑生效：降低五行反噬，已抵消 ${preventedLoss} 点${resourceLabel}损耗`,
  },
  {
    eventType: 'attrition',
    track: 'qi_blood',
    trackLabel: '气血',
    keywords: [
      '连续',
      '久战',
      '低血',
      '失血',
      '枯竭',
      '疲惫',
      '疲劳',
      '续航',
      'attrition',
      'fatigue',
      'exhaustion',
    ],
    format: (resourceLabel, preventedLoss) =>
      `气血生效：降低连续作战消耗，已抵消 ${preventedLoss} 点${resourceLabel}损耗`,
  },
];

function getLowestBodyCultivationTrackLevel(
  state: ReturnType<typeof normalizeBodyCultivationState>,
): number {
  return Math.min(
    state.tracks.skin.level,
    state.tracks.sinew_bone.level,
    state.tracks.organs.level,
    state.tracks.qi_blood.level,
    state.tracks.primordial_spirit.level,
  );
}

function buildSkinDamageReductionBuff(skinLevel: number): BuffConfig | null {
  const reduction = clamp(skinLevel * 0.006, 0, 0.45);
  if (reduction <= 0) return null;

  return {
    id: 'body_cultivation_skin_damage_reduction',
    name: '皮肤·外膜护体',
    type: BuffType.BUFF,
    duration: -1,
    stackRule: 'override',
    listeners: [
      {
        eventType: GameplayTags.EVENT.DAMAGE_REQUEST,
        scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
        priority: 25,
        guard: {
          requireOwnerAlive: true,
          skipReflectSource: true,
        },
        effects: [
          {
            type: 'percent_damage_modifier',
            params: {
              mode: 'reduce',
              value: reduction,
              cap: 0.45,
            },
          },
        ],
      },
    ],
  };
}

function buildSkinErosionDurationBuff(skinLevel: number): BuffConfig | null {
  const rounds = -clamp(Math.floor(skinLevel / 5), 1, 3);
  if (skinLevel < 5) return null;

  return {
    id: 'body_cultivation_skin_erosion_duration',
    name: '皮肤·铁膜抗蚀',
    type: BuffType.BUFF,
    duration: -1,
    stackRule: 'override',
    listeners: [
      {
        eventType: GameplayTags.EVENT.BUFF_ADD,
        scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
        priority: 20,
        guard: {
          requireOwnerAlive: true,
        },
        effects: [
          {
            type: 'buff_duration_modify',
            params: {
              rounds,
              tags: [
                GameplayTags.STATUS.STATE.POISONED,
                GameplayTags.BUFF.DOT.POISON,
                GameplayTags.BUFF.ELEMENT.POISON,
              ],
            },
          },
        ],
      },
    ],
  };
}

function buildOrgansSkillRefundBuff(organsLevel: number): BuffConfig | null {
  if (organsLevel < 5) return null;

  const refundPercent = clamp(0.08 + Math.floor(organsLevel / 5) * 0.02, 0.1, 0.24);

  return {
    id: 'body_cultivation_organs_skill_refund',
    name: '脏腑·五气回流',
    type: BuffType.BUFF,
    duration: -1,
    stackRule: 'override',
    listeners: [
      {
        eventType: GameplayTags.EVENT.SKILL_PRE_CAST,
        scope: GameplayTags.SCOPE.OWNER_AS_CASTER,
        priority: 15,
        mapping: {
          caster: 'owner',
          target: 'owner',
        },
        guard: {
          requireOwnerAlive: true,
        },
        effects: [
          {
            type: 'heal',
            conditions: [
              {
                type: 'ability_mp_cost_at_least',
                params: { value: 40 },
              },
              {
                type: 'has_not_tag',
                params: {
                  tag: GameplayTags.STATUS.STATE.BODY_ORGANS_SKILL_REFUNDED,
                  scope: 'caster',
                },
              },
            ],
            params: {
              target: 'mp',
              value: { targetMaxMpRatio: refundPercent },
            },
          },
          {
            type: 'apply_buff',
            conditions: [
              {
                type: 'ability_mp_cost_at_least',
                params: { value: 40 },
              },
              {
                type: 'has_not_tag',
                params: {
                  tag: GameplayTags.STATUS.STATE.BODY_ORGANS_SKILL_REFUNDED,
                  scope: 'caster',
                },
              },
            ],
            params: {
              buffConfig: {
                id: 'body_cultivation_organs_skill_refund_marker',
                name: '脏腑·五气已回流',
                type: BuffType.BUFF,
                duration: -1,
                stackRule: 'override',
                statusTags: [
                  GameplayTags.STATUS.STATE.BODY_ORGANS_SKILL_REFUNDED,
                ],
              },
            },
          },
        ],
      },
    ],
  };
}

function buildGoldenBodyBurnBloodBuff(organsLevel: number): BuffConfig {
  const damageBonus = clamp(0.12 + Math.floor(organsLevel / 5) * 0.015, 0.12, 0.24);
  const recoveryBonus = clamp(0.08 + Math.floor(organsLevel / 10) * 0.02, 0.08, 0.18);
  const triggerConditions = [
    {
      type: 'hp_below' as const,
      params: {
        value: 0.35,
        scope: 'target' as const,
      },
    },
    {
      type: 'has_not_tag' as const,
      params: {
        tag: GameplayTags.STATUS.STATE.BODY_BURN_BLOOD_TRIGGERED,
        scope: 'target' as const,
      },
    },
  ];

  return {
    id: 'body_cultivation_golden_body_burn_blood',
    name: '金身·燃血爆发',
    type: BuffType.BUFF,
    duration: -1,
    stackRule: 'override',
    listeners: [
      {
        eventType: GameplayTags.EVENT.DAMAGE_TAKEN,
        scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
        priority: 20,
        guard: {
          requireOwnerAlive: true,
          skipReflectSource: true,
        },
        effects: [
          {
            type: 'apply_buff',
            conditions: triggerConditions,
            params: {
              buffConfig: {
                id: 'body_cultivation_golden_body_burn_blood_active',
                name: '金身·燃血',
                type: BuffType.BUFF,
                duration: 3,
                stackRule: 'override',
                modifiers: [
                  {
                    attrType: AttributeType.ATK,
                    type: ModifierType.ADD,
                    value: damageBonus,
                  },
                  {
                    attrType: AttributeType.MAGIC_ATK,
                    type: ModifierType.ADD,
                    value: damageBonus,
                  },
                  {
                    attrType: AttributeType.HEAL_AMPLIFY,
                    type: ModifierType.FIXED,
                    value: recoveryBonus,
                  },
                ],
              },
            },
          },
          {
            type: 'apply_buff',
            conditions: triggerConditions,
            params: {
              buffConfig: {
                id: 'body_cultivation_golden_body_burn_blood_marker',
                name: '金身·燃血已发',
                type: BuffType.BUFF,
                duration: -1,
                stackRule: 'override',
                statusTags: [
                  GameplayTags.STATUS.STATE.BODY_BURN_BLOOD_TRIGGERED,
                ],
              },
            },
          },
        ],
      },
    ],
  };
}

function buildDharmaBodyControlResistanceBuff(): BuffConfig {
  return {
    id: 'body_cultivation_dharma_body_control_resistance',
    name: '法身·神识定境',
    type: BuffType.BUFF,
    duration: 2,
    stackRule: 'override',
    modifiers: [
      {
        attrType: AttributeType.CONTROL_RESISTANCE,
        type: ModifierType.FIXED,
        value: 1,
      },
    ],
  };
}

function includesAnyKeyword(text: string, keywords: readonly string[]): boolean {
  return keywords.some((keyword) => text.includes(keyword.toLowerCase()));
}

export function getBodyCultivationDungeonEventFeedback(options: {
  contextText?: string;
  resource: 'hp' | 'mp';
  preventedLoss: number;
  fallbackTriggerText?: string;
}): BodyCultivationDungeonEventFeedback | null {
  const preventedLoss = Math.max(0, Math.floor(options.preventedLoss));
  if (preventedLoss <= 0) return null;

  const resourceLabel = options.resource === 'hp' ? '气血' : '灵力';
  const text = (options.contextText ?? '').toLowerCase();
  const preferredRules =
    options.resource === 'hp'
      ? DUNGEON_EVENT_RULES.filter(
          (item) => item.eventType !== 'spirit_intrusion',
        )
      : DUNGEON_EVENT_RULES.filter(
          (item) => item.eventType === 'spirit_intrusion',
        );
  const fallbackRules =
    options.resource === 'hp'
      ? DUNGEON_EVENT_RULES
      : DUNGEON_EVENT_RULES.filter(
          (item) => item.eventType !== 'spirit_intrusion',
        );
  const rule =
    preferredRules.find((item) => includesAnyKeyword(text, item.keywords)) ??
    fallbackRules.find((item) => includesAnyKeyword(text, item.keywords));

  if (rule) {
    return {
      eventType: rule.eventType,
      track: rule.track,
      trackLabel: rule.trackLabel,
      triggerText: rule.format(resourceLabel, preventedLoss),
    };
  }

  return {
    eventType: 'generic',
    track: options.resource === 'hp' ? 'skin' : 'primordial_spirit',
    trackLabel: options.resource === 'hp' ? '皮肤' : '元神',
    triggerText:
      options.fallbackTriggerText ??
      `肉身炼体生效：已抵消 ${preventedLoss} 点${resourceLabel}损耗`,
  };
}

export function getBodyCultivationBattleSettleHooks(
  condition: CultivatorCondition | undefined,
): BodyCultivationBattleSettleHooks {
  const state = normalizeBodyCultivationState(condition);
  const skin = state.tracks.skin.level;
  const sinewBone = state.tracks.sinew_bone.level;
  const qiBlood = state.tracks.qi_blood.level;
  const hasJadeMarrowProtection =
    isBodyRealmAtLeast(state.realm, 'jade_marrow') &&
    sinewBone >= 12 &&
    qiBlood >= 10;

  return {
    lowHpRecoveryPercent: clamp(
      Math.floor(sinewBone / 5) * 0.03 + Math.floor(qiBlood / 5) * 0.02,
      0,
      0.25,
    ),
    woundDowngradeSteps:
      skin >= 10 || sinewBone >= 10
        ? 1
        : 0,
    defeatProtection: hasJadeMarrowProtection
      ? {
          hpFloor: 1,
          woundStatus: 'major_wound',
        }
      : null,
  };
}

export function getBodyCultivationBattleInitHooks(
  condition: CultivatorCondition | undefined,
): BodyCultivationBattleInitHooks {
  const state = normalizeBodyCultivationState(condition);
  const skin = state.tracks.skin.level;
  const sinewBone = state.tracks.sinew_bone.level;
  const organs = state.tracks.organs.level;
  const qiBlood = state.tracks.qi_blood.level;
  const hasJadeMarrowProtection =
    isBodyRealmAtLeast(state.realm, 'jade_marrow') &&
    sinewBone >= 12 &&
    qiBlood >= 10;
  const hasGoldenBodyBurnBlood =
    isBodyRealmAtLeast(state.realm, 'golden_body') &&
    getLowestBodyCultivationTrackLevel(state) >= 10;
  const hasDharmaBodyControlResistance = isBodyRealmAtLeast(
    state.realm,
    'dharma_body',
  );
  const startingBuffs: BuffConfig[] = [];
  const skinDamageReductionBuff = buildSkinDamageReductionBuff(skin);
  const skinErosionDurationBuff = buildSkinErosionDurationBuff(skin);
  const organsSkillRefundBuff = buildOrgansSkillRefundBuff(organs);

  if (skinDamageReductionBuff) {
    startingBuffs.push(skinDamageReductionBuff);
  }
  if (skinErosionDurationBuff) {
    startingBuffs.push(skinErosionDurationBuff);
  }
  if (organsSkillRefundBuff) {
    startingBuffs.push(organsSkillRefundBuff);
  }

  if (hasJadeMarrowProtection) {
    startingBuffs.push({
      id: 'body_cultivation_jade_marrow_death_prevent',
      name: '玉髓·不灭骨',
      type: BuffType.BUFF,
      duration: -1,
      stackRule: 'override',
      listeners: [
        {
          eventType: GameplayTags.EVENT.DAMAGE_TAKEN,
          scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
          priority: 50,
          guard: {
            requireOwnerAlive: false,
            allowLethalWindow: true,
            skipReflectSource: true,
          },
          effects: [
            {
              type: 'death_prevent',
              params: {},
            },
          ],
        },
      ],
    });
  }

  if (hasGoldenBodyBurnBlood) {
    startingBuffs.push(buildGoldenBodyBurnBloodBuff(organs));
  }

  if (hasDharmaBodyControlResistance) {
    startingBuffs.push(buildDharmaBodyControlResistanceBuff());
  }

  return {
    startingShieldPercent: clamp(Math.floor(skin / 5) * 0.02, 0, 0.2),
    startingBuffs,
  };
}

export function getBodyCultivationExternalResourceLossHooks(
  condition: CultivatorCondition | undefined,
): BodyCultivationExternalResourceLossHooks {
  const skin = getLevel(condition, 'skin');
  const sinewBone = getLevel(condition, 'sinew_bone');
  const organs = getLevel(condition, 'organs');
  const qiBlood = getLevel(condition, 'qi_blood');
  const primordialSpirit = getLevel(condition, 'primordial_spirit');

  return {
    hpLossMultiplier: clamp(
      1 - skin * 0.003 - sinewBone * 0.003 - organs * 0.002,
      0.7,
      1,
    ),
    mpLossMultiplier: clamp(
      1 - qiBlood * 0.002 - primordialSpirit * 0.003,
      0.8,
      1,
    ),
  };
}

export function getBodyCultivationBreakthroughPressureHooks(
  condition: CultivatorCondition | undefined,
): BodyCultivationBreakthroughPressureHooks {
  const state = normalizeBodyCultivationState(condition);
  const sinewBone = state.tracks.sinew_bone.level;
  const qiBlood = state.tracks.qi_blood.level;
  const primordialSpirit = state.tracks.primordial_spirit.level;
  const daoBodyPressureMultiplier = isBodyRealmAtLeast(state.realm, 'dao_body')
    ? 0.9
    : 1;

  return {
    expLossMultiplier: clamp(
      (1 - sinewBone * 0.006) * daoBodyPressureMultiplier,
      0.58,
      1,
    ),
    insightLossMultiplier: clamp(
      (1 - qiBlood * 0.004) * daoBodyPressureMultiplier,
      0.68,
      1,
    ),
    deviationGainMultiplier: clamp(
      (1 - sinewBone * 0.004 - qiBlood * 0.003) *
        daoBodyPressureMultiplier,
      0.62,
      1,
    ),
    innerDemonChanceMultiplier: clamp(
      (1 - primordialSpirit * 0.004) * daoBodyPressureMultiplier,
      0.62,
      1,
    ),
  };
}
