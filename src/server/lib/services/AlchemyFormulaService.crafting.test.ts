const {
  addConsumableToInventoryMock,
  executorState,
  getCultivatorByIdUnsafeMock,
  getExecutorMock,
  plannerPlanMock,
  redisDelMock,
  redisSetMock,
} = vi.hoisted(() => {
  const state = {
    consumableRows: [] as any[],
    cultivatorRow: null as any,
    formulaRows: [] as any[],
    materialRows: [] as any[],
  };

  const tx = {
    delete() {
      return {
        where: async () => undefined,
      };
    },
    update() {
      return {
        set() {
          return {
            where: async () => undefined,
          };
        },
      };
    },
  };

  const executor = {
    select() {
      return {
        from(table: unknown) {
          if (
            table &&
            typeof table === 'object' &&
            'family' in table &&
            'pattern' in table &&
            'blueprint' in table
          ) {
            return {
              where() {
                return {
                  limit: async () => state.formulaRows,
                };
              },
            };
          }

          if (
            table &&
            typeof table === 'object' &&
            'rank' in table &&
            'description' in table
          ) {
            return {
              where: async () => state.materialRows,
            };
          }

          if (
            table &&
            typeof table === 'object' &&
            'realm' in table &&
            'spirit_stones' in table
          ) {
            return {
              where() {
                return {
                  limit: async () =>
                    state.cultivatorRow ? [state.cultivatorRow] : [],
                };
              },
            };
          }

          if (
            table &&
            typeof table === 'object' &&
            'quality' in table &&
            'spec' in table
          ) {
            return {
              where() {
                return {
                  limit: async () => state.consumableRows,
                };
              },
            };
          }

          throw new Error('unexpected table');
        },
      };
    },
    transaction: async (callback: (tx: any) => Promise<void>) => callback(tx),
  };

  return {
    addConsumableToInventoryMock: vi.fn(),
    executorState: state,
    getCultivatorByIdUnsafeMock: vi.fn((cultivatorId: string) =>
      Promise.resolve(
        state.cultivatorRow
          ? {
              cultivator: {
                id: cultivatorId,
                realm: state.cultivatorRow.realm,
                pre_heaven_fates: [],
              },
              userId: state.cultivatorRow.userId ?? 'user-1',
              updatedAt: new Date('2026-05-15T00:00:00.000Z'),
            }
          : null,
      ),
    ),
    getExecutorMock: vi.fn(() => executor),
    plannerPlanMock: vi.fn(),
    redisDelMock: vi.fn(),
    redisSetMock: vi.fn(),
  };
});

vi.mock('@server/lib/drizzle/db', () => ({
  getExecutor: getExecutorMock,
}));

vi.mock('@server/lib/redis', () => ({
  redis: {
    del: redisDelMock,
    get: vi.fn(),
    set: redisSetMock,
  },
}));

vi.mock('./cultivatorService', () => ({
  addConsumableToInventory: addConsumableToInventoryMock,
  getCultivatorByIdUnsafe: getCultivatorByIdUnsafeMock,
}));

vi.mock('./AlchemyRecipePlanner', () => ({
  alchemyRecipePlanner: {
    plan: plannerPlanMock,
  },
}));

import { buildCultivationGain } from '@shared/lib/alchemyProgress';
import type { PillSpec } from '@shared/types/consumable';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { craftFromFormula } from './AlchemyFormulaService';

