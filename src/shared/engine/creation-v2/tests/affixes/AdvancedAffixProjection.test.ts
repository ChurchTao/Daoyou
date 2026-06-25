import { describe, expect, it } from 'vitest';
import { AbilityFactory } from '@shared/engine/battle-v5/factories/AbilityFactory';
import { composeProductFromAffixIds } from '@shared/engine/creation-v2/composeProductFromAffixIds';
import { projectAbilityConfig } from '@shared/engine/creation-v2/models/AbilityProjection';
import {
  deserializeAndRehydrate,
  serializeProductModel,
} from '@shared/engine/creation-v2/persistence/ProductPersistenceMapper';
import type { CreationProductType } from '@shared/engine/creation-v2/types';
import type { ElementType, EquipmentSlot } from '@shared/types/constants';
import type { EffectConfig } from '@shared/engine/battle-v5/core/configs';

interface AdvancedAffixCase {
  affixId: string;
  productType: CreationProductType;
  element: ElementType;
  requestedSlot?: EquipmentSlot;
  coreAffixId?: string;
}

const ADVANCED_AFFIX_CASES: AdvancedAffixCase[] = [
  { affixId: 'skill-rare-life-for-fire', productType: 'skill', element: '火', coreAffixId: 'skill-core-damage-fire' },
  { affixId: 'skill-rare-frost-burial', productType: 'skill', element: '冰', coreAffixId: 'skill-core-damage-ice' },
  { affixId: 'skill-variant-thunder-pact', productType: 'skill', element: '雷', coreAffixId: 'skill-core-damage-thunder' },
  { affixId: 'skill-rare-poison-gu-return', productType: 'skill', element: '木', coreAffixId: 'skill-core-damage-wood' },
  { affixId: 'skill-rare-blood-ink-talisman', productType: 'skill', element: '火', coreAffixId: 'skill-core-damage-fire' },
  { affixId: 'skill-variant-wind-exchange-step', productType: 'skill', element: '风', coreAffixId: 'skill-core-damage-wind' },
  { affixId: 'skill-variant-cut-meridian', productType: 'skill', element: '金', coreAffixId: 'skill-core-damage' },
  { affixId: 'skill-rare-old-dream-rekindle', productType: 'skill', element: '水', coreAffixId: 'skill-core-damage-water' },
  { affixId: 'gongfa-secret-causality-scripture', productType: 'gongfa', element: '水' },
  { affixId: 'gongfa-secret-myriad-unity', productType: 'gongfa', element: '土' },
  { affixId: 'gongfa-school-reverse-cultivation', productType: 'gongfa', element: '火' },
  { affixId: 'gongfa-secret-three-breath-sword', productType: 'gongfa', element: '金' },
  { affixId: 'gongfa-secret-heaven-jealous-root', productType: 'gongfa', element: '雷' },
  { affixId: 'gongfa-secret-leakless-body', productType: 'gongfa', element: '土' },
  { affixId: 'gongfa-secret-void-step', productType: 'gongfa', element: '风' },
  { affixId: 'gongfa-school-borrowed-law-returned', productType: 'gongfa', element: '木' },
  {
    affixId: 'artifact-treasure-karma-mirror',
    productType: 'artifact',
    element: '水',
    requestedSlot: 'accessory',
  },
  {
    affixId: 'artifact-treasure-calamity-coin',
    productType: 'artifact',
    element: '金',
    requestedSlot: 'accessory',
  },
  {
    affixId: 'artifact-treasure-thunder-devour-bottle',
    productType: 'artifact',
    element: '雷',
    requestedSlot: 'accessory',
  },
  {
    affixId: 'artifact-defense-soul-purifying-bell',
    productType: 'artifact',
    element: '水',
    requestedSlot: 'accessory',
  },
  {
    affixId: 'artifact-treasure-taixu-robe',
    productType: 'artifact',
    element: '土',
    requestedSlot: 'armor',
  },
  {
    affixId: 'artifact-defense-demon-locking-nail',
    productType: 'artifact',
    element: '金',
    requestedSlot: 'accessory',
  },
  {
    affixId: 'artifact-treasure-returning-ruin-pearl',
    productType: 'artifact',
    element: '水',
    requestedSlot: 'accessory',
  },
  {
    affixId: 'artifact-treasure-steal-heaven-seal',
    productType: 'artifact',
    element: '水',
    requestedSlot: 'accessory',
  },
];

