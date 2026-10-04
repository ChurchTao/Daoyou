import { expect, it } from 'vitest';
import { MAX_RECYCLE_SELECTION, RecycleRequestSchema } from './recycle.js';
it('同一选择不能通过重复行超过单格数量', () => {
  const item = { id: 'stack', revision: 2, quantity: 60 };
  expect(
    RecycleRequestSchema.safeParse({ phase: 'preview', items: [item, item] })
      .success,
  ).toBe(false);
  for (const quantity of [0, -1, 1.5, 100]) {
    expect(
      RecycleRequestSchema.safeParse({
        phase: 'preview',
        items: [{ ...item, quantity }],
      }).success,
    ).toBe(false);
  }
});

it('允许同一物品事实的不同格位分别选量，不接受客户端价格', () => {
  const items = [
    { id: 'stack-a', revision: 1, quantity: 2 },
    { id: 'stack-b', revision: 3, quantity: 1 },
  ];
  expect(
    RecycleRequestSchema.safeParse({ phase: 'preview', items }).success,
  ).toBe(true);
  expect(
    RecycleRequestSchema.safeParse({ phase: 'preview', items, total: 999999 })
      .success,
  ).toBe(false);
});

it('批量回收允许 200 格，拒绝超过上限的选择', () => {
  const items = Array.from(
    { length: MAX_RECYCLE_SELECTION + 1 },
    (_, index) => ({
      id: `item-${index}`,
      revision: 0,
      quantity: 1,
    }),
  );
  expect(
    RecycleRequestSchema.safeParse({
      phase: 'preview',
      items: items.slice(0, -1),
    }).success,
  ).toBe(true);
  expect(
    RecycleRequestSchema.safeParse({ phase: 'preview', items }).success,
  ).toBe(false);
});
