import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  findPublishedItemLibraryByItemIdsMock,
  getExecutorMock,
  resourceEngineMock,
} = vi.hoisted(() => ({
  findPublishedItemLibraryByItemIdsMock: vi.fn(),
  getExecutorMock: vi.fn(),
  resourceEngineMock: {
    consumeInTransaction: vi.fn(),
    gainInTransaction: vi.fn(),
  },
}));

vi.mock('@server/lib/drizzle/db', () => ({
  getExecutor: getExecutorMock,
}));

vi.mock('@server/lib/repositories/itemLibraryRepository', () => ({
  findPublishedItemLibraryByItemIds: findPublishedItemLibraryByItemIdsMock,
}));

vi.mock('@shared/engine/resource/ResourceEngine', () => ({
  resourceEngine: resourceEngineMock,
}));

import {
  buyReputationShopItem,
  createReputationShopItem,
  getReputationShopPurchaseWeek,
} from './ReputationShopService';

const now = new Date('2026-06-01T00:00:00.000Z');

function makeItem(type: 'material' | 'consumable' | 'artifact') {
  return {
    id:
      type === 'artifact'
        ? '33333333-3333-4333-8333-333333333333'
        : type === 'consumable'
          ? '44444444-4444-4444-8444-444444444444'
          : '55555555-5555-4555-8555-555555555555',
    itemId: `${type}_item`,
    type,
    status: 'published' as const,
    name: type === 'artifact' ? '青锋剑' : '精炼玄铁',
    description: null,
    quality: '玄品',
    element: '金',
    category: type === 'artifact' ? 'weapon' : 'ore',
    payload:
      type === 'artifact'
        ? {
            name: '青锋剑',
            slot: 'weapon',
            element: '金',
            quality: '玄品',
            productModel: {},
          }
        : {
            name: '精炼玄铁',
            type: 'ore',
            rank: '玄品',
          },
    editorConfig: {},
    createdBy: '11111111-1111-4111-8111-111111111111',
    updatedBy: '11111111-1111-4111-8111-111111111111',
    createdAt: now,
    updatedAt: now,
  };
}

