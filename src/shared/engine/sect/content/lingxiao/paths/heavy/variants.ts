import { StackRule } from '@shared/engine/battle-v5/buffs/Buff';
import type { AbilityConfig, EffectConfig } from '@shared/engine/battle-v5/core/configs';
import { EventPriorityLevel } from '@shared/engine/battle-v5/core/events';
import {
  AttributeType,
  BuffType,
  DamageSource,
  DamageType,
  ModifierType,
} from '@shared/engine/battle-v5/core/types';
import { GameplayTags } from '@shared/engine/shared/tag-domain';
import type { RealmType } from '@shared/types/constants';
import {
  calculateSectManaCost,
  DIRECT_DAMAGE_CONDITION,
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
  HEAVY_ECHO_COOLDOWN,
  LINGXIAO_SWORD_MOMENTUM,
} from '../../shared/LingxiaoMechanics';

export interface HeavySwordFeatures {
  opening: boolean;
  chargedReduction: boolean;
  chargedStrike: boolean;
  chargedFailShield: boolean;
  mountainGate: boolean;
  returningPeak: boolean;
  rendingMountain: boolean;
  heavenCleaving: boolean;
  immovableMountain: boolean;
  mountainRiverEcho: boolean;
}

export const EMPTY_HEAVY_FEATURES: HeavySwordFeatures = {
  opening: false,
  chargedReduction: false,
  chargedStrike: false,
  chargedFailShield: false,
  mountainGate: false,
  returningPeak: false,
  rendingMountain: false,
  heavenCleaving: false,
  immovableMountain: false,
  mountainRiverEcho: false,
};

const damage = (
  coefficient: number,
  damageSource: DamageSource = DamageSource.DIRECT,
  conditions?: EffectConfig['conditions'],
): EffectConfig => ({
  type: 'damage',
  params: {
    value: { attribute: AttributeType.ATK, coefficient },
    damageType: DamageType.PHYSICAL,
    damageSource,
  },
  conditions,
});

const selfBuff = (
  id: string,
  name: string,
  duration: number,
  modifiers: NonNullable<AbilityConfig['modifiers']>,
  listeners?: NonNullable<AbilityConfig['listeners']>,
): EffectConfig => ({
  type: 'apply_buff',
  params: {
    target: 'caster',
    buffConfig: {
      id,
      name,
      type: BuffType.BUFF,
      duration,
      stackRule: StackRule.REFRESH_DURATION,
      tags: [GameplayTags.BUFF.TYPE.BUFF],
      modifiers,
      listeners,
    },
  },
});

const reductionListeners = (value: number) => [{
  id: `sect.lingxiao.heavy.reduction.${value}`,
  eventType: GameplayTags.EVENT.DAMAGE_REQUEST,
  scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
  priority: EventPriorityLevel.DAMAGE_REQUEST + 1,
  mapping: { caster: 'owner' as const, target: 'owner' as const },
  guard: { skipSecondaryDamageSource: true },
  conditions: [DIRECT_DAMAGE_CONDITION],
  effects: [{ type: 'percent_damage_modifier' as const, params: { mode: 'reduce' as const, value } }],
}];

