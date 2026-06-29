import { describe, expect, it } from 'vitest';
import { composeProductFromAffixIds } from '@shared/engine/creation-v2/composeProductFromAffixIds';
import {
  deserializeAndRehydrate,
  serializeProductModel,
} from '@shared/engine/creation-v2/persistence/ProductPersistenceMapper';

describe('ProductRehydrator', () => {
  it('rebuilds skill battleProjection from productModel only', () => {
    const model = composeProductFromAffixIds({
      productType: 'skill',
      element: '火',
      name: '赤炎术',
      affixIds: ['skill-core-damage-fire'],
    });

    const serialized = serializeProductModel(model);

    expect(serialized).not.toHaveProperty('battleProjection');
    expect(serialized).not.toHaveProperty('projectionAnchor');
    expect(serialized).toHaveProperty('projectionBasisEnergy');

    const rehydrated = deserializeAndRehydrate(serialized);

    expect(rehydrated.productType).toBe('skill');
    expect(rehydrated.battleProjection).toMatchObject({
      mpCost: model.battleProjection.mpCost,
      cooldown: model.battleProjection.cooldown,
      priority: model.battleProjection.priority,
      targetPolicy: model.battleProjection.targetPolicy,
      abilityTags: model.battleProjection.abilityTags,
    });
    expect(rehydrated.battleProjection.effects).toHaveLength(
      model.battleProjection.effects.length,
    );
  });

  it('preserves enemy pacing context when rebuilding skill battleProjection', () => {
    const model = composeProductFromAffixIds({
      productType: 'skill',
      element: '火',
      name: '赤炎袭',
      affixIds: ['skill-core-damage-fire'],
      realm: '金丹',
      realmStage: '后期',
      projectionContext: {
        ownerKind: 'enemy',
        difficulty: 95,
        role: 'offense',
        paceProfile: 'aggressive',
      },
    });

    const serialized = serializeProductModel(model);
    expect(serialized).toHaveProperty('projectionPacingContext');

    const rehydrated = deserializeAndRehydrate(serialized);

    expect(rehydrated.productType).toBe('skill');
    expect(rehydrated.battleProjection).toMatchObject({
      mpCost: model.battleProjection.mpCost,
      cooldown: model.battleProjection.cooldown,
      priority: model.battleProjection.priority,
    });
  });

  it('rehydrates legacy skill models without pacing context', () => {
    const model = composeProductFromAffixIds({
      productType: 'skill',
      element: '火',
      name: '旧版赤炎术',
      affixIds: ['skill-core-damage-fire'],
    });
    const serialized = serializeProductModel(model);
    delete serialized.projectionPacingContext;

    expect(() => deserializeAndRehydrate(serialized)).not.toThrow();
    const rehydrated = deserializeAndRehydrate(serialized);
    expect(rehydrated.productType).toBe('skill');
    expect(rehydrated.battleProjection.mpCost).toBeGreaterThan(0);
  });

  it('ignores legacy skill projectionAnchor when rebuilding mpCost', () => {
    const model = composeProductFromAffixIds({
      productType: 'skill',
      element: '火',
      name: '旧版锚点赤炎术',
      affixIds: ['skill-core-damage-fire'],
      realm: '炼气',
      realmStage: '初期',
    });
    const serialized = serializeProductModel(model) as Record<string, unknown>;
    serialized.projectionAnchor = {
      realm: '渡劫',
      realmStage: '圆满',
    };

    const rehydrated = deserializeAndRehydrate(serialized);

    expect(rehydrated.productType).toBe('skill');
    expect(rehydrated).not.toHaveProperty('projectionAnchor');
    expect(rehydrated.battleProjection.mpCost).toBe(
      model.battleProjection.mpCost,
    );
  });

  it('recomputes stored artifact modifier values from current scaling rules', () => {
    const model = composeProductFromAffixIds({
      productType: 'artifact',
      element: '金',
      name: '旧版锋锐戒',
      affixIds: ['artifact-panel-atk'],
      requestedSlot: 'accessory',
      requestedQuality: '神品',
      realm: '渡劫',
      realmStage: '圆满',
    });
    const serialized = serializeProductModel(model);
    const affixes = serialized.affixes as Array<{
      resolvedModifiers?: Array<{ attrType: string; type: string; value: number }>;
    }>;
    affixes[0].resolvedModifiers = [
      { attrType: 'ATK', type: 'fixed', value: 999999 },
    ];

    const rehydrated = deserializeAndRehydrate(serialized);

    expect(rehydrated.productType).toBe('artifact');
    expect(rehydrated.battleProjection.modifiers?.[0]?.value).toBeCloseTo(
      model.battleProjection.modifiers?.[0]?.value ?? 0,
      6,
    );
    expect(rehydrated.battleProjection.modifiers?.[0]?.value).not.toBe(999999);
  });

  it('serializes non-random artifact modifiers without modifier snapshots', () => {
    const model = composeProductFromAffixIds({
      productType: 'artifact',
      element: '金',
      name: '新版锋锐戒',
      affixIds: ['artifact-panel-atk'],
      requestedSlot: 'accessory',
      requestedQuality: '神品',
      realm: '渡劫',
      realmStage: '圆满',
    });

    const serialized = serializeProductModel(model);
    const affixes = serialized.affixes as Array<Record<string, unknown>>;

    expect(affixes[0]).not.toHaveProperty('modifierSelections');
    expect(affixes[0]).not.toHaveProperty('resolvedModifiers');
  });

  it('does not synthesize an artifact anchor when stored metadata is missing', () => {
    const model = composeProductFromAffixIds({
      productType: 'artifact',
      element: '金',
      name: '旧版基础剑',
      affixIds: ['artifact-panel-weapon-dual-atk'],
      requestedSlot: 'weapon',
      requestedQuality: '仙品',
    });
    const serialized = serializeProductModel(model);
    delete (serialized as { metadata?: unknown }).metadata;

    const rehydrated = deserializeAndRehydrate(serialized, '金');

    expect(rehydrated.productType).toBe('artifact');
    if (rehydrated.productType !== 'artifact') return;
    expect(rehydrated.metadata).toBeUndefined();
    expect(rehydrated.battleProjection.modifiers?.[0]?.value).toBeCloseTo(
      76,
      6,
    );
  });

  it('serializes random artifact modifiers as selections without values', () => {
    const model = composeProductFromAffixIds({
      productType: 'artifact',
      element: '金',
      name: '新版基础戒',
      affixIds: ['artifact-panel-accessory-utility'],
      requestedSlot: 'accessory',
      requestedQuality: '神品',
      realm: '金丹',
      realmStage: '圆满',
    });

    const serialized = serializeProductModel(model);
    const affixes = serialized.affixes as Array<{
      modifierSelections?: Array<Record<string, unknown>>;
    }>;

    expect(affixes[0].modifierSelections).toHaveLength(2);
    expect(affixes[0]).not.toHaveProperty('resolvedModifiers');
    expect(JSON.stringify(affixes[0].modifierSelections)).not.toContain(
      'value',
    );
  });

  it('uses stored random artifact selections to recompute values', () => {
    const model = composeProductFromAffixIds({
      productType: 'artifact',
      element: '金',
      name: '旧版基础戒',
      affixIds: ['artifact-panel-accessory-utility'],
      requestedSlot: 'accessory',
      requestedQuality: '神品',
      realm: '金丹',
      realmStage: '圆满',
    });
    const serialized = serializeProductModel(model);
    const affixes = serialized.affixes as Array<{
      modifierSelections?: Array<{ attrType: string; type: string }>;
      resolvedModifiers?: Array<{ attrType: string; type: string; value: number }>;
    }>;
    const storedSelections = affixes[0].modifierSelections ?? [];
    const storedAttrTypes = storedSelections.map(
      (modifier) => modifier.attrType,
    );
    affixes[0].resolvedModifiers = storedSelections.map((selection) => ({
      ...selection,
      value: 999999,
    }));
    delete affixes[0].modifierSelections;

    const rehydrated = deserializeAndRehydrate(serialized);

    expect(rehydrated.productType).toBe('artifact');
    expect(
      rehydrated.battleProjection.modifiers?.map((modifier) => modifier.attrType),
    ).toEqual(storedAttrTypes);
    expect(
      rehydrated.battleProjection.modifiers?.every(
        (modifier) => modifier.value !== 999999,
      ),
    ).toBe(true);
  });
});
