import type { CultivatorCondition } from '@shared/types/condition';
import type { PillSpec } from '@shared/types/consumable';
import type { Consumable } from '@shared/types/cultivator';
import { describe, expect, it } from 'vitest';
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

function createCondition(
  counters: Partial<CultivatorCondition['counters']> = {},
): CultivatorCondition {
  return {
    version: 1,
    resources: {
      hp: { current: 0 },
      mp: { current: 0 },
    },
    gauges: {
      pillToxicity: 0,
    },
    tracks: {
      tempering: {
        vitality: { level: 0, progress: 0 },
        spirit: { level: 0, progress: 0 },
        wisdom: { level: 0, progress: 0 },
        speed: { level: 0, progress: 0 },
        willpower: { level: 0, progress: 0 },
      },
      marrowWash: { level: 0, progress: 0 },
    },
    counters: {
      longTermPillUsesByRealm: {},
      cultivationPillUsesByRealm: {},
      longevityPillUsesByRealm: {},
      ...counters,
    },
    statuses: [],
    timestamps: {},
  };
}

describe('toPillDisplayModel', () => {
  it('formats percent healing pills with a max-resource primary effect', () => {
    const model = toPillDisplayModel(
      createPill({
        kind: 'pill',
        family: 'healing',
        operations: [
          {
            type: 'restore_resource',
            resource: 'hp',
            mode: 'percent',
            value: 0.146,
          },
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
          {
            type: 'restore_resource',
            resource: 'hp',
            mode: 'percent',
            value: 0.08,
          },
          {
            type: 'restore_resource',
            resource: 'mp',
            mode: 'percent',
            value: 0.06,
          },
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

  it('builds a full effect summary for list cards with multiple non-cost effects', () => {
    const model = toPillDisplayModel(
      createPill({
        kind: 'pill',
        family: 'healing',
        operations: [
          {
            type: 'restore_resource',
            resource: 'hp',
            mode: 'percent',
            value: 0.12,
          },
          {
            type: 'restore_resource',
            resource: 'mp',
            mode: 'percent',
            value: 0.08,
          },
          { type: 'add_status', status: 'clear_mind', usesRemaining: 1 },
          { type: 'change_gauge', gauge: 'pillToxicity', delta: 7 },
        ],
        consumeRules: {
          scene: 'out_of_battle_only',
          quotaCategory: 'none',
        },
        alchemyMeta: {
          source: 'improvised',
          sourceMaterials: ['双生露'],
          stability: 68,
          toxicityRating: 21,
          tags: ['healing', 'mana', 'clear_mind_support'],
        },
      }),
      { realm: '金丹' },
    );

    expect(model.primaryEffect).toBe('恢复最大气血 12%');
    expect(model.effectSummary).toBe(
      '恢复最大气血 12% / 恢复最大法力 8% / 获得「清心」（可用 1 次）',
    );
  });

  it('treats detox pills as a benefit instead of a cost', () => {
    const model = toPillDisplayModel(
      createPill({
        kind: 'pill',
        family: 'detox',
        operations: [
          { type: 'change_gauge', gauge: 'pillToxicity', delta: -18 },
        ],
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

  it('renders longevity pills with lifespan gain and isolated quota text', () => {
    const model = toPillDisplayModel(
      createPill({
        kind: 'pill',
        family: 'longevity',
        operations: [
          { type: 'increase_lifespan', value: 58 },
          { type: 'change_gauge', gauge: 'pillToxicity', delta: 9 },
        ],
        consumeRules: {
          scene: 'out_of_battle_only',
          quotaCategory: 'longevity',
        },
        alchemyMeta: {
          source: 'improvised',
          sourceMaterials: ['寿元果'],
          stability: 76,
          toxicityRating: 18,
          tags: ['extend_lifespan', 'longevity'],
        },
      }),
      { realm: '筑基' },
    );

    expect(model.primaryEffect).toBe('寿元 +58 年');
    expect(model.keywordLabels).toEqual([
      '延寿',
      '寿元 +58 年',
      '寿元丹上限 8 次',
    ]);
    expect(model.detailGroups[0].lines).toContain('寿元 +58 年');
    expect(model.detailGroups[1].lines).toContain('寿元丹服用上限：8 次');
  });

  it('uses condition templates for breakthrough status names', () => {
    const model = toPillDisplayModel(
      createPill({
        kind: 'pill',
        family: 'breakthrough',
        operations: [
          {
            type: 'add_status',
            status: 'breakthrough_focus',
            usesRemaining: 1,
          },
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

    expect(model.primaryEffect).not.toContain('护婴丹');
    expect(model.primaryEffect).toContain('清心');
    expect(model.primaryEffect).not.toContain('clear_mind');
    expect(model.keywordLabels).not.toContain('护婴丹');
    expect(model.detailGroups[2].lines).toContain('目标大境界：元婴');
    expect(model.detailGroups[2].lines).toContain('成丹层级：契合成丹');
  });

  it('renders protect_meridians breakthrough pills without fixed breakthrough names', () => {
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

    expect(model.primaryEffect).not.toContain('应劫丹');
    expect(model.primaryEffect).toContain('护脉');
    expect(model.primaryEffect).not.toContain('protect_meridians');
    expect(model.keywordLabels).not.toContain('应劫丹');
    expect(model.detailGroups[2].lines).toContain('目标大境界：渡劫');
  });

  it('omits formula fit lines when legacy formula metadata is incomplete', () => {
    const model = toPillDisplayModel(
      createPill({
        kind: 'pill',
        family: 'healing',
        operations: [
          {
            type: 'restore_resource',
            resource: 'hp',
            mode: 'percent',
            value: 0.12,
          },
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
    expect(
      model.detailGroups[2].lines.some((line) => line.includes('NaN')),
    ).toBe(false);
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
    expect(model.detailGroups[1].lines).toContain('服用上限：30 次');
  });

  it('formats cultivation pill remaining uses from the current condition', () => {
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
      {
        realm: '金丹',
        condition: createCondition({
          cultivationPillUsesByRealm: { 金丹: 12 },
        }),
      },
    );

    expect(model.keywordLabels).toEqual(['修为', '剩余 18/30', '丹毒 +9']);
    expect(model.detailGroups[1].lines).toContain(
      '本境界已服 12/30，尚可服 18 颗',
    );
  });

  it('formats long-term pill remaining uses from the matching counter', () => {
    const model = toPillDisplayModel(
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
      {
        realm: '筑基',
        condition: createCondition({
          longTermPillUsesByRealm: { 筑基: 7 },
        }),
      },
    );

    expect(model.keywordLabels).toEqual(['炼体', '剩余 1/8', '丹毒 +10']);
    expect(model.detailGroups[1].lines).toContain(
      '本境界已服 7/8，尚可服 1 颗',
    );
  });

  it('falls back to realm-variable quota text when legacy realm data has no configured limit', () => {
    const model = toPillDisplayModel(
      createPill({
        kind: 'pill',
        family: 'tempering',
        operations: [
          { type: 'advance_track', track: 'tempering.spirit', value: 40 },
          { type: 'change_gauge', gauge: 'pillToxicity', delta: 10 },
        ],
        consumeRules: {
          scene: 'out_of_battle_only',
          quotaCategory: 'long_term',
        },
        alchemyMeta: {
          source: 'improvised',
          sourceMaterials: ['赤髓藤'],
          stability: 49,
          toxicityRating: 28,
          tags: ['tempering_spirit'],
        },
      }),
      {
        realm: '旧境界' as never,
        condition: createCondition({
          longTermPillUsesByRealm: { 旧境界: 2 } as never,
        }),
      },
    );

    expect(model.keywordLabels).toEqual([
      '炼体',
      '服用上限随境界变化',
      '丹毒 +10',
    ]);
    expect(model.detailGroups[1].lines).toContain('服用上限：随当前境界变化');
    expect(model.keywordLabels.join(' ')).not.toContain('NaN');
    expect(model.keywordLabels.join(' ')).not.toContain('undefined');
  });

  it('treats legacy conditions without counters as zero used instead of crashing', () => {
    const model = toPillDisplayModel(
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
      {
        realm: '筑基',
        condition: { ...createCondition(), counters: undefined } as never,
      },
    );

    expect(model.keywordLabels).toEqual(['炼体', '剩余 8/8', '丹毒 +10']);
    expect(model.detailGroups[1].lines).toContain(
      '本境界已服 0/8，尚可服 8 颗',
    );
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

    expect(model.primaryEffect).toBe('感悟 +8');
    expect(model.keywordLabels).toEqual(['感悟', '丹毒 +5']);
    expect(model.detailGroups[1].lines).not.toContain('服用上限：30 次');
    expect(model.keywordLabels.some((label) => label.startsWith('剩余'))).toBe(
      false,
    );
  });
});
