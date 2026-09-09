import { artifactSchema } from '@shared/contracts/resources/inventory';
import { projectAbilityConfig } from '@shared/engine/creation-v2/models/AbilityProjection';
import {
  deserializeAndRehydrate,
  serializeProductModel,
} from '@shared/engine/creation-v2/persistence/ProductPersistenceMapper';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import legacyProducts from './legacy-products.json';

describe('ProductRehydrator', () => {
  it('rebuilds skill battleProjection from productModel only', () => {
    const model = deserializeAndRehydrate(legacyProducts['赤炎术']);

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

  it('returns a JSON-safe runtime model without explicit undefined fields', () => {
    const model = deserializeAndRehydrate(legacyProducts['无漏法器']);

    const rehydrated = deserializeAndRehydrate(serializeProductModel(model));

    expect(z.json().safeParse(rehydrated).success).toBe(true);
  });

  it('keeps nested buff configs JSON-safe when optional listeners are absent', () => {
    const model = deserializeAndRehydrate(legacyProducts['吞雷瓶']);

    const rehydrated = deserializeAndRehydrate(serializeProductModel(model));

    expect(z.json().safeParse(rehydrated).success).toBe(true);
    expect(
      artifactSchema.safeParse({
        name: model.name,
        slot: 'accessory',
        element: '雷',
        abilityConfig: projectAbilityConfig(rehydrated),
        productModel: rehydrated,
      }).success,
    ).toBe(true);
  });

  it('preserves enemy pacing context when rebuilding skill battleProjection', () => {
    const model = deserializeAndRehydrate(legacyProducts['赤炎袭']);

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
    const model = deserializeAndRehydrate(legacyProducts['旧版赤炎术']);
    const serialized = serializeProductModel(model);
    delete serialized.projectionPacingContext;

    expect(() => deserializeAndRehydrate(serialized)).not.toThrow();
    const rehydrated = deserializeAndRehydrate(serialized);
    expect(rehydrated.productType).toBe('skill');
    expect(rehydrated.battleProjection.mpCost).toBeGreaterThan(0);
  });

  it('ignores legacy skill projectionAnchor when rebuilding mpCost', () => {
    const model = deserializeAndRehydrate(legacyProducts['旧版锚点赤炎术']);
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
    const model = deserializeAndRehydrate(legacyProducts['旧版锋锐戒']);
    const serialized = serializeProductModel(model);
    const affixes = serialized.affixes as Array<{
      resolvedModifiers?: Array<{
        attrType: string;
        type: string;
        value: number;
      }>;
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
    const model = deserializeAndRehydrate(legacyProducts['新版锋锐戒']);

    const serialized = serializeProductModel(model);
    const affixes = serialized.affixes as Array<Record<string, unknown>>;

    expect(affixes[0]).not.toHaveProperty('modifierSelections');
    expect(affixes[0]).not.toHaveProperty('resolvedModifiers');
  });

  it('does not synthesize an artifact anchor when stored metadata is missing', () => {
    const model = deserializeAndRehydrate(legacyProducts['旧版基础剑']);
    const serialized = serializeProductModel(model);
    delete (serialized as { metadata?: unknown }).metadata;

    const rehydrated = deserializeAndRehydrate(serialized, '金');

    expect(rehydrated.productType).toBe('artifact');
    if (rehydrated.productType !== 'artifact') return;
    expect(rehydrated.metadata).toBeUndefined();
    expect(rehydrated.battleProjection.modifiers?.[0]?.value).toBeCloseTo(
      21,
      6,
    );
  });

  it('serializes random artifact modifiers as selections without values', () => {
    const model = deserializeAndRehydrate(legacyProducts['新版基础戒']);

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
    const model = deserializeAndRehydrate(legacyProducts['旧版基础戒']);
    const serialized = serializeProductModel(model);
    const affixes = serialized.affixes as Array<{
      modifierSelections?: Array<{ attrType: string; type: string }>;
      resolvedModifiers?: Array<{
        attrType: string;
        type: string;
        value: number;
      }>;
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
      rehydrated.battleProjection.modifiers?.map(
        (modifier) => modifier.attrType,
      ),
    ).toEqual(storedAttrTypes);
    expect(
      rehydrated.battleProjection.modifiers?.every(
        (modifier) => modifier.value !== 999999,
      ),
    ).toBe(true);
  });
});
