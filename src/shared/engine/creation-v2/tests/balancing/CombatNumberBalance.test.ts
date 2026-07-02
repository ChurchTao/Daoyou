import { describe, expect, it } from 'vitest';
import { AttributeType } from '@shared/engine/battle-v5/core/types';
import { AttributeSet } from '@shared/engine/battle-v5/units/AttributeSet';
import { composeProductFromAffixIds } from '@shared/engine/creation-v2/composeProductFromAffixIds';
import { projectAbilityConfig } from '@shared/engine/creation-v2/models/AbilityProjection';
import {
  getRealmStageNaturalAttributeValue,
  getRealmStageUnallocatedAttributeBudget,
} from '@shared/config/realmProgression';
import type {
  DamageParams,
  EffectConfig,
} from '@shared/engine/battle-v5/core/configs';
import {
  QUALITY_VALUES,
  type Quality,
  type RealmStage,
  type RealmType,
} from '@shared/types/constants';

const QUALITY_CASES = [
  { quality: '凡品', minSkillHpRatio: 0.11, maxSkillHpRatio: 0.21, minWeaponGain: 0.1, maxWeaponGain: 0.22 },
  { quality: '真品', minSkillHpRatio: 0.14, maxSkillHpRatio: 0.27, minWeaponGain: 0.25, maxWeaponGain: 0.45 },
  { quality: '神品', minSkillHpRatio: 0.17, maxSkillHpRatio: 0.34, minWeaponGain: 0.45, maxWeaponGain: 0.72 },
] as const satisfies ReadonlyArray<{
  quality: Quality;
  minSkillHpRatio: number;
  maxSkillHpRatio: number;
  minWeaponGain: number;
  maxWeaponGain: number;
}>;

const REALM_CASES = [
  { realm: '炼气', stage: '初期' },
  { realm: '金丹', stage: '初期' },
  { realm: '渡劫', stage: '圆满' },
] as const satisfies ReadonlyArray<{ realm: RealmType; stage: RealmStage }>;

function createAverageAttributeSet(realm: RealmType, stage: RealmStage): AttributeSet {
  const natural = getRealmStageNaturalAttributeValue(realm, stage);
  const freePerAttribute =
    getRealmStageUnallocatedAttributeBudget(realm, stage) / 5;
  const value = natural + freePerAttribute;

  return new AttributeSet({
    [AttributeType.VITALITY]: value,
    [AttributeType.SPIRIT]: value,
    [AttributeType.WISDOM]: value,
    [AttributeType.SPEED]: value,
    [AttributeType.WILLPOWER]: value,
  });
}

function expectedDirectDamage(args: {
  preMitigationDamage: number;
  defender: AttributeSet;
  attacker: AttributeSet;
  defenseType?: AttributeType.DEF | AttributeType.MAGIC_DEF;
}): number {
  const { preMitigationDamage, defender, attacker, defenseType } = args;
  const effectiveDefense =
    defenseType === undefined ? 0 : defender.getValue(defenseType);
  const afterDefense = Math.max(
    preMitigationDamage * 0.1,
    preMitigationDamage - effectiveDefense,
  );
  const critRate = attacker.getValue(AttributeType.CRIT_RATE);
  const critDamage = attacker.getValue(AttributeType.CRIT_DAMAGE_MULT);
  const critExpectation = 1 + critRate * (critDamage - 1);

  // 同构筑命中期望通常落入 97% 保底命中；这里按系统 dodge 下限建模。
  return afterDefense * critExpectation * 0.97;
}

function collectDamageEffects(effects: EffectConfig[] = []): EffectConfig[] {
  const damageEffects: EffectConfig[] = [];
  for (const effect of effects) {
    if (effect.type === 'damage') {
      damageEffects.push(effect);
      continue;
    }
    if (effect.type === 'effect_sequence') {
      damageEffects.push(...collectDamageEffects(effect.params.effects));
    }
  }
  return damageEffects;
}

function calculateDamageEffectHpRatio(
  effect: EffectConfig,
  attrs: AttributeSet,
): number {
  expect(effect.type).toBe('damage');

  const value = (effect.params as DamageParams).value;
  const preMitigationDamage =
    (value.base ?? 0) +
    attrs.getValue(value.attribute ?? AttributeType.MAGIC_ATK) *
      (value.coefficient ?? 1) +
    attrs.getMaxHp() * (value.targetMaxHpRatio ?? 0);

  const defenseType =
    value.attribute === AttributeType.ATK
      ? AttributeType.DEF
      : value.attribute === AttributeType.MAGIC_ATK
        ? AttributeType.MAGIC_DEF
        : undefined;

  return expectedDirectDamage({
    preMitigationDamage: Math.round(preMitigationDamage),
    defender: attrs,
    attacker: attrs,
    defenseType,
  }) / attrs.getMaxHp();
}

function calculateSkillDamageHpRatio(
  realm: RealmType,
  stage: RealmStage,
  quality: Quality,
  affixIds: string[] = ['skill-core-damage-fire'],
): number {
  const attrs = createAverageAttributeSet(realm, stage);
  const skill = composeProductFromAffixIds({
    productType: 'skill',
    element: '火',
    name: `测试火伤-${quality}`,
    affixIds,
    requestedQuality: quality,
  });
  const ability = projectAbilityConfig(skill);
  const damageEffect = collectDamageEffects(ability.effects)[0];
  expect(damageEffect).toBeDefined();

  return calculateDamageEffectHpRatio(damageEffect!, attrs);
}

