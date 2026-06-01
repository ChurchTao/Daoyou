import { describe, expect, it } from 'vitest';
import type { Consumable } from '@shared/types/cultivator';
import type { PillSpec } from '@shared/types/consumable';
import { toPillDisplayModel } from './pillDisplay';

function createPill(spec: PillSpec, description = '炉火既定，自有丹评。') {
  return {
    id: 'pill-1',
    name: '测试丹',
    type: '丹药',
    quality: '玄品',
    quantity: 1,
    description,
    spec,
  } satisfies Consumable & { spec: PillSpec };
}

describe('toPillDisplayModel', () => {
  it('formats percent healing pills with a max-resource primary effect', () => {
    const model = toPillDisplayModel(
      createPill({
        kind: 'pill',
        family: 'healing',
        operations: [
          { type: 'restore_resource', resource: 'hp', mode: 'percent', value: 0.146 },
          { type: 'change_gauge', gauge: 'pillToxicity', delta: 4 },
        ],
        consumeRules: {
          scene: 'out_of_battle_only',
          quotaCategory: 'none',
        },
        alchemyMeta: {
          source: 'improvised',
          sourceMaterials: ['赤阳草'],
          stability: 62,
          toxicityRating: 18,
          tags: ['healing'],
        },
      }),
      { realm: '金丹' },
    );

    expect(model.primaryEffect).toBe('恢复最大气血 14.6%');
    expect(model.keywordLabels).toEqual(['疗伤', '丹毒 +4']);
  });

  it('combines hybrid hp and mp recovery into one primary line', () => {
    const model = toPillDisplayModel(
      createPill({
        kind: 'pill',
        family: 'hybrid',
        operations: [
          { type: 'restore_resource', resource: 'hp', mode: 'percent', value: 0.08 },
          { type: 'restore_resource', resource: 'mp', mode: 'percent', value: 0.06 },
          { type: 'change_gauge', gauge: 'pillToxicity', delta: 6 },
        ],
        consumeRules: {
          scene: 'out_of_battle_only',
          quotaCategory: 'none',
        },
        alchemyMeta: {
          source: 'improvised',
          sourceMaterials: ['双生露'],
          stability: 55,
          toxicityRating: 24,
          tags: ['healing', 'mana'],
        },
      }),
      { realm: '金丹' },
    );

    expect(model.primaryEffect).toBe('恢复最大气血 8% / 最大法力 6%');
  });

  it('treats detox pills as a benefit instead of a cost', () => {
    const model = toPillDisplayModel(
      createPill({
        kind: 'pill',
        family: 'detox',
        operations: [{ type: 'change_gauge', gauge: 'pillToxicity', delta: -18 }],
        consumeRules: {
          scene: 'out_of_battle_only',
          quotaCategory: 'none',
        },
        alchemyMeta: {
          source: 'improvised',
          sourceMaterials: ['净心叶'],
          stability: 71,
          toxicityRating: 0,
          tags: ['detox'],
        },
      }),
      { realm: '金丹' },
    );

    expect(model.primaryEffect).toBe('丹毒 -18');
    expect(model.detailGroups[0].lines).toContain('丹毒 -18');
    expect(model.detailGroups[1].lines).not.toContain('丹毒 -18');
  });

  it('uses condition templates for breakthrough status names', () => {
    const model = toPillDisplayModel(
      createPill({
        kind: 'pill',
        family: 'breakthrough',
        operations: [
          { type: 'add_status', status: 'breakthrough_focus', usesRemaining: 1 },
          { type: 'change_gauge', gauge: 'pillToxicity', delta: 12 },
        ],
        consumeRules: {
          scene: 'out_of_battle_only',
          quotaCategory: 'none',
        },
        alchemyMeta: {
          source: 'formula',
          formulaId: 'formula-1',
          sourceMaterials: ['凝神芝'],
          fitScore: 0.58,
          fitBand: 'degraded',
          fitMultiplier: 1.02,
          stability: 80,
          toxicityRating: 36,
          tags: ['breakthrough'],
          breakthroughTargetRealm: '元婴',
          breakthroughLabel: '护婴丹',
        },
      }),
      { realm: '金丹' },
    );

    expect(model.primaryEffect).toContain('护婴丹');
    expect(model.primaryEffect).toContain('破境凝神');
    expect(model.primaryEffect).not.toContain('breakthrough_focus');
    expect(model.keywordLabels).toContain('护婴丹');
    expect(
      model.keywordLabels.some((label) => label.startsWith('服用上限')),
    ).toBe(false);
    expect(model.detailGroups[2].lines).toContain('目标大境界：元婴');
    expect(model.detailGroups[2].lines).toContain('成丹层级：勉强成丹');
    expect(model.detailGroups[2].lines).toContain('药性拟合：58%');
    expect(model.detailGroups[2].lines).toContain('丹方倍率：102%');
    expect(
      model.detailGroups[1].lines.some((line) => line.startsWith('服用上限')),
    ).toBe(false);
  });

  it('renders clear_mind breakthrough pills without exposing the raw status key', () => {
    const model = toPillDisplayModel(
      createPill({
        kind: 'pill',
        family: 'breakthrough',
        operations: [
          { type: 'add_status', status: 'clear_mind', usesRemaining: 1 },
          { type: 'change_gauge', gauge: 'pillToxicity', delta: 10 },
        ],
        consumeRules: {
          scene: 'out_of_battle_only',
          quotaCategory: 'none',
        },
        alchemyMeta: {
          source: 'formula',
          formulaId: 'formula-2',
          sourceMaterials: ['静神芝'],
          fitScore: 0.76,
          fitBand: 'aligned',
          fitMultiplier: 1.08,
          stability: 82,
          toxicityRating: 24,
          tags: ['clear_mind_support', 'breakthrough'],
          breakthroughTargetRealm: '元婴',
          breakthroughLabel: '护婴丹',
        },
      }),
      { realm: '金丹' },
    );

    expect(model.primaryEffect).toContain('护婴丹');
    expect(model.primaryEffect).toContain('清心');
    expect(model.primaryEffect).not.toContain('clear_mind');
    expect(model.keywordLabels).toContain('护婴丹');
    expect(model.detailGroups[2].lines).toContain('目标大境界：元婴');
    expect(model.detailGroups[2].lines).toContain('成丹层级：契合成丹');
  });

  it('renders protect_meridians breakthrough pills with the shared higher-realm label fallback', () => {
    const model = toPillDisplayModel(
      createPill({
        kind: 'pill',
        family: 'breakthrough',
        operations: [
          { type: 'add_status', status: 'protect_meridians', usesRemaining: 1 },
          { type: 'change_gauge', gauge: 'pillToxicity', delta: 12 },
        ],
        consumeRules: {
          scene: 'out_of_battle_only',
          quotaCategory: 'none',
        },
        alchemyMeta: {
          source: 'formula',
          formulaId: 'formula-3',
          sourceMaterials: ['护络藤'],
          fitScore: 0.81,
          fitBand: 'aligned',
          fitMultiplier: 1.12,
          stability: 78,
          toxicityRating: 26,
          tags: ['protect_meridians_support', 'breakthrough'],
          breakthroughTargetRealm: '渡劫',
        },
      }),
      { realm: '大乘' },
    );

    expect(model.primaryEffect).toContain('应劫丹');
    expect(model.primaryEffect).toContain('护脉');
    expect(model.primaryEffect).not.toContain('protect_meridians');
    expect(model.keywordLabels).toContain('应劫丹');
    expect(model.detailGroups[2].lines).toContain('目标大境界：渡劫');
  });

  it('omits formula fit lines when legacy formula metadata is incomplete', () => {
    const model = toPillDisplayModel(
      createPill({
        kind: 'pill',
        family: 'healing',
        operations: [
          { type: 'restore_resource', resource: 'hp', mode: 'percent', value: 0.12 },
        ],
        consumeRules: {
          scene: 'out_of_battle_only',
          quotaCategory: 'none',
        },
        alchemyMeta: {
          source: 'formula',
          formulaId: 'formula-legacy',
          sourceMaterials: ['回春草'],
          stability: 72,
          toxicityRating: 8,
          tags: ['healing'],
        } as unknown as PillSpec['alchemyMeta'],
      }),
      { realm: '金丹' },
    );

    expect(model.detailGroups[2].lines).not.toContain('成丹层级：勉强成丹');
    expect(model.detailGroups[2].lines.some((line) => line.includes('NaN'))).toBe(
      false,
    );
  });

  it('uses track config names for tempering and marrow-wash pills', () => {
    const temperingModel = toPillDisplayModel(
      createPill({
        kind: 'pill',
        family: 'tempering',
        operations: [
          { type: 'advance_track', track: 'tempering.vitality', value: 40 },
          { type: 'change_gauge', gauge: 'pillToxicity', delta: 10 },
        ],
        consumeRules: {
          scene: 'out_of_battle_only',
          quotaCategory: 'long_term',
        },
        alchemyMeta: {
          source: 'improvised',
          sourceMaterials: ['铁骨藤'],
          stability: 49,
          toxicityRating: 28,
          tags: ['tempering_vitality'],
        },
      }),
      { realm: '金丹' },
    );
    const marrowModel = toPillDisplayModel(
      createPill({
        kind: 'pill',
        family: 'marrow_wash',
        operations: [
          { type: 'advance_track', track: 'marrow_wash', value: 40 },
          { type: 'change_gauge', gauge: 'pillToxicity', delta: 14 },
        ],
        consumeRules: {
          scene: 'out_of_battle_only',
          quotaCategory: 'long_term',
        },
        alchemyMeta: {
          source: 'improvised',
          sourceMaterials: ['洗髓花'],
          stability: 58,
          toxicityRating: 34,
          tags: ['marrow_wash'],
        },
      }),
      { realm: '金丹' },
    );

    expect(temperingModel.primaryEffect).toBe('推进炼体·体魄 +40');
    expect(marrowModel.primaryEffect).toBe('推进洗髓 +40');
  });

  it('formats cultivation pills with progress gain and a dedicated quota label', () => {
    const model = toPillDisplayModel(
      createPill({
        kind: 'pill',
        family: 'cultivation',
        operations: [
          {
            type: 'gain_progress',
            target: 'cultivation_exp',
            value: 498,
          },
          { type: 'change_gauge', gauge: 'pillToxicity', delta: 9 },
        ],
        consumeRules: {
          scene: 'out_of_battle_only',
          quotaCategory: 'cultivation',
        },
        alchemyMeta: {
          source: 'improvised',
          sourceMaterials: ['金霞芝'],
          stability: 72,
          toxicityRating: 18,
          tags: ['cultivation'],
        },
      }),
      { realm: '金丹' },
    );

    expect(model.primaryEffect).toBe('修为 +498');
    expect(model.keywordLabels).toEqual(['修为', '服用上限 30 次', '丹毒 +9']);
    expect(model.detailGroups[0].lines).toContain('修为 +498');
  });

  it('formats insight pills without any usage-limit label', () => {
    const model = toPillDisplayModel(
      createPill({
        kind: 'pill',
        family: 'insight',
        operations: [
          {
            type: 'gain_progress',
            target: 'comprehension_insight',
            value: 8,
          },
          { type: 'change_gauge', gauge: 'pillToxicity', delta: 5 },
        ],
        consumeRules: {
          scene: 'out_of_battle_only',
          quotaCategory: 'none',
        },
        alchemyMeta: {
          source: 'improvised',
          sourceMaterials: ['寒魄晶'],
          stability: 70,
          toxicityRating: 12,
          tags: ['insight'],
        },
      }),
      { realm: '金丹' },
    );

    expect(model.primaryEffect).toBe('道心感悟 +8');
    expect(model.keywordLabels).toEqual(['感悟', '丹毒 +5']);
    expect(model.detailGroups[1].lines).not.toContain('服用上限：30 次');
  });
});
