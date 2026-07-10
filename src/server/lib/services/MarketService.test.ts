import { afterEach, describe, expect, it, vi } from 'vitest';

const { sampleMaterialLibraryEntriesMock } = vi.hoisted(() => ({
  sampleMaterialLibraryEntriesMock: vi.fn(),
}));

vi.mock('@server/lib/drizzle/db', () => ({
  getExecutor: vi.fn(),
}));

vi.mock('@server/lib/redis', () => ({
  redis: {
    del: vi.fn(),
    exists: vi.fn(),
    get: vi.fn(),
    sadd: vi.fn(),
    set: vi.fn(),
    smembers: vi.fn(),
    sismember: vi.fn(),
    expire: vi.fn(),
  },
}));

vi.mock('@server/lib/repositories/worldChatRepository', () => ({
  createMessage: vi.fn(),
}));

vi.mock('./MaterialLibraryService', () => ({
  materialLibraryEntryToMaterial: (entry: any) => entry.payload,
  sampleMaterialForRange: vi.fn(),
  sampleMaterialLibraryEntries: sampleMaterialLibraryEntriesMock,
}));

import {
  BLACK_MARKET_HIGH_TIER_MIN,
  getRegionProfile,
  resolveLayerConfig,
} from '@shared/lib/game/marketConfig';
import { QUALITY_ORDER } from '@shared/types/constants';
import { __marketServiceTestHooks } from './MarketService';

describe('MarketService black market generation', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('keeps normal market generated price factors above safety floor', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);

    expect(
      __marketServiceTestHooks.computePrice('common', '真品', 'herb', {
        min: 0.75,
        max: 1.1,
      }),
    ).toBe(2850);
    expect(
      __marketServiceTestHooks.computePrice('heaven', '真品', 'herb', {
        min: 0.75,
        max: 1.1,
      }),
    ).toBe(2850);
  });

  it('does not apply normal market price floor to black market', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);

    expect(
      __marketServiceTestHooks.computePrice('black', '真品', 'herb', {
        min: 0.75,
        max: 1.1,
      }),
    ).toBe(2250);
  });

  it('builds black market requests without low-tier qualities and with high-tier floor', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);

    const profile = getRegionProfile('TN_YUE_01');
    const layerConfig = resolveLayerConfig('black', profile);
    const requests = __marketServiceTestHooks.buildMarketSampleRequests(
      'black',
      profile,
      layerConfig,
    );
    const qualities = requests.flatMap((request) =>
      Array.from({ length: request.count }, () => request.quality),
    );

    expect(qualities).toHaveLength(8);
    expect(qualities).not.toContain('灵品');
    expect(qualities).not.toContain('玄品');
    expect(
      qualities.filter(
        (quality) =>
          QUALITY_ORDER[quality] >= QUALITY_ORDER[BLACK_MARKET_HIGH_TIER_MIN],
      ),
    ).toHaveLength(2);
  });

  it('keeps mystery price noise in the 0.2 to 3.0 range', () => {
    vi.spyOn(Math, 'random').mockReturnValueOnce(0).mockReturnValueOnce(1);

    expect(__marketServiceTestHooks.rollMysteryPriceNoiseMultiplier()).toBe(0.2);
    expect(__marketServiceTestHooks.rollMysteryPriceNoiseMultiplier()).toBe(3);
  });

  it('warns about black market library shortages without preset fallback', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    sampleMaterialLibraryEntriesMock.mockResolvedValueOnce(new Map());

    const listings = await __marketServiceTestHooks.generateListings(
      'TN_YUE_01',
      'black',
    );

    expect(listings).toEqual([]);
    expect(sampleMaterialLibraryEntriesMock).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          materialType: 'herb',
          quality: '真品',
          count: 6,
        }),
        expect.objectContaining({
          materialType: 'herb',
          quality: '地品',
          count: 2,
        }),
      ]),
    );
    expect(warnSpy).toHaveBeenCalledWith(
      '[market] material library shortage',
      expect.objectContaining({
        nodeId: 'TN_YUE_01',
        layer: 'black',
        requested: 8,
        actual: 0,
        noPresetFallback: true,
        noLlmGeneration: true,
        shortages: expect.arrayContaining([
          expect.objectContaining({
            type: 'herb',
            quality: '真品',
            requested: 6,
            actual: 0,
          }),
          expect.objectContaining({
            type: 'herb',
            quality: '地品',
            requested: 2,
            actual: 0,
          }),
        ]),
      }),
    );
  });
});
