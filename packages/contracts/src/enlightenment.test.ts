import { expect, it } from 'vitest';
import { EnlightenmentRequestSchema } from './enlightenment.js';
const ref = { id: 'book', revision: 0, quantity: 4 };
it('拒绝无效请求标识和缺失预期费用', () => {
  expect(
    EnlightenmentRequestSchema.safeParse({
      requestId: 'bad',
      materials: [ref],
    }).success,
  ).toBe(false);
});
