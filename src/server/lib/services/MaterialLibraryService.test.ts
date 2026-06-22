import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getExecutorMock, generateRandomMock } = vi.hoisted(() => ({
  getExecutorMock: vi.fn(),
  generateRandomMock: vi.fn(),
}));

vi.mock('@server/lib/drizzle/db', () => ({
  getExecutor: getExecutorMock,
}));

vi.mock('@shared/engine/material/creation/MaterialGenerator', () => ({
  MaterialGenerator: {
    generateRandom: generateRandomMock,
  },
}));

import { computeItemLibrarySampleKey } from './itemLibrarySampleKey';
import { generateRandomMaterialLibraryEntries } from './MaterialLibraryService';

describe('MaterialLibraryService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('generates random material entries with deterministic item ids and sample keys', async () => {
    generateRandomMock.mockResolvedValueOnce([
      {
        name: '晨露灵草',
        type: 'herb',
        rank: '凡品',
        element: '木',
        description: '凝着晨露的灵草。',
        quantity: 1,
        price: 10,
      },
      {
        name: '赤纹玄矿',
        type: 'ore',
        rank: '玄品',
        element: '火',
        description: '内含赤纹的矿石。',
        quantity: 1,
        price: 50,
      },
    ]);

    const returningMock = vi.fn(async () => [
      {
        id: '22222222-2222-4222-8222-222222222222',
        itemId: 'mat_herb__abc_0',
        type: 'material',
        status: 'published',
        name: '晨露灵草',
        description: '凝着晨露的灵草。',
        quality: '凡品',
        element: '木',
        category: 'herb',
        payload: {
          name: '晨露灵草',
          type: 'herb',
          rank: '凡品',
          element: '木',
          description: '凝着晨露的灵草。',
        },
        editorConfig: {
          source: 'daily_cron',
          generatedAt: '2026-06-22T00:00:00.000Z',
          seed: 'seed-1',
        },
        createdBy: '11111111-1111-4111-8111-111111111111',
        updatedBy: '11111111-1111-4111-8111-111111111111',
        createdAt: new Date('2026-06-22T00:00:00.000Z'),
        updatedAt: new Date('2026-06-22T00:00:00.000Z'),
      },
    ]);
    const valuesMock = vi.fn(() => ({ returning: returningMock }));
    const insertMock = vi.fn(() => ({ values: valuesMock }));
    getExecutorMock.mockReturnValue({ insert: insertMock });

    const result = await generateRandomMaterialLibraryEntries({
      count: 2,
      userId: '11111111-1111-4111-8111-111111111111',
      source: 'daily_cron',
      seed: 'seed-1',
    });

    expect(generateRandomMock).toHaveBeenCalledWith(2);
    expect(valuesMock).toHaveBeenCalledTimes(1);
    const values = (valuesMock.mock.calls as unknown[][])[0][0] as Array<{
      itemId: string;
      sampleKey: number;
      [key: string]: unknown;
    }>;
    expect(values).toHaveLength(2);
    expect(values[0]).toMatchObject({
      type: 'material',
      status: 'published',
      name: '晨露灵草',
      quality: '凡品',
      category: 'herb',
      editorConfig: expect.objectContaining({
        source: 'daily_cron',
        seed: 'seed-1',
      }),
    });
    expect(values[0].itemId).toMatch(/^mat_herb_/);
    expect(values[1].itemId).toMatch(/^mat_ore_/);
    expect(values[0].itemId).not.toEqual(values[1].itemId);
    expect(values[0].sampleKey).toBe(
      computeItemLibrarySampleKey('seed-1:herb:凡品:0'),
    );
    expect(values[1].sampleKey).toBe(
      computeItemLibrarySampleKey('seed-1:ore:玄品:1'),
    );
    expect(result).toHaveLength(1);
  });
});