function makeShopRow(overrides: Record<string, unknown> = {}) {
  return {
    id: '22222222-2222-4222-8222-222222222222',
    itemLibraryItemId: 'material_item',
    price: 100,
    quantity: 2,
    perUserLimit: null,
    status: 'active',
    sortOrder: 0,
    createdBy: 'admin-1',
    updatedBy: 'admin-1',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function selectResult(rows: unknown[], whereReturnsRows = false) {
  const chain: any = {
    from: vi.fn(() => chain),
    innerJoin: vi.fn(() => chain),
    where: vi.fn(() => (whereReturnsRows ? Promise.resolve(rows) : chain)),
    limit: vi.fn(async () => rows),
  };
  return chain;
}

function createExecutor(args: {
  selectRows?: Array<{ rows: unknown[]; whereReturnsRows?: boolean }>;
  insertRows?: unknown[][];
} = {}) {
  const selectRows = [...(args.selectRows ?? [])];
  const insertRows = [...(args.insertRows ?? [])];
  const insertedValues: unknown[] = [];
  return {
    insertedValues,
    select: vi.fn(() => {
      const entry = selectRows.shift() ?? { rows: [] };
      return selectResult(entry.rows, entry.whereReturnsRows);
    }),
    insert: vi.fn(() => ({
      values: vi.fn((value: unknown) => {
        insertedValues.push(value);
        const rows = insertRows.shift();
        if (!rows) return Promise.resolve();
        return {
          returning: vi.fn(async () => rows),
        };
      }),
    })),
  };
}

describe('ReputationShopService', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-17T01:00:00.000Z'));
    vi.clearAllMocks();
    resourceEngineMock.consumeInTransaction.mockResolvedValue({ success: true });
    resourceEngineMock.gainInTransaction.mockResolvedValue({ success: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('calculates purchase weeks by Asia Shanghai Monday', () => {
    expect(
      getReputationShopPurchaseWeek(new Date('2026-06-14T15:59:59.000Z')),
    ).toBe('2026-06-08');
    expect(
      getReputationShopPurchaseWeek(new Date('2026-06-14T16:00:00.000Z')),
    ).toBe('2026-06-15');
  });

  it('rejects artifact shop items with quantity greater than 1', async () => {
    findPublishedItemLibraryByItemIdsMock.mockResolvedValueOnce([
      makeItem('artifact'),
    ]);

    await expect(
      createReputationShopItem({
        userId: 'admin-1',
        input: {
          itemLibraryItemId: 'artifact_item',
          price: 100,
          quantity: 2,
          perUserLimit: null,
          status: 'active',
          sortOrder: 0,
        },
      }),
    ).rejects.toThrow('法宝类商品每次只能发放 1 件');

    expect(getExecutorMock).not.toHaveBeenCalled();
  });

  it('rejects stored invalid artifact quantity before charging', async () => {
    const executor = createExecutor({
      selectRows: [
        {
          rows: [
            {
              row: makeShopRow({
                itemLibraryItemId: 'artifact_item',
                quantity: 2,
              }),
              item: makeItem('artifact'),
            },
          ],
        },
      ],
    });

    await expect(
      buyReputationShopItem({
        id: '22222222-2222-4222-8222-222222222222',
        userId: 'user-1',
        cultivatorId: 'cultivator-1',
        tx: executor as any,
      }),
    ).rejects.toThrow('法宝类商品每次只能发放 1 件');

    expect(resourceEngineMock.consumeInTransaction).not.toHaveBeenCalled();
    expect(resourceEngineMock.gainInTransaction).not.toHaveBeenCalled();
  });

  it('rejects archived or unpublished items before charging', async () => {
    const executor = createExecutor({
      selectRows: [
        {
          rows: [
            {
              row: makeShopRow({ status: 'archived' }),
              item: makeItem('material'),
            },
          ],
        },
      ],
    });

    await expect(
      buyReputationShopItem({
        id: '22222222-2222-4222-8222-222222222222',
        userId: 'user-1',
        cultivatorId: 'cultivator-1',
        tx: executor as any,
      }),
    ).rejects.toThrow('此物暂不可兑换');

    expect(resourceEngineMock.consumeInTransaction).not.toHaveBeenCalled();
  });

  it('rejects current-week per-user limit before charging', async () => {
    const executor = createExecutor({
      selectRows: [
        {
          rows: [
            {
              row: makeShopRow({ perUserLimit: 1 }),
              item: makeItem('material'),
            },
          ],
        },
        { rows: [{ count: 1 }], whereReturnsRows: true },
      ],
    });

    await expect(
      buyReputationShopItem({
        id: '22222222-2222-4222-8222-222222222222',
        userId: 'user-1',
        cultivatorId: 'cultivator-1',
        tx: executor as any,
      }),
    ).rejects.toThrow('此物已达兑换上限');

    expect(resourceEngineMock.consumeInTransaction).not.toHaveBeenCalled();
  });

  it('does not count previous-week purchases against the current week', async () => {
    const executor = createExecutor({
      selectRows: [
        {
          rows: [
            {
              row: makeShopRow({ perUserLimit: 1 }),
              item: makeItem('material'),
            },
          ],
        },
        { rows: [{ count: 0 }], whereReturnsRows: true },
        { rows: [{ reputation: 900 }], whereReturnsRows: false },
        { rows: [{ count: 1 }], whereReturnsRows: true },
      ],
    });

    await expect(
      buyReputationShopItem({
        id: '22222222-2222-4222-8222-222222222222',
        userId: 'user-1',
        cultivatorId: 'cultivator-1',
        tx: executor as any,
      }),
    ).resolves.toMatchObject({
      reputation: 900,
    });

    expect(resourceEngineMock.consumeInTransaction).toHaveBeenCalledWith(
      'user-1',
      'cultivator-1',
      [{ type: 'reputation', value: 100 }],
      executor,
    );
    expect(executor.insertedValues).toContainEqual(
      expect.objectContaining({
        shopItemId: '22222222-2222-4222-8222-222222222222',
        cultivatorId: 'cultivator-1',
        purchaseWeek: '2026-06-15',
      }),
    );
  });

  it.each<[string, Record<string, unknown>, string]>([
    ['invalid price below 1', { price: 0 }, '商品声望价格配置异常'],
    ['invalid price above cap', { price: 10000 }, '商品声望价格不能超过 9999'],
    ['invalid quantity below 1', { quantity: 0 }, '商品发放数量配置异常'],
    ['invalid weekly limit', { perUserLimit: 0 }, '商品每周限购配置异常'],
  ])('rejects stored %s before charging', async (_name, overrides, message) => {
    const executor = createExecutor({
      selectRows: [
        {
          rows: [
            {
              row: makeShopRow(overrides),
              item: makeItem('material'),
            },
          ],
        },
      ],
    });

    await expect(
      buyReputationShopItem({
        id: '22222222-2222-4222-8222-222222222222',
        userId: 'user-1',
        cultivatorId: 'cultivator-1',
        tx: executor as any,
      }),
    ).rejects.toThrow(message);

    expect(resourceEngineMock.consumeInTransaction).not.toHaveBeenCalled();
    expect(resourceEngineMock.gainInTransaction).not.toHaveBeenCalled();
    expect(executor.insert).not.toHaveBeenCalled();
  });

  it('does not grant items or write purchase records when reputation is insufficient', async () => {
    const executor = createExecutor({
      selectRows: [
        {
          rows: [
            {
              row: makeShopRow(),
              item: makeItem('material'),
            },
          ],
        },
        { rows: [{ count: 0 }], whereReturnsRows: true },
      ],
    });
    resourceEngineMock.consumeInTransaction.mockResolvedValueOnce({
      success: false,
      errors: ['声望不足'],
    });

    await expect(
      buyReputationShopItem({
        id: '22222222-2222-4222-8222-222222222222',
        userId: 'user-1',
        cultivatorId: 'cultivator-1',
        tx: executor as any,
      }),
    ).rejects.toThrow('声望不足');

    expect(resourceEngineMock.gainInTransaction).not.toHaveBeenCalled();
    expect(executor.insert).not.toHaveBeenCalled();
  });
});
