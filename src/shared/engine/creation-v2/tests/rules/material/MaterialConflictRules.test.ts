import { detectMaterialConflicts } from '@shared/engine/creation-v2/rules/material/MaterialConflictRules';
import { MaterialFingerprint } from '@shared/engine/creation-v2/types';

describe('detectMaterialConflicts', () => {
  it('应识别火冰混炉冲突', () => {
    const conflicts = detectMaterialConflicts(
      [
        {
          materialName: '赤炎精铁',
          materialType: 'ore',
          rank: '玄品',
          quantity: 1,
          explicitTags: ['Material.Element.Fire'],
          semanticTags: [],
          recipeTags: ['Recipe.ProductBias.Artifact'],
          energyValue: 8,
          rarityWeight: 2,
          element: '火',
        },
        {
          materialName: '玄冰玉髓',
          materialType: 'ore',
          rank: '玄品',
          quantity: 1,
          explicitTags: ['Material.Element.Ice'],
          semanticTags: [],
          recipeTags: ['Recipe.ProductBias.Artifact'],
          energyValue: 8,
          rarityWeight: 2,
          element: '冰',
        },
      ] as MaterialFingerprint[],
      'artifact',
    );

    expect(conflicts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'element-fire-ice' }),
      ]),
    );
  });

  it('应识别技能秘籍与功法秘籍混用冲突', () => {
    const conflicts = detectMaterialConflicts(
      [
        {
          materialName: '赤炎诀',
          materialType: 'skill_manual',
          rank: '灵品',
          quantity: 1,
          explicitTags: ['Material.Type.Manual'],
          semanticTags: [],
          recipeTags: ['Recipe.ProductBias.Skill'],
          energyValue: 10,
          rarityWeight: 3,
        },
        {
          materialName: '归元经',
          materialType: 'gongfa_manual',
          rank: '灵品',
          quantity: 1,
          explicitTags: ['Material.Type.Manual'],
          semanticTags: [],
          recipeTags: ['Recipe.ProductBias.GongFa'],
          energyValue: 10,
          rarityWeight: 3,
        },
      ] as MaterialFingerprint[],
      'skill',
    );

    expect(conflicts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'manual-split-intent' }),
      ]),
    );
  });

  it('应识别秘籍法宝冲突', () => {
    const conflicts = detectMaterialConflicts(
      [
        {
          materialName: '百炼器经',
          materialType: 'gongfa_manual',
          rank: '玄品',
          quantity: 1,
          explicitTags: ['Material.Type.Manual'],
          semanticTags: [],
          recipeTags: ['Recipe.ProductBias.GongFa'],
          energyValue: 8,
          rarityWeight: 2,
        },
      ] as MaterialFingerprint[],
      'artifact',
    );

    expect(conflicts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'artifact-manual-forbidden' }),
      ]),
    );
  });

  it('应禁止灵药参与法宝炼制', () => {
    const conflicts = detectMaterialConflicts(
      [
        {
          materialName: '九叶灵芝',
          materialType: 'herb',
          rank: '灵品',
          quantity: 1,
          explicitTags: ['Material.Type.Herb'],
          semanticTags: [],
          recipeTags: ['Recipe.ProductBias.GongFa'],
          energyValue: 8,
          rarityWeight: 2,
        },
      ] as MaterialFingerprint[],
      'artifact',
    );

    expect(conflicts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'artifact-herb-forbidden' }),
      ]),
    );
  });

  it('应禁止功法秘籍参与神通推演', () => {
    const conflicts = detectMaterialConflicts(
      [
        {
          materialName: '归元经',
          materialType: 'gongfa_manual',
          rank: '灵品',
          quantity: 1,
          explicitTags: ['Material.Type.Manual.GongFa'],
          semanticTags: [],
          recipeTags: ['Recipe.ProductBias.GongFa'],
          energyValue: 10,
          rarityWeight: 3,
        },
      ] as MaterialFingerprint[],
      'skill',
    );

    expect(conflicts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'skill-gongfa-manual-forbidden' }),
      ]),
    );
  });

  it('应禁止矿石参与功法参悟', () => {
    const conflicts = detectMaterialConflicts(
      [
        {
          materialName: '赤炎精铁',
          materialType: 'ore',
          rank: '灵品',
          quantity: 1,
          explicitTags: ['Material.Type.Ore'],
          semanticTags: [],
          recipeTags: ['Recipe.ProductBias.Artifact'],
          energyValue: 9,
          rarityWeight: 3,
        },
      ] as MaterialFingerprint[],
      'gongfa',
    );

    expect(conflicts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'gongfa-ore-forbidden' }),
      ]),
    );
  });
});
