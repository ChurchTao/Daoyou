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
  resolveLayerConfigMock,
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
  resolveLayerConfigMock: vi.fn((layer: string) => ({
    count: 1,
    rankRange: layer === 'black'
      ? { min: '灵品', max: '仙品' }
      : { min: '凡品', max: '玄品' },
    access: {},
  })),
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
  resolveLayerConfig: resolveLayerConfigMock,
  validateLayerAccess: validateLayerAccessMock,
}));

import {
  batchBuyMarketItems,
  buyMarketItem,
  getMarketListings,
  identifyMysteryMaterial,
} from './MarketService';

function createPurchaseExecutor(insertValues: (values: unknown) => void) {
  return {
    transaction: async (callback: (tx: any) => Promise<void>) =>
      callback({
        update() {
          return {
            set() {
              return {
                where() {
                  return {
                    returning: async () => [{ id: 'cultivator-1' }],
                  };
                },
              };
            },
          };
        },
        insert() {
          return {
            values: async (values: unknown) => {
              insertValues(values);
            },
          };
        },
      }),
  };
}

function createIdentifyExecutor(state: {
  materialRow: any;
  insertedValues: any[];
}) {
  return {
    select() {
      return {
        from() {
          return {
            where() {
              return {
                limit: async () => [state.materialRow],
              };
            },
          };
        },
      };
    },
    transaction: async (callback: (tx: any) => Promise<void>) =>
      callback({
        update() {
          return {
            set() {
              return {
                where() {
                  return {
                    returning: async () => [{ id: 'cultivator-1' }],
                  };
                },
              };
            },
          };
        },
        delete() {
          return {
            where: async () => undefined,
          };
        },
        insert() {
          return {
            values(values: unknown) {
              state.insertedValues.push(values);
              return {
                returning: async () => [{ id: `revealed-${state.insertedValues.length}` }],
              };
            },
          };
        },
      }),
  };
}

