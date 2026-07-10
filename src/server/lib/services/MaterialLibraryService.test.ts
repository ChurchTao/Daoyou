import { describe, expect, it, vi } from 'vitest';

vi.mock('@server/lib/drizzle/db', () => ({
  getExecutor: vi.fn(),
}));

import { buildDailyMarketMaterialGenerationPlan } from './MaterialLibraryService';

describe('MaterialLibraryService daily market generation plan', () => {
  it('allocates daily stock toward high-tier black market inventory', () => {
    const plan = buildDailyMarketMaterialGenerationPlan({
      count: 20,
      seed: 'daily-test',
    });

    const qualityCounts = Object.fromEntries(
      ['真品', '地品', '天品', '仙品', '神品'].map((quality) => [
        quality,
        plan
          .filter((request) => request.quality === quality)
          .reduce((sum, request) => sum + request.count, 0),
      ]),
    );
    const typeCounts = Object.fromEntries(
      ['tcdb', 'aux', 'gongfa_manual', 'skill_manual'].map((materialType) => [
        materialType,
        plan
          .filter((request) => request.materialType === materialType)
          .reduce((sum, request) => sum + request.count, 0),
      ]),
    );

    expect(plan.reduce((sum, request) => sum + request.count, 0)).toBe(20);
    expect(qualityCounts).toEqual({
      真品: 9,
      地品: 5,
      天品: 3,
      仙品: 2,
      神品: 1,
    });
    expect(typeCounts).toEqual({
      tcdb: 5,
      aux: 4,
      gongfa_manual: 4,
      skill_manual: 4,
    });
    expect(plan.every((request) => request.status === 'published')).toBe(true);
    expect(plan.every((request) => request.seed?.startsWith('daily-test:'))).toBe(
      true,
    );
  });
});
