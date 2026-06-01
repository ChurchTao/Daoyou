const {
  createMessageMock,
  generateRandomMock,
  getCurrentCycleMock,
  getCycleEndTimeMock,
  getExecutorMock,
  getMarketConfigByNodeIdMock,
  getRegionFlavorMock,
  getRefreshIntervalMock,
  isMarketNodeEnabledMock,
  redisDelMock,
  redisExpireMock,
  redisExistsMock,
  redisGetMock,
  redisSaddMock,
  redisSetMock,
  redisSismemberMock,
  redisSmembersMock,
  validateLayerAccessMock,
} = vi.hoisted(() => ({
  createMessageMock: vi.fn(),
  generateRandomMock: vi.fn(),
  getCurrentCycleMock: vi.fn(() => 7),
  getCycleEndTimeMock: vi.fn(() => 9999),
  getExecutorMock: vi.fn(() => ({
    transaction: vi.fn(),
  })),
  getMarketConfigByNodeIdMock: vi.fn(() => ({
    enabled: true,
    allowed_layers: ['common', 'treasure', 'heaven', 'black'],
    region_profile: 'default',
  })),
  getRegionFlavorMock: vi.fn(() => ({
    title: '测试坊市',
    description: '测试描述',
  })),
  getRefreshIntervalMock: vi.fn(() => 900_000),
  isMarketNodeEnabledMock: vi.fn(() => true),
  redisDelMock: vi.fn(),
  redisExpireMock: vi.fn(),
  redisExistsMock: vi.fn(),
  redisGetMock: vi.fn(),
  redisSaddMock: vi.fn(),
  redisSetMock: vi.fn(),
  redisSismemberMock: vi.fn(),
  redisSmembersMock: vi.fn(),
  validateLayerAccessMock: vi.fn(() => ({ allowed: true })),
}));

vi.mock('@server/lib/drizzle/db', () => ({
  getExecutor: getExecutorMock,
}));

vi.mock('@server/lib/redis', () => ({
  redis: {
    del: redisDelMock,
    expire: redisExpireMock,
    exists: redisExistsMock,
    get: redisGetMock,
    sadd: redisSaddMock,
    set: redisSetMock,
    sismember: redisSismemberMock,
    smembers: redisSmembersMock,
  },
}));

vi.mock('@server/lib/repositories/worldChatRepository', () => ({
  createMessage: createMessageMock,
}));

vi.mock('@shared/engine/material/creation/MaterialGenerator', () => ({
  MaterialGenerator: {
    generateRandom: generateRandomMock,
  },
}));

vi.mock('@shared/lib/game/marketConfig', () => ({
  getCurrentCycle: getCurrentCycleMock,
  getCycleEndTime: getCycleEndTimeMock,
  getDefaultMarketNodeId: vi.fn(() => 'node-1'),
  getMarketConfigByNodeId: getMarketConfigByNodeIdMock,
  getNodeRegionTags: vi.fn(() => []),
  getRegionFlavor: getRegionFlavorMock,
  getRegionProfile: vi.fn(() => ({
    typeWeights: {},
    priceModifier: { min: 1, max: 1 },
    layerOverrides: {},
    signatureTags: [],
    signatureRatio: 0,
  })),
  getRefreshInterval: getRefreshIntervalMock,
  isMarketNodeEnabled: isMarketNodeEnabledMock,
  MARKET_STALE_RETRY_MS: 15_000,
  MYSTERY_MAPPING_TTL_SEC: 72 * 60 * 60,
  resolveLayerConfig: vi.fn(() => ({
    count: 1,
    rankRange: { min: '凡品', max: '玄品' },
    access: {},
  })),
  validateLayerAccess: validateLayerAccessMock,
}));

import {
  batchBuyMarketItems,
  buyMarketItem,
  getMarketListings,
} from './MarketService';

describe('MarketService', () => {
  beforeEach(() => {
    vi.useRealTimers();
    createMessageMock.mockReset();
    generateRandomMock.mockReset();
    getCurrentCycleMock.mockClear();
    getCycleEndTimeMock.mockClear();
    getExecutorMock.mockClear();
    getMarketConfigByNodeIdMock.mockClear();
    getRegionFlavorMock.mockClear();
    getRefreshIntervalMock.mockClear();
    isMarketNodeEnabledMock.mockClear();
    redisDelMock.mockReset();
    redisExpireMock.mockReset();
    redisExistsMock.mockReset();
    redisGetMock.mockReset();
    redisSaddMock.mockReset();
    redisSetMock.mockReset();
    redisSismemberMock.mockReset();
    redisSmembersMock.mockReset();
    validateLayerAccessMock.mockClear();
  });

  it('waits for the current cycle cache when another request is generating it', async () => {
    vi.useFakeTimers();

    redisGetMock
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(
        JSON.stringify({
          listings: [
            {
              id: 'listing-1',
              nodeId: 'node-1',
              layer: 'common',
              name: '青灵草',
              type: 'herb',
              rank: '凡品',
              element: '木',
              description: '测试材料',
              details: {},
              quantity: 1,
              price: 88,
            },
          ],
          generatedAt: 123,
        }),
      );
    redisSetMock.mockResolvedValueOnce(null);
    redisSmembersMock.mockResolvedValueOnce([]);

    const resultPromise = getMarketListings({
      nodeId: 'node-1',
      layer: 'common',
      userId: 'user-1',
      cultivatorRealm: '炼气',
    });

    await vi.runAllTimersAsync();
    const result = await resultPromise;

    expect(redisGetMock).toHaveBeenNthCalledWith(
      1,
      'market:v2:listings:node-1:common:7',
    );
    expect(redisSetMock).toHaveBeenCalledWith(
      'market:v2:generating:node-1:common:7',
      '1',
      'EX',
      120,
      'NX',
    );
    expect(redisSmembersMock).toHaveBeenCalledWith(
      'market:v2:bought:user-1:node-1:common:7',
    );
    expect(result.listings).toEqual([
      expect.objectContaining({
        id: 'listing-1',
        quantity: 1,
      }),
    ]);
    expect(result.nextRefresh).toBe(9999);
  });

  it('rejects buying more than one unit from the shared shelf', async () => {
    await expect(
      buyMarketItem({
        nodeId: 'node-1',
        layer: 'common',
        listingId: 'listing-1',
        quantity: 2,
        userId: 'user-1',
        cultivatorId: 'cultivator-1',
        cultivatorRealm: '炼气',
      }),
    ).rejects.toMatchObject({
      status: 400,
      message: '新版坊市每次仅可购入 1 件',
    });

    expect(redisSetMock).not.toHaveBeenCalled();
  });

  it('rejects duplicate listing ids in a batch request', async () => {
    await expect(
      batchBuyMarketItems({
        nodeId: 'node-1',
        layer: 'common',
        items: [
          { listingId: 'listing-1', quantity: 1 },
          { listingId: 'listing-1', quantity: 1 },
        ],
        userId: 'user-1',
        cultivatorId: 'cultivator-1',
        cultivatorRealm: '炼气',
      }),
    ).rejects.toMatchObject({
      status: 400,
      message: '批量购买中存在重复物品',
    });

    expect(redisSetMock).not.toHaveBeenCalled();
  });
});
