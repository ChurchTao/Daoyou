const {
  countActiveBySellerMock,
  createListingMock,
  delMock,
  findByIdMock,
  getExecutorMock,
  keysMock,
  sendMailMock,
  setMock,
  updateStatusMock,
} = vi.hoisted(() => ({
  countActiveBySellerMock: vi.fn(),
  createListingMock: vi.fn(),
  delMock: vi.fn(),
  findByIdMock: vi.fn(),
  getExecutorMock: vi.fn(),
  keysMock: vi.fn(),
  sendMailMock: vi.fn(),
  setMock: vi.fn(),
  updateStatusMock: vi.fn(),
}));

vi.mock('@server/lib/drizzle/db', () => ({
  getExecutor: getExecutorMock,
}));

vi.mock('@server/lib/redis', () => ({
  redis: {
    set: setMock,
    del: delMock,
    keys: keysMock,
  },
}));

vi.mock('@server/lib/repositories/auctionRepository', () => ({
  countActiveBySeller: countActiveBySellerMock,
  createListing: createListingMock,
  findById: findByIdMock,
  updateStatus: updateStatusMock,
}));

vi.mock('@server/lib/services/MailService', () => ({
  MailService: {
    sendMail: sendMailMock,
  },
}));

import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as schema from '../drizzle/schema';
import { buyItem, listItem } from './AuctionService';

function createPillSpec() {
  return {
    kind: 'pill' as const,
    family: 'healing' as const,
    operations: [
      {
        type: 'restore_resource' as const,
        resource: 'hp' as const,
        mode: 'flat' as const,
        value: 120,
      },
    ],
    consumeRules: {
      scene: 'out_of_battle_only' as const,
      quotaCategory: 'none' as const,
    },
    alchemyMeta: {
      source: 'formula' as const,
      formulaId: 'formula-1',
      sourceMaterials: ['赤心芝'],
      fitScore: 0.92,
      fitMultiplier: 1.1,
      stability: 78,
      toxicityRating: 8,
      tags: ['healing'],
      breakthroughLabel: '回春丹',
    },
  };
}

function createTalismanSpec() {
  return {
    kind: 'talisman' as const,
    scenario: 'manual_draw_ticket' as const,
    effectKey: 'draw.5',
    charges: 1,
  };
}

function createConsumableRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'consumable-1',
    cultivatorId: 'cultivator-1',
    name: '回春丹',
    type: '丹药',
    prompt: '疗伤回春',
    quality: '玄品',
    spec: createPillSpec(),
    quantity: 3,
    description: '服之可稳住气血。',
    score: 88,
    createdAt: new Date(),
    ...overrides,
  };
}

function createExecutor(options: {
  consumableRow?: Record<string, unknown> | null;
}) {
  const updateCalls: Array<{
    payload: Record<string, unknown>;
    table: unknown;
  }> = [];
  const deleteCalls: Array<{ table: unknown }> = [];
  let cultivatorUpdateCount = 0;

  const executor = {
    select() {
      return {
        from(table: unknown) {
          if (table === schema.consumables) {
            return {
              where() {
                return {
                  limit: async () =>
                    options.consumableRow ? [options.consumableRow] : [],
                };
              },
            };
          }

          if (table === schema.cultivators) {
            return {
              where() {
                return {
                  limit: async () => [{ money: 0 }],
                };
              },
            };
          }

          throw new Error('unexpected table');
        },
      };
    },
    update(table: unknown) {
      return {
        set(payload: Record<string, unknown>) {
          const builder = {
            where() {
              updateCalls.push({ table, payload });
              return builder;
            },
            returning: async () => {
              if (table === schema.cultivators && cultivatorUpdateCount === 0) {
                cultivatorUpdateCount += 1;
                return [{ id: 'buyer-1' }];
              }
              cultivatorUpdateCount += 1;
              return [];
            },
          };

          return builder;
        },
      };
    },
    delete(table: unknown) {
      return {
        where: async () => {
          deleteCalls.push({ table });
          return undefined;
        },
      };
    },
    transaction: async (callback: (tx: any) => Promise<void>) => {
      await callback(executor);
    },
  };

  return {
    deleteCalls,
    executor,
    updateCalls,
  };
}

