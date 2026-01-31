import { EffectTrigger, EffectType, StatModifierType } from '../effect';
import { CONSUMABLE_AFFIX_IDS } from './affixes/consumableAffixes';
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

  test('testConsume', async () => {
    const affixes: AffixWeight[] = [
      {
        id: CONSUMABLE_AFFIX_IDS.CULTIVATION_EXP,
        effectType: EffectType.ConsumeGainCultivationExp,
        trigger: EffectTrigger.ON_CONSUME,
        paramsTemplate: {
          value: { base: 50, scale: 'realm', coefficient: 30 },
        },
        weight: 100,
        tags: ['resource', 'cultivation', 'secondary'],
        displayName: '获得修为',
        displayDescription: '服用后获得修为，数值随境界提升',
      },
      {
        id: CONSUMABLE_AFFIX_IDS.PRIMARY_VITALITY,
        effectType: EffectType.ConsumeStatModifier,
        trigger: EffectTrigger.ON_CONSUME, // 特殊触发器：服用时触发，永久生效
        paramsTemplate: {
          stat: 'vitality',
          modType: StatModifierType.FIXED,
          value: { base: 5, scale: 'quality', coefficient: 1 },
        },
        weight: 100,
        tags: ['primary', 'defensive'],
        displayName: '永久提升体魄',
        displayDescription: '永久增加体魄属性，数值随境界提升',
      },
      {
        id: CONSUMABLE_AFFIX_IDS.LIFESPAN,
        effectType: EffectType.ConsumeGainLifespan,
        trigger: EffectTrigger.ON_CONSUME,
        paramsTemplate: {
          value: { base: 5, scale: 'quality', coefficient: 2 },
        },
        weight: 60,
        minQuality: '玄品',
        tags: ['resource', 'lifespan', 'secondary'],
        displayName: '增加寿元',
        displayDescription: '服用后增加寿元，数值随品质提升',
      },
    ];

    const res = EffectMaterializer.materializeAll(affixes, context);

    console.log(res);
  });
});
