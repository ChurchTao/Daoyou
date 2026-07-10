import { PILL_TOXICITY_CAP } from '@shared/config/consumableSystem';
import { resolveLiveExpCap } from '@server/utils/cultivationUtils';
import { getMarrowWashSummary } from '@shared/lib/marrowWash';
import type {
  BodyCultivationRealm,
  CultivatorCondition,
} from '@shared/types/condition';
import type { PillFamily, PillSpec } from '@shared/types/consumable';
import type { Consumable, Cultivator } from '@shared/types/cultivator';
import { describe, expect, it } from 'vitest';
import { PillOperationExecutor } from './PillOperationExecutor';

const NOW = new Date('2026-07-01T00:00:00.000Z');

function createCondition(
  pillToxicity: number,
  counters: Partial<CultivatorCondition['counters']> = {},
): CultivatorCondition {
  return {
    version: 1,
    resources: {
      hp: { current: 120 },
      mp: { current: 80 },
    },
    gauges: {
      pillToxicity,
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
      bodyCultivationPillUses: 0,
      ...counters,
    },
    statuses: [],
    timestamps: {
      lastRecoveryAt: NOW.toISOString(),
    },
  };
}

function withBodyCultivationTrack(args: {
  condition: CultivatorCondition;
  realm: BodyCultivationRealm;
  skin: { level: number; progress: number };
}): CultivatorCondition {
  return {
    ...args.condition,
    tracks: {
      ...args.condition.tracks,
      bodyCultivation: {
        version: 1,
        realm: args.realm,
        milestones: {},
        tracks: {
          skin: args.skin,
          sinew_bone: { level: 0, progress: 0 },
          organs: { level: 0, progress: 0 },
          qi_blood: { level: 0, progress: 0 },
          primordial_spirit: { level: 0, progress: 0 },
        },
      },
    },
  };
}

function createCultivator(condition: CultivatorCondition): Cultivator {
  return {
    id: 'cultivator-1',
    name: '九千幽',
    gender: '女',
    realm: '筑基',
    realm_stage: '初期',
    age: 30,
    lifespan: 180,
    attributes: {
      vitality: 10,
      spirit: 10,
      wisdom: 10,
      speed: 10,
      willpower: 10,
    },
    spiritual_roots: [],
    pre_heaven_fates: [],
    cultivations: [],
    skills: [],
    inventory: {
      artifacts: [],
      consumables: [],
      materials: [],
    },
    equipped: {
      weapon: null,
      armor: null,
      accessory: null,
    },
    spirit_stones: 0,
    unallocated_attribute_points: 0,
    condition,
  };
}

function createPill(
  family: PillFamily,
  operations: PillSpec['operations'],
  quotaCategory: PillSpec['consumeRules']['quotaCategory'] = 'none',
): Consumable & { spec: PillSpec } {
  return {
    id: 'pill-1',
    name: '测试丹',
    type: '丹药',
    quality: '玄品',
    quantity: 1,
    description: '测试丹药。',
    spec: {
      kind: 'pill',
      family,
      operations,
      consumeRules: {
        scene: 'out_of_battle_only',
        quotaCategory,
      },
      alchemyMeta: {
        source: 'improvised',
        sourceMaterials: ['测试药材'],
        analysisVersion: 2,
        propertyVector: [],
        sourceMaterialVectors: [],
        stability: 80,
        toxicityRating: 10,
        tags: [family],
      },
    },
  };
}

