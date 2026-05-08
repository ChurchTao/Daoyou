import { getExecutor } from '@/lib/drizzle/db';
import { redis } from '@/lib/redis';
import type { Cultivator, PreHeavenFate } from '@/types/cultivator';

jest.mock('@/lib/drizzle/db', () => ({
  getExecutor: jest.fn(),
}));

jest.mock('@/lib/redis', () => ({
  redis: {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  },
}));

jest.mock('./FateEngine', () => ({
  FateEngine: {
    generateCandidatePool: jest.fn(),
    normalizeFates: jest.fn((fates: PreHeavenFate[]) => fates),
  },
}));

jest.mock('./cultivatorService', () => ({
  consumeConsumableById: jest.fn(),
  getCultivatorById: jest.fn(),
  getCultivatorByIdUnsafe: jest.fn(),
  replacePreHeavenFates: jest.fn(),
}));

import { FateEngine } from './FateEngine';
import { FateReshapeService } from './FateReshapeService';
import {
  consumeConsumableById,
  getCultivatorById,
  getCultivatorByIdUnsafe,
  replacePreHeavenFates,
} from './cultivatorService';

const buildCultivator = (
  overrides: Partial<Cultivator> = {},
): Cultivator => ({
  id: 'cultivator-1',
  name: '韩立',
  gender: '男',
  realm: '炼气',
  realm_stage: '初期',
  age: 18,
  lifespan: 100,
  status: 'active',
  attributes: {
    vitality: 20,
    spirit: 18,
    wisdom: 22,
    speed: 19,
    willpower: 21,
  },
  spiritual_roots: [
    { element: '金', strength: 82, grade: '真灵根' },
    { element: '木', strength: 40, grade: '伪灵根' },
  ],
  pre_heaven_fates: [
    { name: '旧命格一', quality: '玄品', description: '旧命格描述一' },
    { name: '旧命格二', quality: '灵品', description: '旧命格描述二' },
    { name: '旧命格三', quality: '真品', description: '旧命格描述三' },
  ],
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
  prompt: '寒门剑修，想走极致锋锐之道',
  ...overrides,
});

const buildCandidatePool = (): PreHeavenFate[] =>
  Array.from({ length: 6 }, (_, index) => ({
    name: `候选命格${index + 1}`,
    quality: '玄品',
    description: `候选命格描述${index + 1}`,
  }));