export function buildHeavyAbilities(
  baseBuild: Readonly<SectCompiledBuild>,
  realm: RealmType,
  path: CultivatorSectPathState,
  features: HeavySwordFeatures,
): Record<string, SectCompiledAbility> {
  const built = { ...baseBuild.abilities };
  const factory = new SectAbilityFactory(LINGXIAO_SECT_ID, realm);
  const resourceId = LINGXIAO_SWORD_MOMENTUM;
  const active = (args: {
    id: string;
    name: string;
    manaWeight: number;
    cooldown: number;
    role: SectAbilityRole;
    effects: EffectConfig[];
    castEffects?: EffectConfig[];
    castConditions?: AbilityConfig['castConditions'];
    targetTeam?: 'enemy' | 'self';
  }): SectCompiledAbility => {
    const definition = LINGXIAO_BASE_DEFINITION.abilities.find((entry) => entry.id === args.id)!;
    return factory.active({
      ...args,
      definition,
      pathId: path.pathId,
      mpCost: calculateSectManaCost(realm, args.manaWeight),
      detailRows: [],
    });
  };

  built['plain-sword'] = active({
    id: 'plain-sword', name: '负岳问锋', manaWeight: 0, cooldown: 0, role: 'generator',
    effects: [damage(0.9), sectEffects.modifyResource(resourceId, 1)],
  });
  built['guiding-sword'] = active({
    id: 'guiding-sword', name: '擎岳引', manaWeight: 1, cooldown: 2, role: 'generator',
    effects: [damage(1.05), sectEffects.modifyResource(resourceId, 2), sectEffects.shieldByAttack(0.2, undefined, 'caster')],
  });
  built['linked-edge'] = active({
    id: 'linked-edge', name: '一剑沉山', manaWeight: 1.5, cooldown: 3, role: 'combo',
    effects: [damage(1.55), sectEffects.modifyResource(resourceId, 1), sectEffects.shieldByAttack(0.35, undefined, 'caster')],
  });
  built['turning-body'] = active({
    id: 'turning-body', name: '不动藏锋', manaWeight: 1.25, cooldown: 3, role: 'defensive',
    effects: [],
    castEffects: [
      selfBuff('sect.lingxiao.heavy.hidden-edge', '不动藏锋', 1, [], reductionListeners(features.chargedReduction ? 0.4 : 0.3)),
      {
        type: 'queue_action',
        params: {
          id: 'sect.lingxiao.heavy.thunder-strike',
          name: '听雷沉山',
          tags: [
            GameplayTags.ABILITY.FUNCTION.DAMAGE,
            GameplayTags.ABILITY.CHANNEL.PHYSICAL,
            GameplayTags.ABILITY.KIND.SECT,
            GameplayTags.ABILITY.SECT.namespace(LINGXIAO_SECT_ID),
            GameplayTags.ABILITY.SECT.path(LINGXIAO_SECT_ID, path.pathId),
            GameplayTags.ABILITY.SECT.ability(LINGXIAO_SECT_ID, 'turning-body'),
            GameplayTags.ABILITY.SECT.COMBO,
            GameplayTags.ABILITY.TARGET.SINGLE,
          ],
          effects: [
            damage(features.chargedStrike ? 3.1 : 2.6),
            sectEffects.modifyResource(resourceId, 2),
          ],
          cancelEffects: features.chargedFailShield
            ? [sectEffects.shieldByAttack(0.6, undefined, 'caster')]
            : [],
        },
      },
    ],
  });
  built['shadow-step'] = active({
    id: 'shadow-step', name: '镇岳步', manaWeight: 1, cooldown: 4, role: 'defensive', targetTeam: 'self',
    effects: [
      sectEffects.shieldByAttack(0.65 * (features.mountainGate ? 1.5 : 1), undefined, 'caster'),
      selfBuff('sect.lingxiao.heavy.mountain-step', '镇岳步', 2, [
        { attrType: AttributeType.DEF, type: ModifierType.ADD, value: 0.2 },
      ]),
      sectEffects.modifyResource(resourceId, 1),
    ],
  });
  built['breaking-edge'] = active({
    id: 'breaking-edge', name: '撼山破障', manaWeight: 1.5, cooldown: 3, role: 'utility',
    effects: [damage(1.3), { type: 'dispel', params: { targetTag: GameplayTags.BUFF.TYPE.BUFF, maxCount: 1 } }],
  });
  built['sword-aegis'] = active({
    id: 'sword-aegis', name: '山河守心', manaWeight: 1.25, cooldown: 5, role: 'defensive', targetTeam: 'self',
    effects: [
      ...(features.immovableMountain ? [sectEffects.shieldByAttack(1, undefined, 'caster')] : []),
      selfBuff(
        'sect.lingxiao.heavy.mountain-heart',
        '山河守心',
        3,
        [{ attrType: AttributeType.MAGIC_DEF, type: ModifierType.ADD, value: 0.3 }],
        [
          ...reductionListeners(0.1),
          ...(features.immovableMountain ? [{
            id: 'sect.lingxiao.heavy.immovable.counter',
            eventType: GameplayTags.EVENT.DAMAGE_TAKEN,
            scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
            priority: 0,
            mapping: { caster: 'owner' as const, target: 'event.caster' as const },
            guard: { skipSecondaryDamageSource: true },
            budget: { maxTriggers: 1, reset: 'round' as const },
            conditions: [DIRECT_DAMAGE_CONDITION],
            effects: [damage(0.6, DamageSource.COUNTER)],
          }] : []),
        ],
      ),
    ],
  });
  built['nurturing-sword'] = active({
    id: 'nurturing-sword', name: '重意无锋', manaWeight: 1.5, cooldown: 5, role: 'defensive', targetTeam: 'self',
    effects: [selfBuff('sect.lingxiao.heavy.weightless-edge', '重意无锋', 3, [
      { attrType: AttributeType.ATK, type: ModifierType.ADD, value: 0.1 },
      { attrType: AttributeType.DEF, type: ModifierType.ADD, value: 0.2 },
    ])],
  });

  const returnScale = features.returningPeak ? 0.85 : 1;
  const heaven = features.heavenCleaving;
  built['sect-ultimate'] = active({
    id: 'sect-ultimate', name: '开天一线', manaWeight: 2.5, cooldown: 4 + (heaven ? 1 : 0), role: 'finisher',
    castConditions: [{ type: 'combat_resource_at_least', params: { resourceId, value: heaven ? 6 : 3, scope: 'caster' } }],
    effects: [
      {
        type: 'resource_scaled_damage',
        params: {
          resourceId,
          baseCoefficient: (heaven ? 1.6 : 1.2) * returnScale,
          coefficientPerPoint: 0.4 * returnScale,
          minPoints: heaven ? 6 : 3,
          maxPoints: 6,
          consume: 'all',
          bypassDefenseRatio: heaven ? 0.3 : features.rendingMountain ? 0.2 : 0,
          damageSource: DamageSource.DIRECT,
        },
      },
      ...(features.returningPeak ? [
        sectEffects.modifyResource(resourceId, 2),
        sectEffects.shieldByAttack(0.6, undefined, 'caster'),
      ] : []),
      ...(features.mountainRiverEcho ? [{
        type: 'runtime_counter_modify' as const,
        conditions: [{ type: 'runtime_counter_compare' as const, params: { key: HEAVY_ECHO_COOLDOWN, op: 'lt' as const, value: 1, scope: 'caster' as const } }],
        params: {
          key: HEAVY_ECHO_COOLDOWN,
          operation: 'set' as const,
          amount: 3,
          effects: [sectEffects.healMaxHp(0.05, 'caster'), sectEffects.shieldByAttack(0.8, undefined, 'caster')],
        },
      }] : []),
    ],
  });

  for (const [id, ability] of Object.entries(built)) {
    if (ability.detailRows.length === 0) ability.detailRows = describeHeavyAbility(id, features);
  }
  return built;
}