describe('advanced affix projection and rehydrate', () => {
  it('rehydrates magic core skills with bleed DOT modifiers without mixed-channel rejection', () => {
    const product = composeProductFromAffixIds({
      productType: 'skill',
      element: '金',
      requestedQuality: '神品',
      name: '金磁裂星指',
      affixIds: [
        'skill-core-damage',
        'skill-variant-water-mana-burn',
        'skill-variant-bleed-dot',
        'skill-variant-def-break',
      ],
    });

    const serialized = serializeProductModel(product);
    const rehydrated = deserializeAndRehydrate(serialized);
    const abilityConfig = projectAbilityConfig(rehydrated);

    expect(() => AbilityFactory.create(abilityConfig)).not.toThrow();
  });

  it.each(ADVANCED_AFFIX_CASES)(
    '$affixId produces a rehydratable battle ability accepted by AbilityFactory',
    ({ affixId, productType, element, requestedSlot, coreAffixId }) => {
      const product = composeProductFromAffixIds({
        productType,
        element,
        requestedSlot,
        requestedQuality: '神品',
        name: `测试-${affixId}`,
        affixIds: coreAffixId ? [coreAffixId, affixId] : [affixId],
      });

      const serialized = serializeProductModel(product);
      expect(serialized).not.toHaveProperty('battleProjection');

      const rehydrated = deserializeAndRehydrate(serialized);
      const abilityConfig = projectAbilityConfig(rehydrated);

      expect(() => AbilityFactory.create(abilityConfig)).not.toThrow();
      expect(abilityConfig.effects?.length ?? abilityConfig.listeners?.length ?? 0).toBeGreaterThan(0);
    },
  );

  it('thunder devour bottle stores thunder charges before cooldown release', () => {
    const product = composeProductFromAffixIds({
      productType: 'artifact',
      element: '雷',
      requestedSlot: 'accessory',
      requestedQuality: '神品',
      name: '测试-吞雷瓶',
      affixIds: ['artifact-treasure-thunder-devour-bottle'],
    });
    const abilityConfig = projectAbilityConfig(product);
    const effects = abilityConfig.listeners?.flatMap((listener) => listener.effects) ?? [];
    const sequence = effects.find((effect) => effect.type === 'effect_sequence');

    expect(sequence).toBeDefined();
    expect(sequence?.params.effects.map((effect) => effect.type)).toEqual([
      'apply_buff',
      'consume_status_trigger',
    ]);
    expect(sequence?.params.effects[1]).toMatchObject({
      type: 'consume_status_trigger',
      params: {
        match: { id: 'thunder_devour_charge' },
        consume: 'all',
        effects: [{ type: 'cooldown_modify' }],
      },
    });
  });

  it('leakless body consumes its immunity buff after blocking one damage event', () => {
    const product = composeProductFromAffixIds({
      productType: 'gongfa',
      element: '土',
      requestedQuality: '神品',
      name: '测试-无漏法身',
      affixIds: ['gongfa-secret-leakless-body'],
    });
    const abilityConfig = projectAbilityConfig(product);
    const applyBuff = abilityConfig.listeners
      ?.flatMap((listener) => listener.effects)
      .find((effect) => effect.type === 'apply_buff');
    const leaklessListener = applyBuff?.params.buffConfig.listeners?.[0];

    expect(leaklessListener?.effects.map((effect) => effect.type)).toEqual([
      'damage_immunity',
      'buff_layer_modify',
    ]);
    expect(leaklessListener?.effects[1]).toMatchObject({
      type: 'buff_layer_modify',
      params: {
        match: { id: 'leakless_body' },
        operation: 'clear',
      },
    });
  });

  it('calamity coin only projects its debt sequence for lethal damage windows', () => {
    const product = composeProductFromAffixIds({
      productType: 'artifact',
      element: '金',
      requestedSlot: 'accessory',
      requestedQuality: '神品',
      name: '测试-替劫铜钱',
      affixIds: ['artifact-treasure-calamity-coin'],
    });
    const abilityConfig = projectAbilityConfig(product);
    const effect = abilityConfig.listeners?.flatMap((listener) => listener.effects)[0];

    expect(effect).toMatchObject({
      type: 'effect_sequence',
      conditions: [{ type: 'is_lethal', params: {} }],
    });
  });

  it('calamity coin scales debt by max HP and improves repayment ratio with quality', () => {
    const projectCalamityEffect = (requestedQuality: '凡品' | '神品') => {
      const product = composeProductFromAffixIds({
        productType: 'artifact',
        element: '金',
        requestedSlot: 'accessory',
        requestedQuality,
        name: `测试-替劫铜钱-${requestedQuality}`,
        affixIds: ['artifact-treasure-calamity-coin'],
      });
      const abilityConfig = projectAbilityConfig(product);
      const effect = abilityConfig.listeners?.flatMap((listener) => listener.effects)[0];
      if (effect?.type !== 'effect_sequence') {
        throw new Error('calamity coin did not project an effect sequence');
      }
      return effect;
    };

    const low = projectCalamityEffect('凡品');
    const high = projectCalamityEffect('神品');
    const lowDeathPrevent = low.params.effects[0];
    const highDeathPrevent = high.params.effects[0];
    const lowRecord = low.params.effects[1];
    const highRecord = high.params.effects[1];
    const lowDelayed = low.params.effects[2];
    const highDelayed = high.params.effects[2];

    expect(lowDeathPrevent).toMatchObject({ type: 'death_prevent' });
    expect(highDeathPrevent).toMatchObject({ type: 'death_prevent' });
    expect(highDeathPrevent.params.hpFloorPercent).toBeGreaterThan(
      lowDeathPrevent.params.hpFloorPercent ?? 0,
    );

    expect(lowRecord).toMatchObject({ type: 'damage_memory' });
    expect(highRecord).toMatchObject({ type: 'damage_memory' });
    expect(lowRecord.params.maxStoredValue?.targetMaxHpRatio).toBeGreaterThan(1);
    expect(highRecord.params.maxStoredValue?.targetMaxHpRatio).toBeGreaterThan(
      lowRecord.params.maxStoredValue?.targetMaxHpRatio ?? 0,
    );

    if (lowDelayed.type !== 'delayed_effect' || highDelayed.type !== 'delayed_effect') {
      throw new Error('calamity debt did not project delayed effects');
    }
    const lowRelease = lowDelayed.params.effects[0];
    const highRelease = highDelayed.params.effects[0];
    expect(lowRelease).toMatchObject({ type: 'damage_memory' });
    expect(highRelease).toMatchObject({ type: 'damage_memory' });
    expect(highRelease.params.ratio).toBeLessThan(lowRelease.params.ratio ?? 1);
  });

  it('projects apply_buff embedded listener effects recursively', () => {
    const thunderPact = composeProductFromAffixIds({
      productType: 'skill',
      element: '雷',
      requestedQuality: '神品',
      name: '测试-雷契',
      affixIds: ['skill-core-damage-thunder', 'skill-variant-thunder-pact'],
    });
    const thunderConfig = projectAbilityConfig(thunderPact);
    const thunderApply = thunderConfig.effects?.find(
      (effect): effect is Extract<EffectConfig, { type: 'apply_buff' }> =>
        effect.type === 'apply_buff' &&
        effect.params.buffConfig.id === 'thunder_mark',
    );
    const thunderDamage = thunderApply?.params.buffConfig.listeners?.[0]?.effects
      .flatMap((effect) =>
        effect.type === 'consume_status_trigger' ? effect.params.effects : [],
      )
      .find((effect) => effect.type === 'damage');

    expect(thunderDamage).toBeDefined();
    expect(thunderDamage?.params.value.base).toEqual(expect.any(Number));
    expect(thunderDamage?.params.value.coefficient).toEqual(expect.any(Number));
    expect(thunderDamage?.params.value.targetMaxHpRatio).toEqual(expect.any(Number));

    const heavenRoot = composeProductFromAffixIds({
      productType: 'gongfa',
      element: '雷',
      requestedQuality: '神品',
      name: '测试-天妒灵根',
      affixIds: ['gongfa-secret-heaven-jealous-root'],
    });
    const heavenConfig = projectAbilityConfig(heavenRoot);
    const heavenApply = heavenConfig.listeners
      ?.flatMap((listener) => listener.effects)
      .find((effect): effect is Extract<EffectConfig, { type: 'apply_buff' }> =>
        effect.type === 'apply_buff',
      );
    const heavenDamage = heavenApply?.params.buffConfig.listeners?.[0]?.effects.find(
      (effect) => effect.type === 'damage',
    );

    expect(heavenDamage).toBeDefined();
    expect(heavenDamage?.params.value.base).toEqual(expect.any(Number));
    expect(heavenDamage?.params.value.targetMaxHpRatio).toEqual(expect.any(Number));
  });

  it('projects shield break and target max MP scaling into battle config', () => {
    const ruinPearl = composeProductFromAffixIds({
      productType: 'artifact',
      element: '水',
      requestedSlot: 'accessory',
      requestedQuality: '神品',
      name: '测试-归墟珠',
      affixIds: ['artifact-treasure-returning-ruin-pearl'],
    });
    const ruinConfig = projectAbilityConfig(ruinPearl);
    const ruinEffect = ruinConfig.listeners?.flatMap((listener) => listener.effects)[0];
    expect(ruinEffect).toMatchObject({
      type: 'damage_memory',
      params: {
        event: 'shield_break',
        releaseAs: 'damage',
      },
    });

    const cutMeridian = composeProductFromAffixIds({
      productType: 'skill',
      element: '金',
      requestedQuality: '神品',
      name: '测试-截脉',
      affixIds: ['skill-core-damage', 'skill-variant-cut-meridian'],
    });
    const cutConfig = projectAbilityConfig(cutMeridian);
    const sequence = cutConfig.effects?.find((effect) => effect.type === 'effect_sequence');
    const manaBurn = sequence?.type === 'effect_sequence'
      ? sequence.params.effects.find((effect) => effect.type === 'mana_burn')
      : undefined;
    expect(manaBurn?.params.value.targetMaxMpRatio).toEqual(expect.any(Number));
  });
});