function calculateMaxSkillDamageHpRatio(
  realm: RealmType,
  stage: RealmStage,
  quality: Quality,
  affixIds: string[],
): number {
  const attrs = createAverageAttributeSet(realm, stage);
  const skill = composeProductFromAffixIds({
    productType: 'skill',
    element: '火',
    name: `测试高伤-${quality}`,
    affixIds,
    requestedQuality: quality,
  });
  const ability = projectAbilityConfig(skill);
  const damageEffects = collectDamageEffects(ability.effects);
  expect(damageEffects.length).toBeGreaterThan(0);

  return Math.max(
    ...damageEffects.map((effect) => calculateDamageEffectHpRatio(effect, attrs)),
  );
}

function calculateWeaponCoreBasicAttackGain(
  realm: RealmType,
  stage: RealmStage,
  quality: Quality,
): number {
  const attrs = createAverageAttributeSet(realm, stage);
  const artifact = composeProductFromAffixIds({
    productType: 'artifact',
    element: '金',
    name: `测试武器-${quality}`,
    affixIds: ['artifact-panel-weapon-dual-atk'],
    requestedSlot: 'weapon',
    requestedQuality: quality,
    realm,
    realmStage: stage,
  });
  const atkModifier =
    artifact.battleProjection.modifiers?.find(
      (modifier) => modifier.attrType === AttributeType.ATK,
    )?.value ?? 0;
  const baseDamage = expectedDirectDamage({
    preMitigationDamage: attrs.getValue(AttributeType.ATK) * 0.8,
    defender: attrs,
    attacker: attrs,
    defenseType: AttributeType.DEF,
  });
  const withWeaponDamage = expectedDirectDamage({
    preMitigationDamage: (attrs.getValue(AttributeType.ATK) + atkModifier) * 0.8,
    defender: attrs,
    attacker: attrs,
    defenseType: AttributeType.DEF,
  });

  return withWeaponDamage / baseDamage - 1;
}

function calculateCoreSkillMpCost(quality: Quality): number {
  const skill = composeProductFromAffixIds({
    productType: 'skill',
    element: '火',
    name: `测试火耗-${quality}`,
    affixIds: ['skill-core-damage-fire'],
    requestedQuality: quality,
  });

  return skill.battleProjection.mpCost;
}

describe('combat number balance', () => {
  it('keeps core skill single-hit damage inside same-realm HP targets', () => {
    for (const realmCase of REALM_CASES) {
      for (const qualityCase of QUALITY_CASES) {
        const hpRatio = calculateSkillDamageHpRatio(
          realmCase.realm,
          realmCase.stage,
          qualityCase.quality,
        );

        expect(hpRatio).toBeGreaterThanOrEqual(qualityCase.minSkillHpRatio);
        expect(hpRatio).toBeLessThanOrEqual(qualityCase.maxSkillHpRatio);
      }
    }
  });

  it('keeps high-PBU direct damage affixes below one-shot territory', () => {
    const soulRendRatio = calculateMaxSkillDamageHpRatio(
      '渡劫',
      '圆满',
      '神品',
      ['skill-rare-soul-rend'],
    );
    const lifeForFireRatio = calculateMaxSkillDamageHpRatio(
      '渡劫',
      '圆满',
      '神品',
      ['skill-core-damage-fire', 'skill-rare-life-for-fire'],
    );

    expect(soulRendRatio).toBeLessThanOrEqual(0.5);
    expect(lifeForFireRatio).toBeLessThanOrEqual(0.4);
  });

  it('keeps same-realm weapon core fixed attack gains inside target bands', () => {
    for (const realmCase of REALM_CASES) {
      for (const qualityCase of QUALITY_CASES) {
        const gain = calculateWeaponCoreBasicAttackGain(
          realmCase.realm,
          realmCase.stage,
          qualityCase.quality,
        );

        expect(gain).toBeGreaterThanOrEqual(qualityCase.minWeaponGain);
        expect(gain).toBeLessThanOrEqual(qualityCase.maxWeaponGain);
      }
    }
  });

  it('prices core skill mp costs as item-bound absolute costs', () => {
    const expectedCoreCosts = [60, 70, 80, 90, 110, 120, 140, 160];

    expect(QUALITY_VALUES.map(calculateCoreSkillMpCost)).toEqual(
      expectedCoreCosts,
    );

    const earlySkill = composeProductFromAffixIds({
      productType: 'skill',
      element: '火',
      name: '炼气赤炎术',
      affixIds: ['skill-core-damage-fire'],
      requestedQuality: '神品',
      realm: '炼气',
      realmStage: '初期',
    });
    const lateSkill = composeProductFromAffixIds({
      productType: 'skill',
      element: '火',
      name: '渡劫赤炎术',
      affixIds: ['skill-core-damage-fire'],
      requestedQuality: '神品',
      realm: '渡劫',
      realmStage: '圆满',
    });

    expect(lateSkill.battleProjection.mpCost).toBe(
      earlySkill.battleProjection.mpCost,
    );
  });

  it('charges extra mp for high-PBU skill affix complexity without realm scaling', () => {
    const coreSkill = composeProductFromAffixIds({
      productType: 'skill',
      element: '火',
      name: '神品赤炎术',
      affixIds: ['skill-core-damage-fire'],
      requestedQuality: '神品',
    });
    const rareSkill = composeProductFromAffixIds({
      productType: 'skill',
      element: '火',
      name: '神品赤炎壁',
      affixIds: ['skill-core-damage-fire', 'skill-rare-earth-rampart'],
      requestedQuality: '神品',
      realm: '渡劫',
      realmStage: '圆满',
    });

    expect(rareSkill.battleProjection.mpCost).toBeGreaterThan(
      coreSkill.battleProjection.mpCost,
    );
    expect(rareSkill.battleProjection.mpCost).toBe(380);
  });
});
