import { expect, it } from 'vitest';
import { ExchangeManualSchema } from './manualMigration.js';

it('拒绝负数玉简数量', () => {
  const grant = {
    definitionId: 'jade.character_manual.changchun',
    quantity: 2,
  };
  expect(
    ExchangeManualSchema.safeParse({
      productId: crypto.randomUUID(),
      selections: [{ ...grant, quantity: -1 }],
    }).success,
  ).toBe(false);
});
