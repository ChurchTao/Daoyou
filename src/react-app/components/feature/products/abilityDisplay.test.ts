import { describe, expect, it } from 'vitest';
import { composeProductFromAffixIds } from '@shared/engine/creation-v2/composeProductFromAffixIds';
import { serializeProductModel } from '@shared/engine/creation-v2/persistence/ProductPersistenceMapper';
import { getArtifactRealmGrowthFactor } from '@shared/engine/shared/artifactRealmScaling';
import { toProductDisplayModel } from './abilityDisplay';

describe('abilityDisplay', () => {
  it('rehydrates stored productModel before building display state', () => {
    const model = composeProductFromAffixIds({
      productType: 'skill',
      element: '火',
      name: '赤炎术',
      affixIds: ['skill-core-damage-fire'],
    });

    const displayModel = toProductDisplayModel({
      name: model.name,
      productType: model.productType,
      element: '火',
      quality: model.projectionQuality,
      score: 18,
      productModel: serializeProductModel(model),
    });

    expect(displayModel.projection).toMatchObject({
      mpCost: model.battleProjection.mpCost,
      cooldown: model.battleProjection.cooldown,
      priority: model.battleProjection.priority,
      targetPolicy: model.battleProjection.targetPolicy,
    });
    expect(displayModel.affixes).toHaveLength(model.affixes.length);
    expect(displayModel.affixes[0]).toMatchObject({
      effectText: expect.stringContaining('火系法术伤害'),
      conditionTexts: [],
      buffDetails: [],
    });
  });

  it('tolerates legacy productModel payloads without productType', () => {
    const displayModel = toProductDisplayModel({
      name: '旧法宝',
      productType: 'artifact',
      quality: '凡品',
      score: 0,
      productModel: {
        affixes: [],
      },
    });

    expect(displayModel.name).toBe('旧法宝');
    expect(displayModel.productType).toBe('artifact');
    expect(displayModel.projection).toBeUndefined();
    expect(displayModel.affixes).toEqual([]);
  });

  it('builds structured affix details for skill, gongfa, and artifact products', () => {
    const skill = composeProductFromAffixIds({
      productType: 'skill',
      element: '火',
      name: '灼心术',
      affixIds: ['skill-core-damage-fire', 'skill-variant-burn-dot'],
    });
    const gongfa = composeProductFromAffixIds({
      productType: 'gongfa',
      element: '火',
      name: '火行真解',
      affixIds: ['gongfa-school-fire-spec'],
    });
    const artifact = composeProductFromAffixIds({
      productType: 'artifact',
      element: '水',
      name: '辟火甲',
      affixIds: ['artifact-defense-fire-resist'],
      requestedSlot: 'armor',
    });

    const skillDisplay = toProductDisplayModel({
      name: skill.name,
      productType: skill.productType,
      element: '火',
      quality: skill.projectionQuality,
      score: 18,
      productModel: serializeProductModel(skill),
    });
    const gongfaDisplay = toProductDisplayModel({
      name: gongfa.name,
      productType: gongfa.productType,
      element: '火',
      quality: gongfa.projectionQuality,
      score: 18,
      productModel: serializeProductModel(gongfa),
    });
    const artifactDisplay = toProductDisplayModel({
      name: artifact.name,
      productType: artifact.productType,
      element: '水',
      quality: artifact.projectionQuality,
      slot: 'armor',
      score: 18,
      productModel: serializeProductModel(artifact),
    });

    const burnAffix = skillDisplay.affixes.find(
      (affix) => affix.id === 'skill-variant-burn-dot',
    );
    expect(burnAffix?.buffDetails[0].name).toBe('灼烧');
    expect(gongfaDisplay.affixes[0].conditionTexts.join('、')).toContain(
      '火系',
    );
    expect(artifactDisplay.affixes[0].effectText).toContain('降低受到的伤害');
    expect(
      [
        ...(burnAffix?.tagLabels ?? []),
        ...gongfaDisplay.affixes[0].tagLabels,
        ...artifactDisplay.affixes[0].tagLabels,
      ].join('、'),
    ).not.toMatch(/Ability\.|Status\.|Buff\./);
  });

  it('renders only picked random artifact modifiers in affix text', () => {
    const artifact = composeProductFromAffixIds({
      productType: 'artifact',
      element: '金',
      name: '玄金戒',
      affixIds: ['artifact-panel-accessory-utility'],
      requestedSlot: 'accessory',
      requestedQuality: '仙品',
      realm: '化神',
      realmStage: '中期',
    });

    const displayModel = toProductDisplayModel({
      name: artifact.name,
      productType: artifact.productType,
      element: '金',
      quality: artifact.projectionQuality,
      slot: 'accessory',
      score: 18,
      productModel: serializeProductModel(artifact),
    });

    expect(displayModel.modifiers).toHaveLength(2);
    expect(displayModel.affixes[0].effectText.split('、')).toHaveLength(2);
    for (const modifier of displayModel.modifiers) {
      expect(displayModel.affixes[0].effectText).toContain(modifier.attrLabel);
    }
  });

  it('renders artifact affix text with realm-scaled modifier values', () => {
    const artifact = composeProductFromAffixIds({
      productType: 'artifact',
      element: '金',
      name: '化神金剑',
      affixIds: ['artifact-panel-weapon-dual-atk'],
      requestedSlot: 'weapon',
      requestedQuality: '仙品',
      realm: '化神',
      realmStage: '中期',
    });

    const displayModel = toProductDisplayModel({
      name: artifact.name,
      productType: artifact.productType,
      element: '金',
      quality: artifact.projectionQuality,
      slot: 'weapon',
      score: 18,
      productModel: serializeProductModel(artifact),
    });

    expect(displayModel.modifiers).toHaveLength(2);
    const expectedValue =
      (6 + 2.5 * 6) * getArtifactRealmGrowthFactor('化神', '中期');
    expect(displayModel.modifiers[0].raw.value).toBeCloseTo(expectedValue, 6);
    expect(displayModel.affixes[0].effectText).toContain('+101');
  });
});
