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

export interface BodyCultivationBattleInitHooks {
  startingBuffs: BuffConfig[];
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
            type: 'heal',
            conditions: triggerConditions,
            params: {
              value: { targetMaxHpRatio: 0.15 },
            },
          },
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

function buildBronzeSkinGuardBuff(): BuffConfig {
  return {
    id: 'body_cultivation_bronze_skin_guard',
    name: '铜皮·护体',
    type: BuffType.BUFF,
    duration: 3,
    stackRule: 'override',
    listeners: [
      {
        eventType: GameplayTags.EVENT.DAMAGE_REQUEST,
        scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
        priority: 30,
        guard: {
          requireOwnerAlive: true,
          skipReflectSource: true,
        },
        effects: [
          {
            type: 'percent_damage_modifier',
            params: {
              mode: 'reduce',
              value: 0.1,
              cap: 0.1,
            },
          },
        ],
      },
    ],
  };
}

function buildIronBoneCritBuff(): BuffConfig {
  return {
    id: 'body_cultivation_iron_bone_crit',
    name: '铁骨·战骨',
    type: BuffType.BUFF,
    duration: -1,
    stackRule: 'override',
    modifiers: [
      {
        attrType: AttributeType.CRIT_RATE,
        type: ModifierType.FIXED,
        value: 0.08,
      },
      {
        attrType: AttributeType.CRIT_DAMAGE_MULT,
        type: ModifierType.FIXED,
        value: 0.16,
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

function buildDaoBodyDamageReductionBuff(): BuffConfig {
  return {
    id: 'body_cultivation_dao_body_damage_reduction',
    name: '道体·万劫不坏',
    type: BuffType.BUFF,
    duration: -1,
    stackRule: 'override',
    listeners: [
      {
        eventType: GameplayTags.EVENT.DAMAGE_REQUEST,
        scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
        priority: 35,
        guard: {
          requireOwnerAlive: true,
          skipReflectSource: true,
        },
        effects: [
          {
            type: 'percent_damage_modifier',
            params: {
              mode: 'reduce',
              value: 0.2,
              cap: 0.2,
            },
          },
        ],
      },
    ],
  };
}

export function getBodyCultivationBattleInitHooks(
  condition: CultivatorCondition | undefined,
): BodyCultivationBattleInitHooks {
  const state = normalizeBodyCultivationState(condition);
  const skin = state.tracks.skin.level;
  const organs = state.tracks.organs.level;
  const hasBronzeSkinGuard = isBodyRealmAtLeast(state.realm, 'bronze_skin');
  const hasIronBoneCrit = isBodyRealmAtLeast(state.realm, 'iron_bone');
  const hasJadeMarrowProtection = isBodyRealmAtLeast(state.realm, 'jade_marrow');
  const hasGoldenBodyBurnBlood =
    isBodyRealmAtLeast(state.realm, 'golden_body');
  const hasDharmaBodyControlResistance = isBodyRealmAtLeast(
    state.realm,
    'dharma_body',
  );
  const hasDaoBodyDamageReduction = isBodyRealmAtLeast(state.realm, 'dao_body');
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

  if (hasBronzeSkinGuard) {
    startingBuffs.push(buildBronzeSkinGuardBuff());
  }

  if (hasIronBoneCrit) {
    startingBuffs.push(buildIronBoneCritBuff());
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
            {
              type: 'dispel',
              conditions: [
                {
                  type: 'is_lethal',
                  params: {},
                },
                {
                  type: 'debuff_count_at_least',
                  params: { value: 1 },
                },
              ],
              params: {
                targetTag: GameplayTags.BUFF.TYPE.DEBUFF,
                maxCount: 99,
              },
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

  if (hasDaoBodyDamageReduction) {
    startingBuffs.push(buildDaoBodyDamageReductionBuff());
  }

  return {
    startingBuffs,
  };
}
