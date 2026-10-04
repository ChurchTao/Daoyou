import { expect, it } from 'vitest';
import { SendMailSchema } from './mail.js';
it('requires a versioned item reference and rejects client-supplied facts', () => {
  const body = {
    requestId: 'gift-request',
    recipientCultivatorId: '00000000-0000-4000-8000-000000000001',
    content: '赠予道友',
    attachment: {
      itemId: '00000000-0000-4000-8000-000000000002',
      revision: 0,
      quantity: 1,
    },
  };
  expect(SendMailSchema.safeParse(body).success).toBe(true);
  for (const quantity of [0, 1.5, 100])
    expect(
      SendMailSchema.safeParse({
        ...body,
        attachment: { ...body.attachment, quantity },
      }).success,
    ).toBe(false);
  expect(
    SendMailSchema.safeParse({
      ...body,
      attachment: { ...body.attachment, instanceData: {} },
    }).success,
  ).toBe(false);
  expect(
    SendMailSchema.safeParse({
      ...body,
      attachment: { ...body.attachment, revision: undefined },
    }).success,
  ).toBe(false);
});
