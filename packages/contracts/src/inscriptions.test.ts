import { expect, it } from 'vitest';
import { InscriptionRequestSchema } from './inscriptions.js';

it('契约拒绝超四格、非法数量、任意孔位和拆卸操作', () => {
  const base = {
    requestId: '9f6c6548-0561-488e-b659-d8a8e63bec62',
    expectedCost: { qi: 1, spiritStones: 4 },
    action: 'draw',
    materials: [{ id: 'material-0', revision: 0, quantity: 4 }],
    expectedTenths: 40,
  };
  expect(InscriptionRequestSchema.safeParse(base).success).toBe(true);
  expect(
    InscriptionRequestSchema.safeParse({
      ...base,
      materials: Array(5).fill({ id: 'material-0', revision: 0, quantity: 1 }),
    }).success,
  ).toBe(false);
  expect(
    InscriptionRequestSchema.safeParse({
      ...base,
      materials: [{ id: 'material-0', revision: 0, quantity: 31 }],
    }).success,
  ).toBe(false);
  expect(
    InscriptionRequestSchema.safeParse({ ...base, action: 'remove' }).success,
  ).toBe(false);
});
