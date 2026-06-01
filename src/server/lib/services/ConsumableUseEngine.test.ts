const {
  consumeConsumableByIdMock,
  getCultivatorByIdMock,
  getExecutorMock,
  replaceSpiritualRootsMock,
  resetOwnedConsumableRow,
  setOwnedConsumableRow,
  updatedCultivatorPayloads,
} = vi.hoisted(() => {
  const payloads: Array<Record<string, unknown>> = [];
  const createCultivationConsumableRow = () => ({
    id: 'pill-1',
    cultivatorId: 'cultivator-1',
    name: '养元丹',
    type: '丹药',
    quality: '真品',
    quantity: 1,
    description: '积修养元。',
    prompt: null,
    score: 0,
    spec: {
      kind: 'pill',
      family: 'cultivation',
      operations: [
        {
          type: 'gain_progress',
          target: 'cultivation_exp',
          value: 48,
        },
      ],
      consumeRules: {
        scene: 'out_of_battle_only',
        quotaCategory: 'cultivation',
      },
      alchemyMeta: {
        source: 'improvised',
        sourceMaterials: ['金霞芝'],
        dominantElement: '金',
        stability: 72,
        toxicityRating: 9,
        tags: ['cultivation'],
      },
    },
  });
  let ownedConsumableRow = createCultivationConsumableRow();
  type TxMock = {
    update: () => {
      set: (payload: Record<string, unknown>) => {
        where: () => Promise<undefined>;
      };
    };
  };
  const tx = {
    update() {
      return {
        set(payload: Record<string, unknown>) {
          payloads.push(payload);
          return {
            where: async () => undefined,
          };
        },
      };
    },
  } satisfies TxMock;

  const executor = {
    select() {
      return {
        from(table: unknown) {
          if (
            table &&
            typeof table === 'object' &&
            'quality' in table &&
            'spec' in table
          ) {
            return {
              where() {
                return {
                  limit: async () => [ownedConsumableRow],
                };
              },
            };
          }

          throw new Error('unexpected table');
        },
      };
    },
    transaction: async (callback: (tx: TxMock) => Promise<void>) =>
      callback(tx),
  };

  return {
    consumeConsumableByIdMock: vi.fn(),
    getCultivatorByIdMock: vi.fn(),
    getExecutorMock: vi.fn(() => executor),
    replaceSpiritualRootsMock: vi.fn(),
    resetOwnedConsumableRow: () => {
      ownedConsumableRow = createCultivationConsumableRow();
    },
    setOwnedConsumableRow: (row: Record<string, unknown>) => {
      ownedConsumableRow = row;
    },
    updatedCultivatorPayloads: payloads,
  };
});

vi.mock('@server/lib/drizzle/db', () => ({
  getExecutor: getExecutorMock,
}));

vi.mock('./cultivatorService', () => ({
  consumeConsumableById: consumeConsumableByIdMock,
  getCultivatorById: getCultivatorByIdMock,
  replaceSpiritualRoots: replaceSpiritualRootsMock,
}));

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Cultivator } from '@shared/types/cultivator';
import { ConsumableUseEngine } from './ConsumableUseEngine';

function createCultivator(): Cultivator {
  return {
    id: 'cultivator-1',
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
    spiritual_roots: [{ element: '木', strength: 80, grade: '真灵根' }],
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
    cultivation_progress: {
      cultivation_exp: 12,
      exp_cap: 100,
      comprehension_insight: 24,
      breakthrough_failures: 0,
      bottleneck_state: false,
      inner_demon: false,
      deviation_risk: 0,
    },
  };
}

describe('ConsumableUseEngine.consume', () => {
  beforeEach(() => {
    updatedCultivatorPayloads.length = 0;
    getCultivatorByIdMock.mockReset();
    replaceSpiritualRootsMock.mockReset();
    consumeConsumableByIdMock.mockReset();
    resetOwnedConsumableRow();
    getCultivatorByIdMock.mockResolvedValue(createCultivator());
  });

  it('persists cultivation progress and cultivation-pill quota updates after consuming a cultivation pill', async () => {
    await ConsumableUseEngine.consume('user-1', 'cultivator-1', 'pill-1');

    expect(updatedCultivatorPayloads).toHaveLength(1);
    expect(updatedCultivatorPayloads[0]?.cultivation_progress).toMatchObject({
      cultivation_exp: 60,
      exp_cap: 100,
      comprehension_insight: 24,
    });
    expect(updatedCultivatorPayloads[0]?.condition).toMatchObject({
      counters: {
        cultivationPillUsesByRealm: {
          筑基: 1,
        },
      },
    });
    expect(replaceSpiritualRootsMock).toHaveBeenCalled();
    expect(consumeConsumableByIdMock).toHaveBeenCalledWith(
      'user-1',
      'cultivator-1',
      'pill-1',
      1,
      expect.any(Object),
    );
  });

  it('persists tempering level-ups and reports the concrete attribute gain in the consume message', async () => {
    setOwnedConsumableRow({
      id: 'pill-tempering',
      cultivatorId: 'cultivator-1',
      name: '淬体丹',
      type: '丹药',
      quality: '真品',
      quantity: 1,
      description: '锤炼肉身。',
      prompt: null,
      score: 0,
      spec: {
        kind: 'pill',
        family: 'tempering',
        operations: [
          {
            type: 'advance_track',
            track: 'tempering.vitality',
            value: 1,
          },
        ],
        consumeRules: {
          scene: 'out_of_battle_only',
          quotaCategory: 'long_term',
        },
        alchemyMeta: {
          source: 'improvised',
          sourceMaterials: ['铁骨藤'],
          dominantElement: '土',
          stability: 68,
          toxicityRating: 12,
          tags: ['tempering_vitality'],
        },
      },
    });
    getCultivatorByIdMock.mockResolvedValue({
      ...createCultivator(),
      condition: {
        version: 1,
        resources: {
          hp: { current: 100 },
          mp: { current: 100 },
        },
        gauges: {
          pillToxicity: 0,
        },
        tracks: {
          tempering: {
            vitality: { level: 0, progress: 99 },
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
        },
        statuses: [],
        timestamps: {},
      },
    });

    const result = await ConsumableUseEngine.consume(
      'user-1',
      'cultivator-1',
      'pill-tempering',
    );

    expect(result.message).toContain('炼体·体魄提升至 Lv.1');
    expect(result.message).toContain('体魄 +1');
    expect(updatedCultivatorPayloads).toHaveLength(1);
    expect(updatedCultivatorPayloads[0]?.vitality).toBe(41);
    expect(updatedCultivatorPayloads[0]?.condition).toMatchObject({
      tracks: {
        tempering: {
          vitality: { level: 1, progress: 0 },
        },
      },
    });
  });
});
