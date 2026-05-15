import { REALM_PILL_USAGE_LIMITS } from '@shared/config/consumableSystem';
import type { CultivatorCondition } from '@shared/types/condition';
import type { PillSpec } from '@shared/types/consumable';
import type { Consumable, Cultivator } from '@shared/types/cultivator';
import { ConditionService } from './ConditionService';
import { PillOperationExecutor } from './PillOperationExecutor';

function createCultivator(): Cultivator {
  return {
    id: 'c1',
    name: '韩立',
    gender: '男',
    realm: '筑基',
    realm_stage: '初期',
    age: 30,
    lifespan: 180,
    status: 'active',
    attributes: {
      vitality: 40,
      spirit: 36,
      wisdom: 30,
      speed: 28,
      willpower: 32,
    },
    spiritual_roots: [
      { element: '木', strength: 80, grade: '真灵根' },
      { element: '水', strength: 99, grade: '真灵根' },
    ],
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
    max_skills: 4,
    spirit_stones: 0,
  };
}

function createPill(
  name: string,
  spec: PillSpec,
): Consumable {
  return {
    id: `${name}-id`,
    name,
    type: '丹药',
    quality: '真品',
    quantity: 1,
    spec,
  };
}

describe('PillOperationExecutor', () => {
  it('sorts operations in the documented execution order', () => {
    const sorted = PillOperationExecutor.sortOperations([
      { type: 'advance_track', track: 'tempering.vitality', value: 10 },
      { type: 'add_status', status: 'clear_mind' },
      { type: 'restore_resource', resource: 'hp', mode: 'flat', value: 10 },
      { type: 'remove_status', status: 'minor_wound' },
      { type: 'change_gauge', gauge: 'pillToxicity', delta: -5 },
    ]);

    expect(sorted.map((item) => item.type)).toEqual([
      'restore_resource',
      'change_gauge',
      'remove_status',
      'add_status',
      'advance_track',
    ]);
  });

  it('rejects pills that exceed the realm long-term quota', () => {
    const cultivator = createCultivator();
    const condition: CultivatorCondition = {
      ...ConditionService.normalizeCondition(cultivator),
      counters: {
        longTermPillUsesByRealm: {
          [cultivator.realm]: REALM_PILL_USAGE_LIMITS[cultivator.realm],
        },
      },
    };
    cultivator.condition = condition;

    const pill = createPill('淬体丹', {
      kind: 'pill',
      family: 'tempering',
      operations: [{ type: 'advance_track', track: 'tempering.vitality', value: 20 }],
      consumeRules: {
        scene: 'out_of_battle_only',
        countsTowardLongTermQuota: true,
      },
      alchemyMeta: {
        source: 'improvised',
        sourceMaterials: ['玄铁草'],
        stability: 60,
        toxicityRating: 20,
        tags: ['tempering'],
      },
    });

    expect(() => PillOperationExecutor.execute(cultivator, pill)).toThrow('长期丹药服用次数已达上限');
  });

  it('advances tracks, settles permanent rewards, and keeps overflow progress', () => {
    const cultivator = createCultivator();
    cultivator.condition = {
      ...ConditionService.normalizeCondition(cultivator),
      tracks: {
        tempering: {
          vitality: { level: 0, progress: 95 },
          spirit: { level: 0, progress: 0 },
          wisdom: { level: 0, progress: 0 },
          speed: { level: 0, progress: 0 },
          willpower: { level: 0, progress: 0 },
        },
        marrowWash: { level: 0, progress: 95 },
      },
    };

    const pill = createPill('双修丹', {
      kind: 'pill',
      family: 'hybrid',
      operations: [
        { type: 'advance_track', track: 'tempering.vitality', value: 15 },
        { type: 'advance_track', track: 'marrow_wash', value: 10 },
      ],
      consumeRules: {
        scene: 'out_of_battle_only',
        countsTowardLongTermQuota: true,
      },
      alchemyMeta: {
        source: 'improvised',
        sourceMaterials: ['金髓花'],
        stability: 60,
        toxicityRating: 20,
        tags: ['hybrid'],
      },
    });

    const result = PillOperationExecutor.execute(cultivator, pill);

    expect(result.cultivator.attributes.vitality).toBe(41);
    expect(result.cultivator.condition?.tracks.tempering.vitality).toEqual({
      level: 1,
      progress: 10,
    });
    expect(result.cultivator.condition?.tracks.marrowWash).toEqual({
      level: 1,
      progress: 5,
    });
    expect(result.cultivator.spiritual_roots).toEqual([
      { element: '木', strength: 81, grade: '真灵根' },
      { element: '水', strength: 100, grade: '真灵根' },
    ]);
    expect(result.trackLevelUps).toEqual([
      { track: 'tempering.vitality', newLevel: 1 },
      { track: 'marrow_wash', newLevel: 1 },
    ]);
  });

  it('consumes breakthrough support statuses after one breakthrough attempt', () => {
    const cultivator = createCultivator();
    const now = new Date('2026-05-15T12:00:00.000Z');
    const condition = ConditionService.normalizeCondition(cultivator, {
      ...ConditionService.normalizeCondition(cultivator),
      statuses: [
        {
          key: 'breakthrough_focus',
          stacks: 1,
          source: 'pill',
          duration: { kind: 'until_removed' },
          usesRemaining: 1,
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
        },
        {
          key: 'clear_mind',
          stacks: 1,
          source: 'pill',
          duration: { kind: 'until_removed' },
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
        },
      ],
    });

    const consumed = PillOperationExecutor.consumeBreakthroughSupportStatuses(
      condition,
      cultivator,
      now,
    );

    expect(consumed.statuses.map((status) => status.key)).toEqual([]);
    expect(consumed.timestamps.lastBreakthroughAt).toBe(now.toISOString());
  });
});
