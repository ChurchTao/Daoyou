const {
  addConsumableToInventoryMock,
  buildDiscoveryCandidateMock,
  executorState,
  generateImprovisedPillCopyMock,
  getCultivatorByIdUnsafeMock,
  getExecutorMock,
  redisDelMock,
  redisSetMock,
} = vi.hoisted(() => {
  const state = {
    consumableRows: [] as any[],
    cultivatorRow: null as any,
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
    buildDiscoveryCandidateMock: vi.fn(),
    executorState: state,
    generateImprovisedPillCopyMock: vi.fn(),
    getCultivatorByIdUnsafeMock: vi.fn((cultivatorId: string) =>
      Promise.resolve(
        state.cultivatorRow
          ? {
              cultivator: {
                id: cultivatorId,
                realm: state.cultivatorRow.realm ?? '筑基',
                pre_heaven_fates: [],
              },
              userId: state.cultivatorRow.userId ?? 'user-1',
              updatedAt: new Date('2026-05-15T00:00:00.000Z'),
            }
          : null,
      ),
    ),
    getExecutorMock: vi.fn(() => executor),
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
    set: redisSetMock,
  },
}));

vi.mock('./cultivatorService', () => ({
  addConsumableToInventory: addConsumableToInventoryMock,
  getCultivatorByIdUnsafe: getCultivatorByIdUnsafeMock,
}));

vi.mock('./AlchemyFormulaService', () => ({
  buildDiscoveryCandidate: buildDiscoveryCandidateMock,
}));

vi.mock('./AlchemyNarrativeEnricher', () => ({
  AlchemyNarrativeEnricher: class AlchemyNarrativeEnricher {
    generateImprovisedPillCopy = generateImprovisedPillCopyMock;
  },
}));

import type { PillSpec } from '@shared/types/consumable';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createAlchemyService,
  previewAlchemySelection,
} from './alchemyServiceV2';

