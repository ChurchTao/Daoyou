const {
  createMessageMock,
  generateRandomMock,
  getCurrentCycleMock,
  getCycleEndTimeMock,
  getExecutorMock,
  getMarketConfigByNodeIdMock,
  getRegionFlavorMock,
  getRefreshIntervalMock,
  materialLibraryEntryToMaterialMock,
  isMarketNodeEnabledMock,
  qiCommitReservationMock,
  qiGetCostMock,
  qiReserveQiMock,
  redisDelMock,
  redisExpireMock,
  redisExistsMock,
  redisGetMock,
  redisSaddMock,
  redisSetMock,
  redisSismemberMock,
  redisSmembersMock,
  resolveLayerConfigMock,
  sampleMaterialForRangeMock,
  sampleMaterialLibraryEntriesMock,
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
  materialLibraryEntryToMaterialMock: vi.fn((entry: any) => ({
    name: entry.payload.name,
    type: entry.payload.type,
    rank: entry.payload.rank,
    element: entry.payload.element,
    description: entry.payload.description,
    details: {},
    quantity: 1,
  })),
  isMarketNodeEnabledMock: vi.fn(() => true),
  qiCommitReservationMock: vi.fn(),
  qiGetCostMock: vi.fn(() => 1),
  qiReserveQiMock: vi.fn(() => ({
    success: true,
    action: 'market_identify',
    actionInstanceId: 'market-identify:mystery-1',
    qiBefore: 200,
    qiAfter: 199,
    consumed: 1,
  })),
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
  sampleMaterialForRangeMock: vi.fn(),
  sampleMaterialLibraryEntriesMock: vi.fn(),
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

vi.mock('./MaterialLibraryService', () => ({
  materialLibraryEntryToMaterial: materialLibraryEntryToMaterialMock,
  sampleMaterialForRange: sampleMaterialForRangeMock,
  sampleMaterialLibraryEntries: sampleMaterialLibraryEntriesMock,
}));

vi.mock('./QiService', () => ({
  QiService: {
    getCost: qiGetCostMock,
    reserveQi: qiReserveQiMock,
    commitReservation: qiCommitReservationMock,
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
import type { PreHeavenFate } from '@shared/types/cultivator';

function createPurchaseTx(
  insertValues: (values: unknown) => void,
  recordUpdate?: (values: unknown) => void,
) {
  return {
    update() {
      return {
        set(values: unknown) {
          recordUpdate?.(values);
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
    select() {
      return {
        from() {
          return {
            where() {
              return {
                orderBy() {
                  return {
                    limit: async () => [],
                  };
                },
              };
            },
          };
        },
      };
    },
    insert() {
      return {
        values: (values: unknown) => {
          insertValues(values);
          return {
            returning: async () => [{ id: 'material-1' }],
          };
        },
      };
    },
  };
}

function createPurchaseExecutor(
  insertValues: (values: unknown) => void,
  recordUpdate?: (values: unknown) => void,
) {
  const tx = createPurchaseTx(insertValues, recordUpdate);
  return {
    transaction: async (callback: (tx: any) => Promise<void>) => callback(tx),
  };
}

const marketDiscountFate = (value: number): PreHeavenFate => ({
  name: '测试识价命',
  quality: '真品',
  description: '测试坊市折扣。',
  effects: [
    {
      id: 'test-market-discount',
      effectId: 'market-purchase-discount',
      scope: 'daily',
      polarity: 'boon',
      effectType: 'market_purchase_price_multiplier',
      value,
      label: '坊市购买价格 -20%',
      description: '测试折扣。',
      rollMeta: {
        qualityAnchor: '真品',
        minValue: value,
        maxValue: value,
        rolledPercentile: 0,
        roundingStep: 0.01,
      },
    },
  ],
});

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
    materialLibraryEntryToMaterialMock.mockClear();
    materialLibraryEntryToMaterialMock.mockImplementation((entry: any) => ({
      name: entry.payload.name,
      type: entry.payload.type,
      rank: entry.payload.rank,
      element: entry.payload.element,
      description: entry.payload.description,
      details: {},
      quantity: 1,
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
    qiCommitReservationMock.mockReset();
    qiGetCostMock.mockReset();
    qiGetCostMock.mockReturnValue(1);
    qiReserveQiMock.mockReset();
    qiReserveQiMock.mockResolvedValue({
      success: true,
      action: 'market_identify',
      actionInstanceId: 'market-identify:mystery-1',
      qiBefore: 200,
      qiAfter: 199,
      consumed: 1,
    });
    resolveLayerConfigMock.mockClear();
    sampleMaterialForRangeMock.mockReset();
    sampleMaterialLibraryEntriesMock.mockReset();
    sampleMaterialLibraryEntriesMock.mockResolvedValue(
      new Map([
        [
          'herb:灵品',
          [
            {
              itemId: 'mat-herb-ling',
              payload: {
                name: '九叶金芝',
                type: 'herb',
                rank: '天品',
                element: '木',
                description: '真实高阶灵草。',
              },
            },
          ],
        ],
        [
          'aux:玄品',
          [
            {
              itemId: 'mat-aux-xuan',
              payload: {
                name: '玄雷辅液',
                type: 'aux',
                rank: '玄品',
                element: '雷',
                description: '炼体辅料。',
              },
            },
          ],
        ],
      ]),
    );
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

  it('returns discounted listing prices with basePrice when market purchase fate applies', async () => {
    redisGetMock.mockResolvedValueOnce(
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
            price: 100,
          },
        ],
        generatedAt: 123,
      }),
    );
    redisSmembersMock.mockResolvedValueOnce([]);

    const result = await getMarketListings({
      nodeId: 'node-1',
      layer: 'common',
      userId: 'user-1',
      cultivatorRealm: '炼气',
      fates: [marketDiscountFate(0.8)],
    });

    expect(result.listings[0]).toMatchObject({
      id: 'listing-1',
      price: 80,
      basePrice: 100,
    });
  });

  it('keeps listing prices unchanged when no market purchase fate applies', async () => {
    redisGetMock.mockResolvedValueOnce(
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
            price: 100,
          },
        ],
        generatedAt: 123,
      }),
    );
    redisSmembersMock.mockResolvedValueOnce([]);

    const result = await getMarketListings({
      nodeId: 'node-1',
      layer: 'common',
      userId: 'user-1',
      cultivatorRealm: '炼气',
    });

    expect(result.listings[0]).toMatchObject({
      id: 'listing-1',
      price: 100,
    });
    expect(result.listings[0]?.basePrice).toBeUndefined();
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

  it('returns discounted purchase item prices for single buys', async () => {
    const insertValuesMock = vi.fn();
    const tx = createPurchaseTx(insertValuesMock) as any;
    getExecutorMock.mockImplementation((maybeTx?: any) => maybeTx ?? tx);
    redisSetMock.mockResolvedValue('OK');
    redisGetMock.mockResolvedValueOnce(
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
            price: 100,
          },
        ],
        generatedAt: 123,
      }),
    );
    redisSismemberMock.mockResolvedValueOnce(0);

    const result = await buyMarketItem({
      nodeId: 'node-1',
      layer: 'common',
      listingId: 'listing-1',
      quantity: 1,
      userId: 'user-1',
      cultivatorId: 'cultivator-1',
      cultivatorRealm: '炼气',
      fates: [marketDiscountFate(0.8)],
      tx,
    });

    expect(result.item).toMatchObject({
      id: 'listing-1',
      price: 80,
      basePrice: 100,
    });
  });

  it('uses discounted total cost for batch buys', async () => {
    const insertValuesMock = vi.fn();
    const tx = createPurchaseTx(insertValuesMock) as any;
    getExecutorMock.mockImplementation((maybeTx?: any) => maybeTx ?? tx);
    redisSetMock.mockResolvedValue('OK');
    redisGetMock.mockResolvedValueOnce(
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
            price: 100,
          },
          {
            id: 'listing-2',
            nodeId: 'node-1',
            layer: 'common',
            name: '赤芽花',
            type: 'herb',
            rank: '凡品',
            element: '火',
            description: '测试材料。',
            details: {},
            quantity: 1,
            price: 100,
          },
        ],
        generatedAt: 123,
      }),
    );
    redisSmembersMock.mockResolvedValueOnce([]);

    const result = await batchBuyMarketItems({
      nodeId: 'node-1',
      layer: 'common',
      items: [
        { listingId: 'listing-1', quantity: 1 },
        { listingId: 'listing-2', quantity: 1 },
      ],
      userId: 'user-1',
      cultivatorId: 'cultivator-1',
      cultivatorRealm: '炼气',
      fates: [marketDiscountFate(0.8)],
      tx,
    });

    expect(result.totalCost).toBe(160);
  });

  it('does not cache real mystery reveal materials on the black market shelf', async () => {
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0);
    redisGetMock.mockResolvedValueOnce(null);
    redisSetMock.mockResolvedValue('OK');
    redisSmembersMock.mockResolvedValueOnce([]);
    resolveLayerConfigMock.mockReturnValueOnce({
      count: 1,
      rankRange: { min: '天品', max: '天品' },
      access: {},
    });
    sampleMaterialLibraryEntriesMock.mockResolvedValueOnce(
      new Map([
        [
          'herb:天品',
          [
            {
              itemId: 'mat-herb-tian',
              payload: {
                name: '九叶金芝',
                type: 'herb',
                rank: '天品',
                element: '木',
                description: '真实高阶灵草。',
              },
            },
          ],
        ],
      ]),
    );

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
        rankRange: { min: '天品', max: '天品' },
        anchorPrice: 5000,
        nodeId: 'node-1',
        layer: 'black',
      });
      expect(cached.listings[0]).not.toHaveProperty('mysteryPayload');
      expect(cached.listings[0].mysteryContext).not.toHaveProperty('material');
      expect(generateRandomMock).not.toHaveBeenCalled();
    } finally {
      randomSpy.mockRestore();
    }
  });

  it('uses preset fallback for low-layer shelves when the material library is empty', async () => {
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0);
    redisGetMock.mockResolvedValueOnce(null);
    redisSetMock.mockResolvedValue('OK');
    redisSmembersMock.mockResolvedValueOnce([]);
    sampleMaterialLibraryEntriesMock.mockResolvedValueOnce(new Map());
    resolveLayerConfigMock.mockReturnValueOnce({
      count: 1,
      rankRange: { min: '凡品', max: '凡品' },
      access: {},
    });

    try {
      const result = await getMarketListings({
        nodeId: 'node-1',
        layer: 'common',
        userId: 'user-1',
        cultivatorRealm: '炼气',
      });

      expect(result.listings).toHaveLength(1);
      expect(result.listings[0]).toMatchObject({
        layer: 'common',
        type: 'herb',
        rank: '凡品',
        quantity: 1,
      });
      expect(generateRandomMock).not.toHaveBeenCalled();
    } finally {
      randomSpy.mockRestore();
    }
  });

  it('returns an empty high-layer shelf and warns when the material library is empty', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0);
    redisGetMock.mockResolvedValueOnce(null);
    redisSetMock.mockResolvedValue('OK');
    redisSmembersMock.mockResolvedValueOnce([]);
    sampleMaterialLibraryEntriesMock.mockResolvedValueOnce(new Map());
    resolveLayerConfigMock.mockReturnValueOnce({
      count: 1,
      rankRange: { min: '天品', max: '天品' },
      access: {},
    });

    try {
      const result = await getMarketListings({
        nodeId: 'node-1',
        layer: 'heaven',
        userId: 'user-1',
        cultivatorRealm: '化神',
      });

      expect(result.listings).toEqual([]);
      expect(result.nextRefresh).toBe(9999);
      expect(generateRandomMock).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('未配置道具库或材料候选不足 node-1:heaven'),
      );

      const cacheSetCall = redisSetMock.mock.calls.find(
        ([key]) => key === 'market:v2:listings:node-1:heaven:7',
      );
      expect(cacheSetCall).toBeTruthy();
      const cached = JSON.parse(cacheSetCall![1] as string);
      expect(cached.listings).toEqual([]);
    } finally {
      warnSpy.mockRestore();
      randomSpy.mockRestore();
    }
  });

  it('does not inject deterministic body-cultivation materials into treasure preset shelves', async () => {
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0);
    redisGetMock.mockResolvedValueOnce(null);
    redisSetMock.mockResolvedValue('OK');
    redisSmembersMock.mockResolvedValueOnce([]);
    resolveLayerConfigMock.mockReturnValueOnce({
      count: 1,
      rankRange: { min: '玄品', max: '玄品' },
      access: {},
    });

    try {
      const result = await getMarketListings({
        nodeId: 'node-1',
        layer: 'treasure',
        userId: 'user-1',
        cultivatorRealm: '筑基',
      });

      expect(result.listings).toEqual([
        expect.objectContaining({
          rank: '玄品',
          quantity: 1,
        }),
      ]);
      expect(result.listings[0]?.name).not.toBe('铜皮破限液');
      expect(generateRandomMock).not.toHaveBeenCalled();
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
            mysteryReveal: {
              name: '新随机灵草',
              type: 'herb',
              rank: '玄品',
              element: '木',
              description: '购买时已绑定。',
              details: {},
              quantity: 1,
              boundAt: '2026-06-22T00:00:00.000Z',
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
          __serverHiddenMysteryReveal: expect.objectContaining({
            name: '新随机灵草',
            rank: '玄品',
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
    sampleMaterialForRangeMock.mockResolvedValueOnce({
      itemId: 'mat-herb-xuan',
      payload: {
        name: '新随机灵草',
        type: 'herb',
        rank: '玄品',
        element: '木',
        description: '鉴定时从材料库抽取。',
      },
    });
    materialLibraryEntryToMaterialMock.mockReturnValueOnce(
      {
        name: '新随机灵草',
        type: 'herb',
        rank: '玄品',
        element: '木',
        description: '鉴定时从材料库抽取。',
        details: {},
        quantity: 1,
      },
    );

    const result = await identifyMysteryMaterial({
      materialId: 'material-1',
      cultivatorId: 'cultivator-1',
    });

    expect(sampleMaterialForRangeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        materialType: 'herb',
        rankRange: { min: '凡品', max: '玄品' },
      }),
    );
    expect(generateRandomMock).not.toHaveBeenCalled();
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
    sampleMaterialForRangeMock
      .mockResolvedValueOnce({ itemId: 'mat-a', payload: {} })
      .mockResolvedValueOnce({ itemId: 'mat-b', payload: {} });
    materialLibraryEntryToMaterialMock
      .mockReturnValueOnce({
        name: '新随机灵草甲',
        type: 'herb',
        rank: '灵品',
        element: '木',
        description: '第一次鉴定。',
        details: {},
        quantity: 1,
      })
      .mockReturnValueOnce({
        name: '新随机灵草乙',
        type: 'herb',
        rank: '玄品',
        element: '木',
        description: '第二次鉴定。',
        details: {},
        quantity: 1,
      });

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
    expect(sampleMaterialForRangeMock).toHaveBeenCalledTimes(2);
    expect(generateRandomMock).not.toHaveBeenCalled();
  });
});