describe('PillOperationExecutor toxicity and quota rules', () => {
  it('rejects positive-toxicity pills when pill toxicity is capped', () => {
    const cultivator = createCultivator(createCondition(PILL_TOXICITY_CAP));
    const pill = createPill('healing', [
      { type: 'change_gauge', gauge: 'pillToxicity', delta: 1 },
    ]);

    expect(() => PillOperationExecutor.execute(cultivator, pill, NOW)).toThrow(
      '请先炼制或服用解毒丹化解丹毒',
    );
  });

  it('allows positive-toxicity pills below the cap and clamps the result', () => {
    const cultivator = createCultivator(createCondition(PILL_TOXICITY_CAP - 1));
    const pill = createPill('healing', [
      { type: 'change_gauge', gauge: 'pillToxicity', delta: 10 },
    ]);

    const result = PillOperationExecutor.execute(cultivator, pill, NOW);

    expect(result.cultivator.condition?.gauges.pillToxicity).toBe(
      PILL_TOXICITY_CAP,
    );
  });

  it('allows detox and net non-positive toxicity pills at the cap', () => {
    const detox = PillOperationExecutor.execute(
      createCultivator(createCondition(PILL_TOXICITY_CAP)),
      createPill('detox', [
        { type: 'change_gauge', gauge: 'pillToxicity', delta: -12 },
      ]),
      NOW,
    );
    const balanced = PillOperationExecutor.execute(
      createCultivator(createCondition(PILL_TOXICITY_CAP)),
      createPill('hybrid', [
        { type: 'change_gauge', gauge: 'pillToxicity', delta: 8 },
        { type: 'change_gauge', gauge: 'pillToxicity', delta: -8 },
      ]),
      NOW,
    );

    expect(detox.cultivator.condition?.gauges.pillToxicity).toBe(
      PILL_TOXICITY_CAP - 12,
    );
    expect(balanced.cultivator.condition?.gauges.pillToxicity).toBe(
      PILL_TOXICITY_CAP - 8,
    );
  });

  it('allows body cultivation and marrow-wash pills despite historical usage counts', () => {
    const bodyResult = PillOperationExecutor.execute(
      createCultivator(
        createCondition(0, {
          bodyCultivationPillUses: 5000,
          longTermPillUsesByRealm: { 筑基: 999 },
        }),
      ),
      createPill(
        'tempering',
        [{ type: 'advance_track', track: 'body.skin', value: 40 }],
        'long_term',
      ),
      NOW,
    );
    const marrowResult = PillOperationExecutor.execute(
      createCultivator(
        createCondition(0, {
          longTermPillUsesByRealm: { 筑基: 999 },
        }),
      ),
      createPill(
        'marrow_wash',
        [{ type: 'advance_track', track: 'marrow_wash', value: 40 }],
        'long_term',
      ),
      NOW,
    );

    expect(
      bodyResult.cultivator.condition?.counters.bodyCultivationPillUses,
    ).toBe(5000);
    expect(
      bodyResult.cultivator.condition?.tracks.bodyCultivation?.tracks.skin
        .progress,
    ).toBe(40);
    expect(marrowResult.cultivator.condition?.tracks.marrowWash.progress).toBe(
      40,
    );
  });

  it('allows cultivation progress pills to overflow the current stage cap', () => {
    const cultivator = createCultivator(createCondition(0));
    const cap = resolveLiveExpCap(cultivator.realm, cultivator.realm_stage);
    cultivator.cultivation_progress = {
      cultivation_exp: cap - 5,
      exp_cap: cap,
      comprehension_insight: 0,
      breakthrough_failures: 0,
      bottleneck_state: false,
      inner_demon: false,
      deviation_risk: 0,
    };
    const pill = createPill('cultivation', [
      { type: 'gain_progress', target: 'cultivation_exp', value: 12 },
    ]);

    const result = PillOperationExecutor.execute(cultivator, pill, NOW);

    expect(result.cultivator.cultivation_progress?.cultivation_exp).toBe(cap + 7);
  });

  it('rejects body cultivation pills when the current body realm track cap is reached', () => {
    const cultivator = createCultivator(
      withBodyCultivationTrack({
        condition: createCondition(0),
        realm: 'iron_bone',
        skin: { level: 15, progress: 0 },
      }),
    );
    const pill = createPill('tempering', [
      { type: 'advance_track', track: 'body.skin', value: 1 },
    ]);

    expect(() => PillOperationExecutor.execute(cultivator, pill, NOW)).toThrow(
      '单轨上限 Lv.15',
    );
  });

  it('rejects body cultivation pills when their progress would exceed the current track cap', () => {
    const cultivator = createCultivator(
      withBodyCultivationTrack({
        condition: createCondition(0),
        realm: 'iron_bone',
        skin: { level: 14, progress: 1070 },
      }),
    );
    const pill = createPill('tempering', [
      { type: 'advance_track', track: 'body.skin', value: 11 },
    ]);

    expect(() => PillOperationExecutor.execute(cultivator, pill, NOW)).toThrow(
      '本次药力将超过当前肉身境界',
    );
  });

  it('allows body cultivation pills that land exactly on the current track cap', () => {
    const cultivator = createCultivator(
      withBodyCultivationTrack({
        condition: createCondition(0),
        realm: 'iron_bone',
        skin: { level: 14, progress: 1070 },
      }),
    );
    const pill = createPill('tempering', [
      { type: 'advance_track', track: 'body.skin', value: 10 },
    ]);

    const result = PillOperationExecutor.execute(cultivator, pill, NOW);

    expect(
      result.cultivator.condition?.tracks.bodyCultivation?.tracks.skin,
    ).toEqual({
      level: 15,
      progress: 0,
    });
  });

  it('allows dharma body pills to land exactly on the raised track cap', () => {
    const cultivator = createCultivator(
      withBodyCultivationTrack({
        condition: createCondition(0),
        realm: 'dharma_body',
        skin: { level: 44, progress: 3170 },
      }),
    );
    const pill = createPill('tempering', [
      { type: 'advance_track', track: 'body.skin', value: 10 },
    ]);

    const result = PillOperationExecutor.execute(cultivator, pill, NOW);

    expect(
      result.cultivator.condition?.tracks.bodyCultivation?.tracks.skin,
    ).toEqual({
      level: 45,
      progress: 0,
    });
  });

  it('rejects dharma body pills when their progress would exceed the raised track cap', () => {
    const cultivator = createCultivator(
      withBodyCultivationTrack({
        condition: createCondition(0),
        realm: 'dharma_body',
        skin: { level: 44, progress: 3170 },
      }),
    );
    const pill = createPill('tempering', [
      { type: 'advance_track', track: 'body.skin', value: 11 },
    ]);

    expect(() => PillOperationExecutor.execute(cultivator, pill, NOW)).toThrow(
      '单轨上限 Lv.45',
    );
  });

  it('marrow-wash pills grant free attribute points on level up without changing roots', () => {
    const cultivator = createCultivator({
      ...createCondition(0),
      tracks: {
        ...createCondition(0).tracks,
        marrowWash: { level: 0, progress: 110 },
      },
    });
    cultivator.spiritual_roots = [
      {
        element: '木',
        strength: 88,
        baseStrength: 88,
        marrowWashBonus: 0,
        grade: '真灵根',
      },
    ];
    const pill = createPill('marrow_wash', [
      { type: 'advance_track', track: 'marrow_wash', value: 10 },
    ]);

    const result = PillOperationExecutor.execute(cultivator, pill, NOW);

    expect(result.cultivator.condition?.tracks.marrowWash).toMatchObject({
      level: 1,
      progress: 0,
    });
    expect(result.cultivator.unallocated_attribute_points).toBe(1);
    expect(result.cultivator.spiritual_roots).toEqual(cultivator.spiritual_roots);
  });

  it('normalizes legacy marrow-wash state while applying pill progress', () => {
    const cultivator = createCultivator({
      ...createCondition(0),
      tracks: {
        ...createCondition(0).tracks,
        marrowWash: { level: 1, progress: 10 },
      },
    });
    const pill = createPill('marrow_wash', [
      { type: 'advance_track', track: 'marrow_wash', value: 5 },
    ]);

    const result = PillOperationExecutor.execute(cultivator, pill, NOW);

    expect(result.cultivator.condition?.tracks.marrowWash).toMatchObject({
      version: 1,
      level: 1,
      progress: 15,
      realm: 0,
      breakthroughs: 0,
    });
  });

  it('rejects marrow-wash pills when their progress would exceed the cultivation realm cap', () => {
    const cultivator = createCultivator({
      ...createCondition(0),
      tracks: {
        ...createCondition(0).tracks,
        marrowWash: { level: 9, progress: 650 },
      },
    });
    cultivator.realm = '炼气';
    const pill = createPill('marrow_wash', [
      { type: 'advance_track', track: 'marrow_wash', value: 11 },
    ]);

    expect(() => PillOperationExecutor.execute(cultivator, pill, NOW)).toThrow(
      '洗髓等级上限 Lv.10',
    );
  });

  it('allows marrow-wash pills that land exactly on the cultivation realm cap', () => {
    const cultivator = createCultivator({
      ...createCondition(0),
      tracks: {
        ...createCondition(0).tracks,
        marrowWash: { level: 9, progress: 650 },
      },
    });
    cultivator.realm = '炼气';
    const pill = createPill('marrow_wash', [
      { type: 'advance_track', track: 'marrow_wash', value: 10 },
    ]);

    const result = PillOperationExecutor.execute(cultivator, pill, NOW);

    expect(result.cultivator.condition?.tracks.marrowWash).toMatchObject({
      level: 10,
      progress: 0,
    });
    expect(result.cultivator.unallocated_attribute_points).toBe(1);
  });

  it('preserves marrow-wash breakthrough state when pills advance progress after a breakthrough', () => {
    const cultivator = createCultivator({
      ...createCondition(0),
      tracks: {
        ...createCondition(0).tracks,
        marrowWash: {
          version: 1,
          level: 10,
          progress: 0,
          realm: 1,
          breakthroughs: 1,
        },
      },
    });
    const pill = createPill('marrow_wash', [
      { type: 'advance_track', track: 'marrow_wash', value: 720 },
    ]);

    const result = PillOperationExecutor.execute(cultivator, pill, NOW);
    const marrowWash = result.cultivator.condition?.tracks.marrowWash;

    expect(marrowWash).toMatchObject({
      version: 1,
      level: 11,
      progress: 0,
      realm: 1,
      breakthroughs: 1,
    });
    expect(
      getMarrowWashSummary(result.cultivator.condition, {
        cultivatorRealm: result.cultivator.realm,
      }),
    ).toMatchObject({
      nextBreakthroughLevel: 20,
      canBreakthrough: false,
    });
  });
});
