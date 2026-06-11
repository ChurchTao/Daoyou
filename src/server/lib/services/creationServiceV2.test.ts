const { executorState, getExecutorMock, inArrayMock } = vi.hoisted(() => {
  const state = {
    materialRows: [] as any[],
  };

  const executor = {
    select() {
      return {
        from() {
          return {
            where: async () => state.materialRows,
          };
        },
      };
    },
  };

  return {
    executorState: state,
    getExecutorMock: vi.fn(() => executor),
    inArrayMock: vi.fn(() => Symbol('inArray')),
  };
});

vi.mock('@server/lib/drizzle/db', () => ({
  getExecutor: getExecutorMock,
}));

vi.mock('@server/lib/drizzle/schema', () => ({
  cultivators: { id: 'cultivator_id' },
  materials: { id: 'id' },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn(),
  inArray: inArrayMock,
  sql: vi.fn(),
}));

vi.mock('@server/lib/redis', () => ({
  redis: {
    del: vi.fn(),
    get: vi.fn(),
    set: vi.fn(),
  },
}));

vi.mock('@server/lib/repositories/creationProductRepository', () => ({}));

vi.mock('./cultivatorService', () => ({
  getCultivatorByIdUnsafe: vi.fn(),
}));

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { previewCreationSelection } from './creationServiceV2';

describe('previewCreationSelection', () => {
  beforeEach(() => {
    executorState.materialRows = [];
    getExecutorMock.mockClear();
    inArrayMock.mockClear();
  });

  it('应在材料灵力不足以支撑核心词条时返回阻塞原因', async () => {
    executorState.materialRows = [
      {
        id: 'manual-1',
        cultivatorId: 'cultivator-1',
        name: '赤炎残诀',
        type: 'skill_manual',
        rank: '凡品',
        quantity: 1,
        element: '火',
        description: '残缺火诀，余留爆烈灵意。',
        details: null,
      },
    ];

    const preview = await previewCreationSelection(
      'cultivator-1',
      ['manual-1'],
      'create_skill',
    );

    expect(preview.validation).toEqual({
      valid: false,
      blockingReason:
        '当前材料灵力不足，无法凝成核心词条。请提高材料品阶、增加投入数量，或更换更契合的主材。',
      warnings: [],
      missingMatchingManual: false,
    });
    expect(getExecutorMock).toHaveBeenCalledTimes(1);
    expect(inArrayMock).toHaveBeenCalledWith('id', ['manual-1']);
  });

  it('应阻止待鉴定材料进入造物预览', async () => {
    executorState.materialRows = [
      {
        id: 'mystery-1',
        cultivatorId: 'cultivator-1',
        name: '封泥药囊',
        type: 'herb',
        rank: '玄品',
        quantity: 1,
        element: '木',
        description: '药香被封泥遮蔽，真实品相难辨。',
        details: {
          mystery: {
            mysteryId: 'mystery-token-1',
            identifyCost: 200,
            disguiseTier: '玄品',
            purchasedAt: Date.now(),
          },
        },
      },
    ];

    const preview = await previewCreationSelection(
      'cultivator-1',
      ['mystery-1'],
      'refine',
    );

    expect(preview.validation).toEqual({
      valid: false,
      blockingReason: '待鉴定材料无法入炉，请先鉴定。',
      warnings: [],
      missingMatchingManual: false,
    });
  });
});