describe('processAlchemyCraft narrative copy', () => {
  beforeEach(() => {
    executorState.materialRows = [
      {
        id: 'm1',
        cultivatorId: 'cultivator-1',
        name: '青岚草',
        description: '草叶清润，常用于补充气血与治愈伤口。',
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
    buildDiscoveryCandidateMock.mockReset();
    generateImprovisedPillCopyMock.mockReset();
    getCultivatorByIdUnsafeMock.mockClear();
    redisSetMock.mockResolvedValue('OK');
    buildDiscoveryCandidateMock.mockResolvedValue(null);
  });

  it('uses generated pill copy when llm succeeds', async () => {
    generateImprovisedPillCopyMock.mockResolvedValueOnce({
      name: '回春散',
      description: '木气徐徐归拢，炉息温和，丹成后自有一缕生机护住受损经脉。',
    });
    const service = createAlchemyService({
      plan: vi.fn().mockResolvedValue({
        materialVectors: [
          {
            materialRef: 'material_1',
            materialName: '青岚草',
            properties: [
              { key: 'restore_hp', weight: 0.6 },
              { key: 'heal_wounds', weight: 0.4 },
            ],
          },
        ],
        intentVector: [
          { key: 'restore_hp', weight: 0.6 },
          { key: 'heal_wounds', weight: 0.4 },
        ],
        focusMode: 'focused',
      }),
    } as any);

    const result = await service.processAlchemyCraft('cultivator-1', ['m1'], {
      userPrompt: '疗伤为主',
    });

    expect(result.consumable.name).toBe('回春散');
    expect(result.consumable.description).toBe(
      '木气徐徐归拢，炉息温和，丹成后自有一缕生机护住受损经脉。',
    );
    expect(generateImprovisedPillCopyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        family: 'healing',
        materialNames: ['青岚草'],
        propertyVector: expect.arrayContaining([
          expect.objectContaining({ key: 'restore_hp' }),
          expect.objectContaining({ key: 'heal_wounds' }),
        ]),
        userPrompt: '疗伤为主',
      }),
    );
  });

  it('falls back to non-family-based copy when llm naming is unavailable', async () => {
    generateImprovisedPillCopyMock.mockResolvedValueOnce(null);
    const service = createAlchemyService({
      plan: vi.fn().mockResolvedValue({
        materialVectors: [
          {
            materialRef: 'material_1',
            materialName: '青岚草',
            properties: [
              { key: 'restore_hp', weight: 0.6 },
              { key: 'heal_wounds', weight: 0.4 },
            ],
          },
        ],
        intentVector: [
          { key: 'restore_hp', weight: 0.6 },
          { key: 'heal_wounds', weight: 0.4 },
        ],
        focusMode: 'focused',
      }),
    } as any);

    const result = await service.processAlchemyCraft('cultivator-1', ['m1'], {
      userPrompt: '疗伤为主',
    });

    expect(result.consumable.name).toBe('青木青岚草丹');
    expect(result.consumable.description).toContain('丹意取向「疗伤为主」');
    expect(result.consumable.description).toContain(
      '药性归于补充气血 63%、治愈伤势 37%',
    );
  });

  it('does not override generated names for non-focus breakthrough effects', async () => {
    generateImprovisedPillCopyMock.mockResolvedValueOnce({
      name: '静心护识丹',
      description: '清宁药性护住识海，冲关前可平复心魔杂念。',
    });
    const service = createAlchemyService({
      plan: vi.fn().mockResolvedValue({
        materialVectors: [
          {
            materialRef: 'material_1',
            materialName: '青岚草',
            properties: [{ key: 'clear_mind_support', weight: 1 }],
          },
        ],
        intentVector: [{ key: 'clear_mind_support', weight: 1 }],
        focusMode: 'focused',
      }),
    } as any);

    const result = await service.processAlchemyCraft('cultivator-1', ['m1'], {
      userPrompt: '清心守神',
    });

    expect(result.consumable.name).toBe('静心护识丹');
    expect(result.consumable.spec.kind).toBe('pill');
    expect((result.consumable.spec as PillSpec).alchemyMeta).toMatchObject({
      breakthroughTargetRealm: '金丹',
    });
    expect(
      (result.consumable.spec as PillSpec).alchemyMeta.breakthroughLabel,
    ).toBeUndefined();
  });

  it('keeps fixed names for breakthrough focus effects', async () => {
    generateImprovisedPillCopyMock.mockResolvedValueOnce({
      name: '凝神冲关丹',
      description: '丹气收束心神，为破境聚势。',
    });
    const service = createAlchemyService({
      plan: vi.fn().mockResolvedValue({
        materialVectors: [
          {
            materialRef: 'material_1',
            materialName: '青岚草',
            properties: [{ key: 'breakthrough_support', weight: 1 }],
          },
        ],
        intentVector: [{ key: 'breakthrough_support', weight: 1 }],
        focusMode: 'focused',
      }),
    } as any);

    const result = await service.processAlchemyCraft('cultivator-1', ['m1'], {
      userPrompt: '破境凝神',
    });

    expect(result.consumable.name).toBe('降尘丹');
    expect(result.consumable.spec.kind).toBe('pill');
    expect((result.consumable.spec as PillSpec).alchemyMeta).toMatchObject({
      breakthroughTargetRealm: '金丹',
      breakthroughLabel: '降尘丹',
    });
  });

  it('uses one planner call and one naming call for improvised crafting', async () => {
    const planMock = vi.fn().mockResolvedValue({
      materialVectors: [
        {
          materialRef: 'material_1',
          materialName: '青岚草',
          properties: [
            { key: 'restore_hp', weight: 0.6 },
            { key: 'heal_wounds', weight: 0.4 },
          ],
        },
      ],
      intentVector: [
        { key: 'restore_hp', weight: 0.6 },
        { key: 'heal_wounds', weight: 0.4 },
      ],
      focusMode: 'focused',
    });
    generateImprovisedPillCopyMock.mockResolvedValueOnce({
      name: '回春散',
      description: '木气徐徐归拢，炉息温和，丹成后自有一缕生机护住受损经脉。',
    });
    const service = createAlchemyService({ plan: planMock } as any);

    await service.processAlchemyCraft('cultivator-1', ['m1'], {
      userPrompt: '疗伤为主',
    });

    expect(planMock).toHaveBeenCalledTimes(1);
    expect(generateImprovisedPillCopyMock).toHaveBeenCalledTimes(1);
  });

  it('rejects mystery materials during preview and crafting', async () => {
    executorState.materialRows = [
      {
        ...executorState.materialRows[0],
        details: {
          mystery: {
            mysteryId: 'mystery-1',
            identifyCost: 200,
            disguiseTier: '玄品',
            purchasedAt: Date.now(),
          },
        },
      },
    ];
    const planMock = vi.fn();
    const service = createAlchemyService({ plan: planMock } as any);

    const preview = await previewAlchemySelection(
      'cultivator-1',
      50000,
      ['m1'],
    );
    expect(preview.validation).toMatchObject({
      valid: false,
      blockingReason: '待鉴定材料无法入炉，请先鉴定。',
    });

    await expect(
      service.processAlchemyCraft('cultivator-1', ['m1'], {
        userPrompt: '疗伤为主',
      }),
    ).rejects.toThrow('待鉴定材料无法入炉，请先鉴定。');
    expect(planMock).not.toHaveBeenCalled();
  });
});