describe('MarketService', () => {
  beforeEach(() => {
    vi.useRealTimers();
    createMessageMock.mockReset();
    generateRandomMock.mockReset();
    getCurrentCycleMock.mockClear();
    getCycleEndTimeMock.mockClear();
    getExecutorMock.mockClear();
    getExecutorMock.mockImplementation(() => ({
      transaction: vi.fn(),
    }));
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
    resolveLayerConfigMock.mockClear();
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

  it('does not cache real mystery reveal materials on the black market shelf', async () => {
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0);
    redisGetMock.mockResolvedValueOnce(null);
    redisSetMock.mockResolvedValue('OK');
    redisSmembersMock.mockResolvedValueOnce([]);
    generateRandomMock.mockResolvedValueOnce([
      {
        name: '九叶金芝',
        type: 'herb',
        rank: '天品',
        element: '木',
        description: '真实高阶灵草。',
        quantity: 1,
        price: 50000,
      },
    ]);

    try {
      const result = await getMarketListings({
        nodeId: 'node-1',
        layer: 'black',
        userId: 'user-1',
        cultivatorRealm: '炼气',
      });

      expect(result.listings[0]).toMatchObject({
        isMystery: true,
        mysteryMask: { badge: '?' },
      });
      const cacheSetCall = redisSetMock.mock.calls.find(
        ([key]) => key === 'market:v2:listings:node-1:black:7',
      );
      expect(cacheSetCall).toBeTruthy();
      const cached = JSON.parse(cacheSetCall![1] as string);
      expect(cached.listings[0].mysteryContext).toMatchObject({
        type: 'herb',
        rankRange: { min: '灵品', max: '天品' },
        anchorPrice: 5000,
        nodeId: 'node-1',
        layer: 'black',
      });
      expect(cached.listings[0]).not.toHaveProperty('mysteryPayload');
      expect(cached.listings[0].mysteryContext).not.toHaveProperty('material');
    } finally {
      randomSpy.mockRestore();
    }
  });

  it('stores only mystery reveal context when buying a mystery listing', async () => {
    const insertValuesMock = vi.fn();
    getExecutorMock.mockImplementationOnce(
      () => createPurchaseExecutor(insertValuesMock) as any,
    );
    redisSetMock.mockResolvedValue('OK');
    redisGetMock.mockResolvedValueOnce(
      JSON.stringify({
        listings: [
          {
            id: 'listing-1',
            nodeId: 'node-1',
            layer: 'black',
            name: '封泥药囊',
            type: 'herb',
            rank: '玄品',
            element: '木',
            description: '药香被封泥遮蔽。',
            details: {},
            quantity: 1,
            price: 88,
            isMystery: true,
            mysteryMask: { badge: '?', disguisedName: '封泥药囊' },
            mysteryContext: {
              type: 'herb',
              rankRange: { min: '凡品', max: '玄品' },
              nodeId: 'node-1',
              layer: 'black',
              regionTags: ['tiannan'],
              createdAt: 123,
            },
          },
        ],
        generatedAt: 123,
      }),
    );
    redisSismemberMock.mockResolvedValueOnce(0);

    await buyMarketItem({
      nodeId: 'node-1',
      layer: 'black',
      listingId: 'listing-1',
      quantity: 1,
      userId: 'user-1',
      cultivatorId: 'cultivator-1',
      cultivatorRealm: '炼气',
    });

    expect(insertValuesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        name: '封泥药囊',
        details: {
          mystery: expect.objectContaining({
            type: 'herb',
            rankRange: { min: '凡品', max: '玄品' },
            nodeId: 'node-1',
            layer: 'black',
            regionTags: ['tiannan'],
            anchorPrice: 88,
          }),
        },
      }),
    );
    expect(insertValuesMock.mock.calls[0][0].details.mystery).not.toHaveProperty(
      'material',
    );
    expect(
      redisSetMock.mock.calls.some(([key]) =>
        String(key).startsWith('market:mystery:'),
      ),
    ).toBe(false);
  });

  it('ignores legacy Redis payloads and rolls a fresh reveal during identification', async () => {
    const state = {
      materialRow: {
        id: 'material-1',
        cultivatorId: 'cultivator-1',
        name: '封泥药囊',
        type: 'herb',
        rank: '玄品',
        element: '木',
        description: '药香被封泥遮蔽。',
        quantity: 1,
        details: {
          mystery: {
            mysteryId: 'mystery-1',
            identifyCost: 200,
            disguiseTier: '玄品',
            type: 'herb',
            rankRange: { min: '凡品', max: '玄品' },
            nodeId: 'node-1',
            layer: 'black',
            regionTags: [],
            purchasedAt: 123,
          },
        },
      },
      insertedValues: [] as any[],
    };
    getExecutorMock.mockImplementation(() => createIdentifyExecutor(state) as any);
    redisSetMock.mockResolvedValue('OK');
    redisGetMock.mockResolvedValueOnce(
      JSON.stringify({
        material: {
          name: '旧缓存天品',
          type: 'herb',
          rank: '天品',
          element: '木',
          description: '不应被使用。',
          quantity: 1,
        },
      }),
    );
    generateRandomMock.mockResolvedValueOnce([
      {
        name: '新随机灵草',
        type: 'herb',
        rank: '玄品',
        element: '木',
        description: '鉴定时重新生成。',
        quantity: 1,
        price: 1000,
      },
    ]);

    const result = await identifyMysteryMaterial({
      materialId: 'material-1',
      cultivatorId: 'cultivator-1',
    });

    expect(generateRandomMock).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        specifiedType: 'herb',
        rankRange: { min: '凡品', max: '玄品' },
      }),
    );
    expect(result.revealedItem).toMatchObject({
      id: 'revealed-1',
      name: '新随机灵草',
      rank: '玄品',
    });
    expect(state.insertedValues[0]).toMatchObject({
      name: '新随机灵草',
      rank: '玄品',
    });
  });

  it('rolls independent reveal results for separate mystery identifications', async () => {
    const state = {
      materialRow: {
        id: 'material-1',
        cultivatorId: 'cultivator-1',
        name: '封泥药囊',
        type: 'herb',
        rank: '玄品',
        element: '木',
        description: '药香被封泥遮蔽。',
        quantity: 1,
        details: {
          mystery: {
            mysteryId: 'mystery-1',
            identifyCost: 200,
            disguiseTier: '玄品',
            type: 'herb',
            rankRange: { min: '凡品', max: '玄品' },
            nodeId: 'node-1',
            layer: 'black',
            regionTags: [],
            purchasedAt: 123,
          },
        },
      },
      insertedValues: [] as any[],
    };
    getExecutorMock.mockImplementation(() => createIdentifyExecutor(state) as any);
    redisSetMock.mockResolvedValue('OK');
    generateRandomMock
      .mockResolvedValueOnce([
        {
          name: '新随机灵草甲',
          type: 'herb',
          rank: '灵品',
          element: '木',
          description: '第一次鉴定。',
          quantity: 1,
          price: 300,
        },
      ])
      .mockResolvedValueOnce([
        {
          name: '新随机灵草乙',
          type: 'herb',
          rank: '玄品',
          element: '木',
          description: '第二次鉴定。',
          quantity: 1,
          price: 1000,
        },
      ]);

    const first = await identifyMysteryMaterial({
      materialId: 'material-1',
      cultivatorId: 'cultivator-1',
    });
    state.materialRow = {
      ...state.materialRow,
      id: 'material-2',
      cultivatorId: 'cultivator-2',
      details: {
        mystery: {
          ...state.materialRow.details.mystery,
          mysteryId: 'mystery-2',
        },
      },
    };
    const second = await identifyMysteryMaterial({
      materialId: 'material-2',
      cultivatorId: 'cultivator-2',
    });

    expect(first.revealedItem.name).toBe('新随机灵草甲');
    expect(second.revealedItem.name).toBe('新随机灵草乙');
    expect(generateRandomMock).toHaveBeenCalledTimes(2);
  });
});
