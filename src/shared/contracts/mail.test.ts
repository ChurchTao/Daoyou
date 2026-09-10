import { describe, expect, it } from 'vitest';
import { ITEM_DEFINITIONS } from '../items/registry';
import { mailGiftBlockReason, SendMailSchema } from './mail';

describe('mail gifts', () => {
  it('accepts bag items across registered kinds without the old auction quality gate', () => {
    for (const definition of ITEM_DEFINITIONS) {
      if (definition.kind === 'consumable') continue;
      expect(
        mailGiftBlockReason({
          definitionId: definition.id,
          location: 'bag',
          instanceData: null,
        }),
      ).toBeNull();
    }
  });
  it('rejects storage, equipped items and unknown definitions', () => {
    const item = {
      definitionId: 'equipment.v6',
      location: 'bag',
      instanceData: null,
    };
    expect(mailGiftBlockReason({ ...item, equipped: true })).toBeTruthy();
    expect(mailGiftBlockReason({ ...item, location: 'storage' })).toBeTruthy();
    expect(
      mailGiftBlockReason({ ...item, definitionId: 'legacy.artifact' }),
    ).toBeTruthy();
  });
  it('allows pills and fruit but keeps scenario talismans out of gift attachments', () => {
    const item = { definitionId: 'consumable.v1', location: 'bag' };
    for (const kind of ['pill', 'spirit_fruit'])
      expect(
        mailGiftBlockReason({ ...item, instanceData: { spec: { kind } } }),
      ).toBeNull();
    expect(
      mailGiftBlockReason({
        ...item,
        instanceData: { spec: { kind: 'talisman' } },
      }),
    ).toBeTruthy();
  });
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
});
