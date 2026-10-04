import { expect, it } from 'vitest';
import { ItemLibraryMaterialGenerateSchema } from './itemLibrary.js';
it('keeps supported material and seed generation while rejecting retired types', () => {
  for (const materialType of ['herb', 'seed', 'gongfa_manual']) {
    expect(
      ItemLibraryMaterialGenerateSchema.safeParse({
        materialType,
        count: 1,
        quality: '凡品',
      }).success,
    ).toBe(true);
  }
  expect(
    ItemLibraryMaterialGenerateSchema.safeParse({
      materialType: 'mystery',
      count: 1,
      quality: '凡品',
    }).success,
  ).toBe(false);
});