describe('craftFromFormula narrative copy', () => {
  beforeEach(() => {
    executorState.formulaRows = [
      {
        id: 'formula-1',
        cultivatorId: 'cultivator-1',
        name: '回春丹方',
        description: '此方偏走木性生机，炉势圆融而不躁进。',
        family: 'healing',
        pattern: {
          targetPropertyVector: [
            { key: 'restore_hp', weight: 0.62 },
            { key: 'heal_wounds', weight: 0.38 },
          ],
          dominantElement: '木',
          minQuality: '真品',
          slotCount: 1,
        },
        blueprint: {
          operations: [
            {
              type: 'restore_resource',
              resource: 'hp',
              mode: 'percent',
              value: 0.12,
            },
            { type: 'change_gauge', gauge: 'pillToxicity', delta: 4 },
            { type: 'remove_status', status: 'minor_wound' },
          ],
          consumeRules: {
            scene: 'out_of_battle_only',
            quotaCategory: 'none',
          },
          targetStability: 78,
          targetToxicity: 6,
        },
        mastery: {
          level: 2,
          exp: 1,
        },
        createdAt: new Date('2026-05-15T00:00:00.000Z'),
        updatedAt: new Date('2026-05-15T00:00:00.000Z'),
      },
    ];
    executorState.materialRows = [
      {
        id: 'm1',
        cultivatorId: 'cultivator-1',
        name: '回春草',
        description: '草叶温润，可补充气血并治愈伤口。',
        rank: '真品',
        quantity: 1,
        element: '木',
        type: 'herb',
      },
    ];
    executorState.cultivatorRow = {
      id: 'cultivator-1',
      userId: 'user-1',
      realm: '筑基',
      spirit_stones: 50000,
    };
    executorState.consumableRows = [];
    redisSetMock.mockReset();
    redisDelMock.mockReset();
    addConsumableToInventoryMock.mockReset();
    plannerPlanMock.mockReset();
    getCultivatorByIdUnsafeMock.mockClear();
    redisSetMock.mockResolvedValue('OK');
    plannerPlanMock.mockResolvedValue({
      materialVectors: [
        {
          materialRef: 'material_1',
          materialName: '回春草',
          properties: [
            { key: 'restore_hp', weight: 0.62 },
            { key: 'heal_wounds', weight: 0.38 },
          ],
        },
      ],
      intentVector: [],
      focusMode: 'balanced',
    });
  });

  it('keeps formula-derived pill name and uses rule-based batch description', async () => {
    const result = await craftFromFormula('cultivator-1', 'formula-1', ['m1']);

    expect(result.consumable.name).toBe('回春');
    expect(result.consumable.description).toContain('依《回春丹方》炉意炼成');
    expect(result.consumable.description).toContain('药力拟合 115%');
  });

  it('rejects materials whose fit drops below the hard threshold', async () => {
    plannerPlanMock.mockResolvedValueOnce({
      materialVectors: [
        {
          materialRef: 'material_1',
          materialName: '回春草',
          properties: [{ key: 'restore_mp', weight: 1 }],
        },
      ],
      intentVector: [],
      focusMode: 'balanced',
    });

    await expect(
      craftFromFormula('cultivator-1', 'formula-1', ['m1']),
    ).rejects.toThrow('本炉药性与丹方偏差过大，强行开炉只会炸鼎。');
  });

  it('normalizes healing wound removal by the current crafted quality', async () => {
    executorState.cultivatorRow = {
      ...executorState.cultivatorRow,
      spirit_stones: 100000,
    };
    executorState.materialRows = [
      {
        ...executorState.materialRows[0],
        rank: '天品',
      },
    ];

    const result = await craftFromFormula('cultivator-1', 'formula-1', ['m1']);

    expect(result.consumable.quality).toBe('天品');
    expect(result.consumable.spec.kind).toBe('pill');
    expect((result.consumable.spec as PillSpec).operations).toContainEqual({
      type: 'remove_status',
      status: 'near_death',
    });
  });

  it('recalculates cultivation gain by the current crafter realm instead of blueprint value', async () => {
    executorState.formulaRows = [
      {
        ...executorState.formulaRows[0],
        name: '养元丹方',
        description: '此方偏收金水养气之势，重在缓积道基。',
        family: 'cultivation',
        pattern: {
          targetPropertyVector: [{ key: 'cultivation', weight: 1 }],
          slotCount: 1,
        },
        blueprint: {
          operations: [
            { type: 'gain_progress', target: 'cultivation_exp', value: 9999 },
            { type: 'change_gauge', gauge: 'pillToxicity', delta: 9 },
          ],
          consumeRules: {
            scene: 'out_of_battle_only',
            quotaCategory: 'cultivation',
          },
          targetStability: 72,
          targetToxicity: 9,
        },
      },
    ];
    executorState.materialRows = [
      {
        ...executorState.materialRows[0],
        name: '金霞芝',
        description: '芝气温养，可积蓄修为。',
        element: '金',
      },
    ];
    plannerPlanMock.mockResolvedValueOnce({
      materialVectors: [
        {
          materialRef: 'material_1',
          materialName: '金霞芝',
          properties: [{ key: 'cultivation', weight: 1 }],
        },
      ],
      intentVector: [],
      focusMode: 'balanced',
    });
    executorState.cultivatorRow = {
      ...executorState.cultivatorRow,
      realm: '筑基',
    };

    const result = await craftFromFormula('cultivator-1', 'formula-1', ['m1']);

    expect(result.consumable.name).toBe('养元');
    expect(result.consumable.spec.kind).toBe('pill');
    expect(
      (result.consumable.spec as PillSpec).consumeRules.quotaCategory,
    ).toBe('cultivation');
    expect((result.consumable.spec as PillSpec).operations).toContainEqual({
      type: 'gain_progress',
      target: 'cultivation_exp',
      value: Math.floor(buildCultivationGain('筑基', '真品') * 1.15),
    });
    expect((result.consumable.spec as PillSpec).operations).not.toContainEqual({
      type: 'gain_progress',
      target: 'cultivation_exp',
      value: 9999,
    });
  });

  it('preserves clear_mind status effects when crafting breakthrough formulas', async () => {
    executorState.formulaRows = [
      {
        ...executorState.formulaRows[0],
        name: '清心护婴丹方',
        description: '此方以清心定神为先，专为护住婴劫前的识海。',
        family: 'breakthrough',
        pattern: {
          targetPropertyVector: [{ key: 'clear_mind_support', weight: 1 }],
          slotCount: 1,
        },
        blueprint: {
          operations: [
            { type: 'add_status', status: 'clear_mind', usesRemaining: 1 },
            { type: 'change_gauge', gauge: 'pillToxicity', delta: 9 },
          ],
          consumeRules: {
            scene: 'out_of_battle_only',
            quotaCategory: 'long_term',
          },
          targetStability: 74,
          targetToxicity: 9,
        },
      },
    ];
    executorState.materialRows = [
      {
        ...executorState.materialRows[0],
        name: '静神芝',
        description: '芝气清宁，可助清心定神，稳住识海。',
        element: '水',
      },
    ];
    plannerPlanMock.mockResolvedValueOnce({
      materialVectors: [
        {
          materialRef: 'material_1',
          materialName: '静神芝',
          properties: [{ key: 'clear_mind_support', weight: 1 }],
        },
      ],
      intentVector: [],
      focusMode: 'balanced',
    });
    executorState.cultivatorRow = {
      ...executorState.cultivatorRow,
      realm: '金丹',
    };

    const result = await craftFromFormula('cultivator-1', 'formula-1', ['m1']);

    expect(result.consumable.name).toBe('护婴丹');
    expect(result.consumable.spec.kind).toBe('pill');
    expect(
      (result.consumable.spec as PillSpec).consumeRules.quotaCategory,
    ).toBe('long_term');
    expect((result.consumable.spec as PillSpec).operations).toContainEqual({
      type: 'add_status',
      status: 'clear_mind',
      usesRemaining: 1,
    });
    expect((result.consumable.spec as PillSpec).alchemyMeta).toMatchObject({
      breakthroughTargetRealm: '元婴',
      breakthroughLabel: '护婴丹',
      propertyVector: [{ key: 'clear_mind_support', weight: 1 }],
    });
  });

  it('stores formula target vector and fit metrics in formula alchemy meta', async () => {
    const result = await craftFromFormula('cultivator-1', 'formula-1', ['m1']);

    expect(result.consumable.spec.kind).toBe('pill');
    const alchemyMeta = (result.consumable.spec as PillSpec).alchemyMeta;

    expect(alchemyMeta).toMatchObject({
      source: 'formula',
      propertyVector: [
        { key: 'restore_hp', weight: 0.62 },
        { key: 'heal_wounds', weight: 0.38 },
      ],
      tags: ['restore_hp', 'heal_wounds', 'healing'],
    });
    if (alchemyMeta.source !== 'formula') {
      throw new Error('expected formula alchemy meta');
    }
    expect(alchemyMeta.fitScore).toBeCloseTo(1, 4);
    expect(alchemyMeta.fitMultiplier).toBeCloseTo(1.15, 4);
  });

  it('adds a warning sentence when fit lands in the degraded middle band', async () => {
    plannerPlanMock.mockResolvedValueOnce({
      materialVectors: [
        {
          materialRef: 'material_1',
          materialName: '回春草',
          properties: [
            { key: 'restore_hp', weight: 0.55 },
            { key: 'restore_mp', weight: 0.45 },
          ],
        },
      ],
      intentVector: [],
      focusMode: 'balanced',
    });

    const result = await craftFromFormula('cultivator-1', 'formula-1', ['m1']);

    expect(result.consumable.description).toContain('本炉药性虽能循方成丹');
    const alchemyMeta = (result.consumable.spec as PillSpec).alchemyMeta;
    if (alchemyMeta.source !== 'formula') {
      throw new Error('expected formula alchemy meta');
    }
    expect(alchemyMeta.fitScore).toBeCloseTo(0.55, 4);
    expect(alchemyMeta.fitMultiplier).toBeCloseTo(1.065, 4);
  });
});