describe('FateReshapeService', () => {
  const mockTransaction = jest.fn(
    async (callback: (tx: Record<string, never>) => unknown) => callback({}),
  );
  const mockSelectChain = {
    from: jest.fn(),
    where: jest.fn(),
    limit: jest.fn(),
  };
  const mockExecutor = {
    select: jest.fn(() => mockSelectChain),
    transaction: mockTransaction,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockSelectChain.from.mockReturnValue(mockSelectChain);
    mockSelectChain.where.mockReturnValue(mockSelectChain);
    mockSelectChain.limit.mockResolvedValue([]);
    mockTransaction.mockImplementation(
      async (callback: (tx: Record<string, never>) => unknown) => callback({}),
    );

    (getExecutor as jest.Mock).mockReturnValue(mockExecutor);
    (redis.get as jest.Mock).mockResolvedValue(null);
    (redis.set as jest.Mock).mockResolvedValue('OK');
    (redis.del as jest.Mock).mockResolvedValue(1);
    (getCultivatorById as jest.Mock).mockResolvedValue(buildCultivator());
    (getCultivatorByIdUnsafe as jest.Mock).mockResolvedValue({
      cultivator: buildCultivator(),
      userId: 'user-1',
    });
    (consumeConsumableById as jest.Mock).mockResolvedValue(undefined);
    (replacePreHeavenFates as jest.Mock).mockResolvedValue(undefined);
    (FateEngine.generateCandidatePool as jest.Mock).mockResolvedValue(
      buildCandidatePool(),
    );
  });

  it('有符时可开启会话并立即扣除一张符箓', async () => {
    mockSelectChain.limit.mockResolvedValue([
      {
        id: 'consumable-1',
        cultivatorId: 'cultivator-1',
        name: '天机逆命符',
        type: '符箓',
        quantity: 2,
        mechanicKey: 'fate_reshape_access',
        createdAt: new Date(),
      },
    ]);

    const session = await FateReshapeService.startSession(
      'user-1',
      'cultivator-1',
    );

    expect(consumeConsumableById).toHaveBeenCalledWith(
      'user-1',
      'cultivator-1',
      'consumable-1',
      1,
      expect.any(Object),
    );
    expect(FateEngine.generateCandidatePool).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'cultivator-1' }),
      { strategy: 'root_restricted' },
    );
    expect(session.currentCandidates).toHaveLength(6);
    expect(session.canReroll).toBe(true);
  });

  it('无符时开启失败', async () => {
    mockSelectChain.limit.mockResolvedValue([]);

    await expect(
      FateReshapeService.startSession('user-1', 'cultivator-1'),
    ).rejects.toThrow('缺少天机逆命符，无法开启命格重塑');
  });

  it('已有未完成会话时再次开启不会重复扣符', async () => {
    (redis.get as jest.Mock).mockResolvedValue({
      sessionId: 'session-1',
      cultivatorId: 'cultivator-1',
      originalFates: buildCultivator().pre_heaven_fates,
      currentCandidates: buildCandidatePool(),
      rerollUsed: false,
      createdAt: Date.now(),
      expiresAt: Date.now() + 60_000,
    });

    const session = await FateReshapeService.startSession(
      'user-1',
      'cultivator-1',
    );

    expect(consumeConsumableById).not.toHaveBeenCalled();
    expect(session.sessionId).toBe('session-1');
    expect(session.canReroll).toBe(true);
  });

  it('第一次重抽成功并替换候选，第二次重抽失败', async () => {
    const rerolledPool = buildCandidatePool().map((fate) => ({
      ...fate,
      name: `${fate.name}-重抽`,
    }));
    (redis.get as jest.Mock).mockResolvedValue({
      sessionId: 'session-1',
      cultivatorId: 'cultivator-1',
      originalFates: buildCultivator().pre_heaven_fates,
      currentCandidates: buildCandidatePool(),
      rerollUsed: false,
      createdAt: Date.now(),
      expiresAt: Date.now() + 60_000,
    });
    (FateEngine.generateCandidatePool as jest.Mock).mockResolvedValue(
      rerolledPool,
    );

    const nextSession = await FateReshapeService.rerollSession('cultivator-1');

    expect(nextSession.rerollUsed).toBe(true);
    expect(nextSession.canReroll).toBe(false);
    expect(nextSession.currentCandidates[0]?.name).toBe('候选命格1-重抽');

    (redis.get as jest.Mock).mockResolvedValue({
      sessionId: 'session-1',
      cultivatorId: 'cultivator-1',
      originalFates: buildCultivator().pre_heaven_fates,
      currentCandidates: rerolledPool,
      rerollUsed: true,
      createdAt: Date.now(),
      expiresAt: Date.now() + 60_000,
    });

    await expect(
      FateReshapeService.rerollSession('cultivator-1'),
    ).rejects.toThrow('本次命格重塑已无法再重抽');
  });

  it('确认时仅接受 3 个唯一索引', async () => {
    (redis.get as jest.Mock).mockResolvedValue({
      sessionId: 'session-1',
      cultivatorId: 'cultivator-1',
      originalFates: buildCultivator().pre_heaven_fates,
      currentCandidates: buildCandidatePool(),
      rerollUsed: false,
      createdAt: Date.now(),
      expiresAt: Date.now() + 60_000,
    });

    await expect(
      FateReshapeService.confirmSession('user-1', 'cultivator-1', [0, 1]),
    ).rejects.toThrow('请选择 3 个命格进行替换');
    await expect(
      FateReshapeService.confirmSession('user-1', 'cultivator-1', [0, 0, 1]),
    ).rejects.toThrow('请选择 3 个不同的命格进行替换');
    await expect(
      FateReshapeService.confirmSession('user-1', 'cultivator-1', [0, 1, 9]),
    ).rejects.toThrow('命格选择超出当前候选范围');
  });

  it('确认成功后会全量替换旧命格并删除会话', async () => {
    const candidates = buildCandidatePool();
    (redis.get as jest.Mock).mockResolvedValue({
      sessionId: 'session-1',
      cultivatorId: 'cultivator-1',
      originalFates: buildCultivator().pre_heaven_fates,
      currentCandidates: candidates,
      rerollUsed: false,
      createdAt: Date.now(),
      expiresAt: Date.now() + 60_000,
    });

    const selectedFates = await FateReshapeService.confirmSession(
      'user-1',
      'cultivator-1',
      [0, 2, 4],
    );

    expect(replacePreHeavenFates).toHaveBeenCalledWith(
      'user-1',
      'cultivator-1',
      [candidates[0], candidates[2], candidates[4]],
      expect.any(Object),
    );
    expect(redis.del).toHaveBeenCalledWith(
      'fate-reshape-session:cultivator-1',
    );
    expect(selectedFates).toEqual([candidates[0], candidates[2], candidates[4]]);
  });

  it('放弃会话后原命格保持不变并删除会话', async () => {
    (redis.get as jest.Mock).mockResolvedValue({
      sessionId: 'session-1',
      cultivatorId: 'cultivator-1',
      originalFates: buildCultivator().pre_heaven_fates,
      currentCandidates: buildCandidatePool(),
      rerollUsed: false,
      createdAt: Date.now(),
      expiresAt: Date.now() + 60_000,
    });

    await FateReshapeService.abandonSession('cultivator-1');

    expect(replacePreHeavenFates).not.toHaveBeenCalled();
    expect(redis.del).toHaveBeenCalledWith(
      'fate-reshape-session:cultivator-1',
    );
  });

  it('获取会话时会返回 null，与可用符箓数量可单独读取', async () => {
    mockSelectChain.limit.mockResolvedValue([
      {
        id: 'consumable-1',
        cultivatorId: 'cultivator-1',
        name: '天机逆命符',
        type: '符箓',
        quantity: 2,
        mechanicKey: 'fate_reshape_access',
        createdAt: new Date(),
      },
      {
        id: 'consumable-2',
        cultivatorId: 'cultivator-1',
        name: '天机逆命符',
        type: '符箓',
        quantity: 1,
        mechanicKey: null,
        createdAt: new Date(),
      },
    ]);

    const session = await FateReshapeService.getSession('cultivator-1');
    const talismanCount =
      await FateReshapeService.getAvailableTalismanCount('cultivator-1');

    expect(session).toBeNull();
    expect(talismanCount).toBe(3);
  });

  it('无会话时的重抽和放弃会返回明确错误', async () => {
    await expect(
      FateReshapeService.rerollSession('cultivator-1'),
    ).rejects.toMatchObject({
      status: 404,
      message: '未找到进行中的命格重塑会话',
    });
    await expect(
      FateReshapeService.abandonSession('cultivator-1'),
    ).rejects.toMatchObject({
      status: 404,
      message: '未找到进行中的命格重塑会话',
    });
  });
});
