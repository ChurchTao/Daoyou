import { MaterialGenerator } from '@/engine/material/creation/MaterialGenerator';
import { resourceEngine } from '@/engine/resource/ResourceEngine';
import { getExecutor } from '@/lib/drizzle/db';

jest.mock('@/lib/drizzle/db', () => ({
  getExecutor: jest.fn(),
}));

jest.mock('@/engine/material/creation/MaterialGenerator', () => ({
  MaterialGenerator: {
    generateFromSkeletons: jest.fn(),
  },
}));

jest.mock('@/engine/resource/ResourceEngine', () => ({
  resourceEngine: {
    gain: jest.fn(),
  },
}));

jest.mock('./cultivatorService', () => ({
  consumeConsumableById: jest.fn(),
}));

import { consumeConsumableById } from './cultivatorService';
import { ManualDrawService } from './ManualDrawService';

const buildGeneratedMaterials = (type: 'gongfa_manual' | 'skill_manual') =>
  Array.from({ length: 5 }, (_, index) => ({
    name: `${type}-秘籍-${index + 1}`,
    type,
    rank: '玄品' as const,
    element: '金' as const,
    description: `描述${index + 1}`,
    quantity: index + 2,
    price: 100 + index,
  }));

describe('ManualDrawService', () => {
  const mockSelectChain = {
    from: jest.fn(),
    where: jest.fn(),
    limit: jest.fn(),
  };
  const mockExecutor = {
    select: jest.fn(() => mockSelectChain),
  };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  beforeEach(() => {
    jest.clearAllMocks();

    mockSelectChain.from.mockReturnValue(mockSelectChain);
    mockSelectChain.where.mockReturnValue(mockSelectChain);
    mockSelectChain.limit.mockResolvedValue([]);

    (getExecutor as jest.Mock).mockReturnValue(mockExecutor);
    (MaterialGenerator.generateFromSkeletons as jest.Mock).mockResolvedValue(
      buildGeneratedMaterials('gongfa_manual'),
    );
    (resourceEngine.gain as jest.Mock).mockImplementation(
      async (
        _userId: string,
        _cultivatorId: string,
        _gains: unknown[],
        action?: (tx: Record<string, never>) => Promise<void>,
      ) => {
        if (action) {
          await action({});
        }
        return { success: true, operations: [] };
      },
    );
    (consumeConsumableById as jest.Mock).mockResolvedValue(undefined);
  });

  it('可成功抽取 1 次并立即发放秘籍材料', async () => {
    jest.spyOn(Math, 'random').mockReturnValue(0);
    mockSelectChain.limit.mockResolvedValueOnce([
      {
        id: 'consumable-1',
        cultivatorId: 'cultivator-1',
        name: '悟道演法符',
        type: '符箓',
        quantity: 2,
        mechanicKey: 'gongfa_draw_access',
        createdAt: new Date(),
      },
    ]);
    mockSelectChain.limit.mockResolvedValueOnce([
      {
        id: 'consumable-1',
        cultivatorId: 'cultivator-1',
        name: '悟道演法符',
        type: '符箓',
        quantity: 1,
        mechanicKey: 'gongfa_draw_access',
        createdAt: new Date(),
      },
    ]);
    mockSelectChain.limit.mockResolvedValueOnce([]);

    const result = await ManualDrawService.draw(
      'user-1',
      'cultivator-1',
      'gongfa',
      1,
    );

    expect(MaterialGenerator.generateFromSkeletons).toHaveBeenCalledWith([
      expect.objectContaining({
        type: 'gongfa_manual',
        rank: '灵品',
        quantity: 1,
      }),
    ]);
    expect(resourceEngine.gain).toHaveBeenCalledWith(
      'user-1',
      'cultivator-1',
      [
        expect.objectContaining({
          type: 'material',
          value: 1,
          data: expect.objectContaining({
            type: 'gongfa_manual',
            quantity: 1,
          }),
        }),
      ],
      expect.any(Function),
    );
    expect(consumeConsumableById).toHaveBeenCalledWith(
      'user-1',
      'cultivator-1',
      'consumable-1',
      1,
      expect.any(Object),
    );
    expect(result.rewards).toHaveLength(1);
    expect(result.rewards[0]?.quantity).toBe(1);
    expect(result.talismanCounts.gongfa).toBe(1);
    expect(result.talismanCounts.skill).toBe(0);
  });

  it('可进行 5 连抽，并跨多个符箓堆叠扣除', async () => {
    jest.spyOn(Math, 'random').mockReturnValue(0);
    (MaterialGenerator.generateFromSkeletons as jest.Mock).mockResolvedValue(
      buildGeneratedMaterials('skill_manual'),
    );
    mockSelectChain.limit.mockResolvedValueOnce([
      {
        id: 'consumable-1',
        cultivatorId: 'cultivator-1',
        name: '神通衍化符',
        type: '符箓',
        quantity: 3,
        mechanicKey: 'skill_draw_access',
        createdAt: new Date(),
      },
      {
        id: 'consumable-2',
        cultivatorId: 'cultivator-1',
        name: '神通衍化符',
        type: '符箓',
        quantity: 4,
        mechanicKey: null,
        createdAt: new Date(),
      },
    ]);
    mockSelectChain.limit.mockResolvedValueOnce([]);
    mockSelectChain.limit.mockResolvedValueOnce([
      {
        id: 'consumable-1',
        cultivatorId: 'cultivator-1',
        name: '神通衍化符',
        type: '符箓',
        quantity: 2,
        mechanicKey: 'skill_draw_access',
        createdAt: new Date(),
      },
    ]);

    const result = await ManualDrawService.draw(
      'user-1',
      'cultivator-1',
      'skill',
      5,
    );

    expect(MaterialGenerator.generateFromSkeletons).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'skill_manual',
          rank: '真品',
          quantity: 1,
        }),
      ]),
    );
    expect(
      (
        (MaterialGenerator.generateFromSkeletons as jest.Mock).mock.calls[0]?.[0] ??
        []
      ).every((skeleton: { rank: string }) => skeleton.rank !== '凡品'),
    ).toBe(true);
    expect(consumeConsumableById).toHaveBeenNthCalledWith(
      1,
      'user-1',
      'cultivator-1',
      'consumable-1',
      3,
      expect.any(Object),
    );
    expect(consumeConsumableById).toHaveBeenNthCalledWith(
      2,
      'user-1',
      'cultivator-1',
      'consumable-2',
      2,
      expect.any(Object),
    );
    expect(result.rewards).toHaveLength(5);
    expect(result.rewards.every((reward) => reward.quantity === 1)).toBe(true);
    expect(result.talismanCounts.skill).toBe(2);
  });

  it('符箓不足时抽取失败', async () => {
    mockSelectChain.limit.mockResolvedValue([
      {
        id: 'consumable-1',
        cultivatorId: 'cultivator-1',
        name: '悟道演法符',
        type: '符箓',
        quantity: 2,
        mechanicKey: 'gongfa_draw_access',
        createdAt: new Date(),
      },
    ]);

    await expect(
      ManualDrawService.draw('user-1', 'cultivator-1', 'gongfa', 5),
    ).rejects.toThrow('悟道演法符不足');
    expect(resourceEngine.gain).not.toHaveBeenCalled();
  });

  it('仅允许抽 1 次或 5 连抽', async () => {
    await expect(
      ManualDrawService.draw('user-1', 'cultivator-1', 'gongfa', 3),
    ).rejects.toThrow('当前仅支持抽 1 次或 5 连抽');
  });

  it('可读取两种符箓的剩余数量', async () => {
    mockSelectChain.limit.mockResolvedValueOnce([
      {
        id: 'consumable-1',
        cultivatorId: 'cultivator-1',
        name: '悟道演法符',
        type: '符箓',
        quantity: 2,
        mechanicKey: 'gongfa_draw_access',
        createdAt: new Date(),
      },
      {
        id: 'consumable-2',
        cultivatorId: 'cultivator-1',
        name: '悟道演法符',
        type: '符箓',
        quantity: 1,
        mechanicKey: null,
        createdAt: new Date(),
      },
    ]);
    mockSelectChain.limit.mockResolvedValueOnce([
      {
        id: 'consumable-3',
        cultivatorId: 'cultivator-1',
        name: '神通衍化符',
        type: '符箓',
        quantity: 4,
        mechanicKey: 'skill_draw_access',
        createdAt: new Date(),
      },
    ]);

    const status = await ManualDrawService.getStatus('cultivator-1');

    expect(status.talismanCounts).toEqual({
      gongfa: 3,
      skill: 4,
    });
  });
});
