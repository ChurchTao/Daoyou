import { describe, expect, it } from 'vitest';
import { SectTaskSubmissionInputSchema } from './sect';

describe('SectTaskSubmissionInputSchema', () => {
  it('accepts only the canonical batch submission shape', () => {
    const itemId = '894471ab-93f1-4575-bbb8-3c89f28a2512';
    expect(
      SectTaskSubmissionInputSchema.parse({
        items: [{ itemId, revision: 0, quantity: 1 }],
      }),
    ).toEqual({ items: [{ itemId, revision: 0, quantity: 1 }] });
    expect(
      SectTaskSubmissionInputSchema.safeParse({
        itemId,
        quantity: 1,
      }).success,
    ).toBe(false);
    expect(
      SectTaskSubmissionInputSchema.safeParse({
        items: [
          { itemId, revision: 0, quantity: 1 },
          { itemId, revision: 0, quantity: 1 },
        ],
      }).success,
    ).toBe(false);
  });
});

it('rejects absent or invalid inventory revisions and quantities', () => {
  const itemId = '894471ab-93f1-4575-bbb8-3c89f28a2512';
  for (const revision of [undefined, -1, 0.5])
    expect(
      SectTaskSubmissionInputSchema.safeParse({
        items: [{ itemId, revision, quantity: 1 }],
      }).success,
    ).toBe(false);
  for (const quantity of [0, -1, 0.5])
    expect(
      SectTaskSubmissionInputSchema.safeParse({
        items: [{ itemId, revision: 0, quantity }],
      }).success,
    ).toBe(false);
});
