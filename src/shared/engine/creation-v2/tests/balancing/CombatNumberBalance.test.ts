import { describe, expect, it } from 'vitest';
import { AttributeType } from '@shared/engine/battle-v5/core/types';
import { AttributeSet } from '@shared/engine/battle-v5/units/AttributeSet';
import { composeProductFromAffixIds } from '@shared/engine/creation-v2/composeProductFromAffixIds';
import { projectAbilityConfig } from '@shared/engine/creation-v2/models/AbilityProjection';
import {
  getRealmStageNaturalAttributeValue,
  getRealmStageUnallocatedAttributeBudget,
} from '@shared/config/realmProgression';
import type { DamageParams } from '@shared/engine/battle-v5/core/configs';
import type { Quality, RealmStage, RealmType } from '@shared/types/constants';

const QUALITY_CASES = [
  { quality: '凡品', minSkillHpRatio: 0.14, maxSkillHpRatio: 0.2, minWeaponGain: 0.1, maxWeaponGain: 0.22 },
  { quality: '真品', minSkillHpRatio: 0.2, maxSkillHpRatio: 0.28, minWeaponGain: 0.25, maxWeaponGain: 0.45 },
  { quality: '神品', minSkillHpRatio: 0.28, maxSkillHpRatio: 0.4, minWeaponGain: 0.45, maxWeaponGain: 0.72 },
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
  defenseType: AttributeType.DEF | AttributeType.MAGIC_DEF;
}): number {
  const { preMitigationDamage, defender, attacker, defenseType } = args;
  const afterDefense = Math.max(
    preMitigationDamage * 0.1,
    preMitigationDamage - defender.getValue(defenseType),
  );
  const critRate = attacker.getValue(AttributeType.CRIT_RATE);
  const critDamage = attacker.getValue(AttributeType.CRIT_DAMAGE_MULT);
  const critExpectation = 1 + critRate * (critDamage - 1);

  // 同构筑命中期望通常落入 97% 保底命中；这里按系统 dodge 下限建模。
  return afterDefense * critExpectation * 0.97;
}

function calculateSkillDamageHpRatio(
  realm: RealmType,
  stage: RealmStage,
  quality: Quality,
): number {
  const attrs = createAverageAttributeSet(realm, stage);
  const skill = composeProductFromAffixIds({
    productType: 'skill',
    element: '火',
    name: `测试火伤-${quality}`,
    affixIds: ['skill-core-damage-fire'],
    requestedQuality: quality,
  });
  const ability = projectAbilityConfig(skill);
  const damageEffect = ability.effects?.find((effect) => effect.type === 'damage');
  expect(damageEffect).toBeDefined();

  const value = (damageEffect!.params as DamageParams).value;
  const preMitigationDamage =
    (value.base ?? 0) +
    attrs.getValue(value.attribute ?? AttributeType.MAGIC_ATK) *
      (value.coefficient ?? 1) +
    attrs.getMaxHp() * (value.targetMaxHpRatio ?? 0);

  return expectedDirectDamage({
    preMitigationDamage: Math.round(preMitigationDamage),
    defender: attrs,
    attacker: attrs,
    defenseType: AttributeType.MAGIC_DEF,
  }) / attrs.getMaxHp();
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
});
