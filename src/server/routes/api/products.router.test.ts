import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

vi.mock('@server/lib/drizzle/db', () => ({
  db: vi.fn(),
}));

vi.mock('@server/lib/hono/middleware', () => ({
  requireActiveCultivator:
    () => async (context: any, next: () => Promise<void>) => {
      context.set('user', { id: 'user-1' });
      context.set('cultivator', {
        id: 'cultivator-1',
        max_skills: 2,
      });
      await next();
    },
  requireActiveCultivatorRef:
    () => async (context: any, next: () => Promise<void>) => {
      context.set('activeCultivatorRef', {
        userId: 'user-1',
        cultivatorId: 'cultivator-1',
        status: 'active',
      });
      await next();
    },
}));

vi.mock('@server/lib/repositories/creationProductRepository', () => ({
  countEquippedByType: vi.fn(),
  equipArtifact: vi.fn(),
  findById: vi.fn(),
  findByTypeAndCultivator: vi.fn(),
  findEquippedArtifacts: vi.fn(),
  setProductEquipped: vi.fn(),
  unequipArtifact: vi.fn(),
}));

import * as creationProductRepository from '@server/lib/repositories/creationProductRepository';
import { db } from '@server/lib/drizzle/db';
import productsRouter from './products.router';

const dbMock = db as unknown as Mock;
const findByIdMock = creationProductRepository.findById as unknown as Mock;
const countEquippedByTypeMock =
  creationProductRepository.countEquippedByType as unknown as Mock;
const setProductEquippedMock =
  creationProductRepository.setProductEquipped as unknown as Mock;
const equipArtifactMock =
  creationProductRepository.equipArtifact as unknown as Mock;
const unequipArtifactMock =
  creationProductRepository.unequipArtifact as unknown as Mock;

function createApp() {
  return new Hono().route('/api/v2/products', productsRouter);
}

function mockProductTransaction(eventType = 'products.equipped') {
  const versionRow = {
    cultivatorId: 'cultivator-1',
    globalVersion: 1,
    profileVersion: 1,
    conditionVersion: 0,
    progressVersion: 0,
    currencyVersion: 0,
    inventoryVersion: 1,
    productsVersion: 1,
    mailVersion: 0,
    tasksVersion: 0,
    updatedAt: new Date('2026-06-10T00:00:00.000Z'),
  };
  const eventRows = [
    {
      id: 31,
      cultivatorId: 'cultivator-1',
      userId: 'user-1',
      globalVersion: 1,
      domain: 'products',
      eventType,
      patch: {},
      invalidates: ['products'],
      source: eventType === 'products.deleted' ? 'product_delete' : 'product_equip',
      requestId: null,
      createdAt: new Date('2026-06-10T00:00:00.000Z'),
    },
  ];
  const insertReturning = vi
    .fn()
    .mockResolvedValueOnce([versionRow])
    .mockResolvedValueOnce(eventRows);
  const onConflictDoUpdate = vi.fn(() => ({ returning: insertReturning }));
  const values = vi.fn(() => ({
    onConflictDoUpdate,
    returning: insertReturning,
  }));
  const insert = vi.fn(() => ({ values }));
  const txMock = { insert };

  dbMock.mockReturnValue({
    transaction: async (callback: (tx: typeof txMock) => Promise<unknown>) =>
      callback(txMock),
  } as any);

  return txMock;
}

describe('products router equip toggle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects enabling a skill when the effective skill limit is full', async () => {
    findByIdMock.mockResolvedValueOnce({
      id: '11111111-1111-4111-8111-111111111111',
      cultivatorId: 'cultivator-1',
      productType: 'skill',
      isEquipped: false,
    });
    countEquippedByTypeMock.mockResolvedValueOnce(2);

    const response = await createApp().request('/api/v2/products/equip', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        productId: '11111111-1111-4111-8111-111111111111',
      }),
    });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: '神通启用数量已达上限，请先停用旧项',
    });
    expect(setProductEquippedMock).not.toHaveBeenCalled();
  });

  it('disables an already enabled gongfa', async () => {
    findByIdMock.mockResolvedValueOnce({
      id: '22222222-2222-4222-8222-222222222222',
      cultivatorId: 'cultivator-1',
      productType: 'gongfa',
      isEquipped: true,
    });
    const txMock = mockProductTransaction();

    const response = await createApp().request('/api/v2/products/equip', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        productId: '22222222-2222-4222-8222-222222222222',
      }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: {
        productId: '22222222-2222-4222-8222-222222222222',
        productType: 'gongfa',
        equipped: false,
      },
      state: {
        cultivatorId: 'cultivator-1',
        globalVersion: 1,
        domainVersions: {
          products: 1,
          profile: 1,
        },
        events: [
          {
            id: 31,
            cultivatorId: 'cultivator-1',
            globalVersion: 1,
            domain: 'products',
            eventType: 'products.equipped',
            patch: {},
            invalidates: ['products'],
            source: 'product_equip',
            createdAt: '2026-06-10T00:00:00.000Z',
          },
        ],
      },
      equipped: false,
    });
    expect(setProductEquippedMock).toHaveBeenCalledWith(
      '22222222-2222-4222-8222-222222222222',
      false,
      txMock,
    );
  });

  it('keeps artifact equip behavior slot-aware', async () => {
    findByIdMock.mockResolvedValueOnce({
      id: '33333333-3333-4333-8333-333333333333',
      cultivatorId: 'cultivator-1',
      productType: 'artifact',
      slot: 'weapon',
      isEquipped: false,
    });
    const txMock = mockProductTransaction();

    const response = await createApp().request('/api/v2/products/equip', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        productId: '33333333-3333-4333-8333-333333333333',
      }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: {
        productId: '33333333-3333-4333-8333-333333333333',
        productType: 'artifact',
        equipped: true,
      },
      state: {
        cultivatorId: 'cultivator-1',
        globalVersion: 1,
        domainVersions: {
          products: 1,
          profile: 1,
          inventory: 1,
        },
        events: [
          {
            id: 31,
            cultivatorId: 'cultivator-1',
            globalVersion: 1,
            domain: 'products',
            eventType: 'products.equipped',
            patch: {},
            invalidates: ['products'],
            source: 'product_equip',
            createdAt: '2026-06-10T00:00:00.000Z',
          },
        ],
      },
      equipped: true,
    });
    expect(equipArtifactMock).toHaveBeenCalledWith(
      '33333333-3333-4333-8333-333333333333',
      'cultivator-1',
      'weapon',
      txMock,
    );
    expect(unequipArtifactMock).not.toHaveBeenCalled();
  });
});