function describeHeavyAbility(id: string, features: HeavySwordFeatures): string[] {
  const rows: Record<string, string[]> = {
    'plain-sword': ['伤害：0.90物攻', '剑势：命中获得1点'],
    'guiding-sword': ['伤害：1.05物攻', '剑势：命中获得2点', '护盾：0.20物攻'],
    'linked-edge': ['伤害：单段1.55物攻', '剑势：命中获得1点', '护盾：0.35物攻'],
    'turning-body': [`藏锋：直接承伤降低${features.chargedReduction ? 40 : 30}%`, `后发：下一行动造成${features.chargedStrike ? '3.10' : '2.60'}物攻并获得2剑势`, '受控：后发取消且不退还消耗与冷却'],
    'shadow-step': [`护盾：${(0.65 * (features.mountainGate ? 1.5 : 1)).toFixed(2)}物攻`, '物理防御：提高20%', '持续：未来2次自身行动', '剑势：获得1点'],
    'breaking-edge': ['伤害：1.30物攻', '破障：驱散1个正面状态'],
    'sword-aegis': ['法术防御：提高30%', '直接承伤：降低10%', '持续：未来3次自身行动'],
    'nurturing-sword': ['物理攻击：提高10%', '物理防御：提高20%', '持续：未来3次自身行动'],
    'sect-ultimate': [heavenText(features), '释放：至少3点剑势', '释放后：消耗全部剑势'],
  };
  return rows[id] ?? [];
}

function heavenText(features: HeavySwordFeatures): string {
  if (features.heavenCleaving) return '伤害：6势时单段4.00物攻，其中30%穿防';
  return `伤害：单段1.20物攻 + 每点剑势0.40物攻${features.rendingMountain ? '，其中20%穿防' : ''}`;
}
