import { expect, it } from 'vitest';
import { createDevCultivatorPatchSchema } from './devTools.js';

it('开发角色请求保留注入的感悟上限和灵根总强度约束', () => {
  const schema = createDevCultivatorPatchSchema({
    comprehensionInsightCap: 200,
    spiritualRootStrengthCap: 120,
  });
  expect(
    schema.safeParse({
      cultivation: { insight: 200 },
      spiritualRoots: [{ element: '金', baseStrength: 100, marrowWashBonus: 20 }],
    }).success,
  ).toBe(true);
  for (const invalid of [
    {},
    { cultivation: { insight: 201 } },
    { spiritualRoots: [{ element: '金', baseStrength: 100, marrowWashBonus: 21 }] },
    { cultivation: { insight: 10 }, ownerId: 'another-player' },
  ]) {
    expect(schema.safeParse(invalid).success).toBe(false);
  }
  const limited = createDevCultivatorPatchSchema({
    comprehensionInsightCap: 30,
    spiritualRootStrengthCap: 80,
  });
  expect(limited.safeParse({ cultivation: { insight: 31 } }).success).toBe(false);
  expect(
    limited.safeParse({ spiritualRoots: [{ element: '金', baseStrength: 81 }] })
      .success,
  ).toBe(false);
});
