import { getExecutor } from '@/lib/drizzle/db';
import { redis } from '@/lib/redis';
import { RealmType } from '@/types/constants';
import { batchBuyMarketItems } from './MarketService';

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

jest.mock('@/lib/game/marketConfig', () => ({
  getMarketConfigByNodeId: jest.fn(() => ({ enabled: true })),
  isMarketNodeEnabled: jest.fn(() => true),
  validateLayerAccess: jest.fn(() => ({ allowed: true })),
  getLayerConfig: jest.fn(() => ({ count: 10, rankRange: ['凡品', '灵品'] })),
}));

describe('MarketService batchBuyMarketItems', () => {
  const mockCultivatorId = 'cultivator-1';
  const mockNodeId = 'node-1';
  const mockLayer = 'common';
  const mockRealm = '炼气' as RealmType;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should throw error if items list is empty', async () => {
    await expect(
      batchBuyMarketItems({
        nodeId: mockNodeId,
        layer: mockLayer,
        items: [],
        cultivatorId: mockCultivatorId,
        cultivatorRealm: mockRealm,
      }),
    ).rejects.toThrow('购买列表不能为空');
  });

  it('should successfully buy multiple items in batch', async () => {
    const mockListings = [
      { id: 'item-1', name: 'Item 1', price: 100, quantity: 5, type: 'herb', rank: '凡品' },
      { id: 'item-2', name: 'Item 2', price: 200, quantity: 10, type: 'ore', rank: '灵品' },
    ];

    (redis.get as jest.Mock).mockResolvedValue({ listings: [...mockListings], nextRefresh: Date.now() + 10000 });
    (redis.set as jest.Mock).mockResolvedValue('OK');

    const mockTx = {
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue([]), // 默认返回空，即不堆叠
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      returning: jest.fn().mockResolvedValue([{ id: mockCultivatorId }]),
      insert: jest.fn().mockReturnThis(),
      values: jest.fn().mockResolvedValue([{ id: 'new-mat-1' }]),
    };

    (getExecutor as jest.Mock).mockReturnValue({
      transaction: jest.fn(async (cb) => await cb(mockTx)),
    });

    const result = await batchBuyMarketItems({
      nodeId: mockNodeId,
      layer: mockLayer,
      items: [
        { listingId: 'item-1', quantity: 2 },
        { listingId: 'item-2', quantity: 1 },
      ],
      cultivatorId: mockCultivatorId,
      cultivatorRealm: mockRealm,
    });

    expect(result.success).toBe(true);
    expect(result.totalCost).toBe(400); // (100 * 2) + (200 * 1)
    expect(redis.set).toHaveBeenCalled();
  });

  it('should throw error if any item quantity is invalid', async () => {
    await expect(
      batchBuyMarketItems({
        nodeId: mockNodeId,
        layer: mockLayer,
        items: [{ listingId: 'item-1', quantity: 0 }],
        cultivatorId: mockCultivatorId,
        cultivatorRealm: mockRealm,
      }),
    ).rejects.toThrow('购买数量必须大于 0');
  });

  it('should throw error if stock is insufficient for any item', async () => {
    const mockListings = [
      { id: 'item-1', name: 'Item 1', price: 100, quantity: 1, type: 'herb', rank: '凡品' },
    ];

    (redis.get as jest.Mock).mockResolvedValue({ listings: mockListings, nextRefresh: Date.now() + 10000 });

    await expect(
      batchBuyMarketItems({
        nodeId: mockNodeId,
        layer: mockLayer,
        items: [{ listingId: 'item-1', quantity: 2 }],
        cultivatorId: mockCultivatorId,
        cultivatorRealm: mockRealm,
      }),
    ).rejects.toThrow('坊市库存不足');
  });
});
