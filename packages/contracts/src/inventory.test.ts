import { expect, it } from 'vitest';
import { InventoryQuerySchema } from './inventory.js';
it('查询接受三种排序，拒绝未知排序且保留未指定的默认顺序', () => {
  for (const sort of ['updatedAt', 'quantity', 'kind']) {
    expect(InventoryQuerySchema.parse({ sort }).sort).toBe(sort);
  }
  expect(InventoryQuerySchema.parse({}).sort).toBeUndefined();
  expect(InventoryQuerySchema.safeParse({ sort: 'name' }).success).toBe(false);
});
