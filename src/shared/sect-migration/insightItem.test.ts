import { expect, it } from 'vitest';
import {
  CULTIVATION_PILL_MAX_QUALITY_BY_REALM,
  CULTIVATION_PILL_MIN_QUALITY_BY_REALM,
} from '../config/consumableSystem';
import { ItemGrantSchema } from '../inventory';
import { QUALITY_ORDER, type RealmType } from '../types/constants';
import {
  migrationInsightFacts,
  migrationInsightGrants,
  migrationInsightQuantity,
} from './insightItem';

it('delivers all 600 refunded points as valid existing consumables without adding a definition', () => {
  const grants = migrationInsightGrants(600);
  expect(grants.reduce((n, g) => n + g.quantity, 0)).toBe(12);
  expect(migrationInsightQuantity(100)).toBe(2);
  expect(migrationInsightQuantity(200)).toBe(4);
  expect(migrationInsightFacts.spec).toMatchObject({
    operations: [
      { type: 'gain_progress', target: 'comprehension_insight', value: 50 },
    ],
  });
  expect(grants.every((g) => ItemGrantSchema.safeParse(g).success)).toBe(true);
  expect(migrationInsightGrants(0)).toEqual([]);
  expect(() => migrationInsightGrants(601)).toThrow();
  expect(() => migrationInsightGrants(51)).toThrow();
});
it('uses a quality available throughout every existing realm', () => {
  const quality = QUALITY_ORDER[migrationInsightFacts.quality];
  for (const realm of Object.keys(
    CULTIVATION_PILL_MAX_QUALITY_BY_REALM,
  ) as RealmType[]) {
    expect(quality).toBeGreaterThanOrEqual(
      QUALITY_ORDER[CULTIVATION_PILL_MIN_QUALITY_BY_REALM[realm]],
    );
    expect(quality).toBeLessThanOrEqual(
      QUALITY_ORDER[CULTIVATION_PILL_MAX_QUALITY_BY_REALM[realm]],
    );
  }
});