describe('AuctionService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setMock.mockResolvedValue('OK');
    delMock.mockResolvedValue(1);
    keysMock.mockResolvedValue([]);
    countActiveBySellerMock.mockResolvedValue(0);
    createListingMock.mockResolvedValue({ id: 'listing-1' });
    updateStatusMock.mockResolvedValue(undefined);
    sendMailMock.mockResolvedValue({ id: 'mail-1' });
  });

  it('allows listing pills and preserves their full spec in the auction snapshot', async () => {
    const { executor, updateCalls } = createExecutor({
      consumableRow: createConsumableRow(),
    });
    getExecutorMock.mockReturnValue(executor);

    await listItem({
      cultivatorId: 'cultivator-1',
      cultivatorName: '韩立',
      itemType: 'consumable',
      itemId: 'consumable-1',
      price: 120,
      quantity: 2,
    });

    expect(createListingMock).toHaveBeenCalledTimes(1);
    expect(createListingMock).toHaveBeenCalledWith(
      expect.objectContaining({
        itemType: 'consumable',
        itemId: 'consumable-1',
        itemSnapshot: expect.objectContaining({
          name: '回春丹',
          type: '丹药',
          quantity: 2,
          spec: createPillSpec(),
        }),
        sellerId: 'cultivator-1',
        sellerName: '韩立',
        price: 120,
        tx: executor,
      }),
    );
    expect(updateCalls).toContainEqual(
      expect.objectContaining({
        table: schema.consumables,
        payload: { quantity: 1 },
      }),
    );
  });

  it('rejects talisman listings with a pill-only error message', async () => {
    const { executor } = createExecutor({
      consumableRow: createConsumableRow({
        name: '五连引符',
        type: '符箓',
        spec: createTalismanSpec(),
      }),
    });
    getExecutorMock.mockReturnValue(executor);

    await expect(
      listItem({
        cultivatorId: 'cultivator-1',
        cultivatorName: '韩立',
        itemType: 'consumable',
        itemId: 'consumable-1',
        price: 120,
        quantity: 1,
      }),
    ).rejects.toThrow('当前仅支持丹药寄售');
    expect(createListingMock).not.toHaveBeenCalled();
  });

  it('sends the buyer a consumable attachment whose pill spec matches the sold snapshot', async () => {
    const pillSnapshot = {
      id: 'consumable-1',
      name: '回春丹',
      type: '丹药' as const,
      quality: '玄品' as const,
      quantity: 2,
      description: '服之可稳住气血。',
      prompt: '疗伤回春',
      score: 88,
      spec: createPillSpec(),
    };
    const { executor } = createExecutor({
      consumableRow: null,
    });
    getExecutorMock.mockReturnValue(executor);
    findByIdMock.mockResolvedValue({
      id: 'listing-1',
      sellerId: 'seller-1',
      sellerName: '韩立',
      itemType: 'consumable',
      itemId: 'consumable-1',
      itemSnapshot: pillSnapshot,
      price: 300,
      status: 'active',
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
      soldAt: null,
    });

    await buyItem({
      listingId: 'listing-1',
      buyerCultivatorId: 'buyer-1',
      buyerCultivatorName: '李化元',
    });

    expect(updateStatusMock).toHaveBeenCalledWith(
      executor,
      'listing-1',
      'sold',
      expect.any(Date),
    );
    expect(sendMailMock).toHaveBeenNthCalledWith(
      1,
      'buyer-1',
      '拍卖行交易成功',
      expect.stringContaining('回春丹'),
      [
        {
          type: 'consumable',
          name: '回春丹',
          quantity: 2,
          data: pillSnapshot,
        },
      ],
      'reward',
      executor,
    );
  });
});
