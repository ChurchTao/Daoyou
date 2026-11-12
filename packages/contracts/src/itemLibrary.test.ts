import { expect, it } from 'vitest';
import {
  ItemLibraryMaterialGenerateSchema,
  ItemLibrarySpiritSeedGenerateSchema,
} from './itemLibrary.js';
it('keeps seeds on the dedicated generator and rejects them from generic material generation', () => {
  for (const materialType of ['herb', 'gongfa_manual']) {
    expect(
      ItemLibraryMaterialGenerateSchema.safeParse({
        materialType,
        count: 1,
        quality: '凡品',
      }).success,
    ).toBe(true);
  }
  for (const materialType of ['seed', 'mystery'])
    expect(
      ItemLibraryMaterialGenerateSchema.safeParse({
        materialType,
        count: 1,
        quality: '凡品',
      }).success,
    ).toBe(false);
  expect(
    ItemLibrarySpiritSeedGenerateSchema.safeParse({ count: 1, quality: '凡品' })
      .success,
  ).toBe(true);
});
