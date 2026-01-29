import { EffectTrigger, EffectType } from '../effect';
import { SKILL_AFFIX_IDS } from './affixes/skillAffixes';
import { EffectMaterializer } from './EffectMaterializer';
import { AffixWeight, MaterializationContext } from './types';

const context: MaterializationContext = {
  realm: '元婴',
  quality: '仙品',
  element: '火',
  spiritualRootStrength: 88,
  hasMatchingElement: true,
  skillGrade: '地阶上品',
};

describe('EffectMaterializer', () => {
  test('test1', async () => {
    const affixes: AffixWeight[] = [
      {
        id: SKILL_AFFIX_IDS.ATTACK_BASE_DAMAGE,
        effectType: EffectType.Damage,
        trigger: EffectTrigger.ON_SKILL_HIT,
        paramsTemplate: {
          multiplier: { base: 1.0, scale: 'root', coefficient: 0.5 },
          element: 'INHERIT',
          canCrit: true,
        },
        weight: 100,
        tags: ['primary', 'offensive'],
        displayName: '基础伤害',
        displayDescription: '造成基础伤害，可暴击',
      },
      {
        id: SKILL_AFFIX_IDS.ATTACK_TRUE_DAMAGE,
        effectType: EffectType.Damage,
        trigger: EffectTrigger.ON_SKILL_HIT,
        paramsTemplate: {
          baseDamage: { base: 1, scale: 'root', coefficient: 0.35 },
          ignoreShield: true,
          canCrit: false,
          ignoreReduction: true,
        },
        weight: 15,
        minQuality: '天品',
        tags: ['secondary', 'offensive', 'burst', 'true_damage'],
        displayName: '真实伤害',
        displayDescription: '造成无视护盾和减伤的真实伤害',
      },
    ];

    const res = EffectMaterializer.materializeAll(affixes, context);

    console.log(res);
  });
});
