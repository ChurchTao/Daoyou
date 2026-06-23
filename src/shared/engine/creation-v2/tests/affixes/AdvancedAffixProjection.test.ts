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
});
