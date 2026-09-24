import { describe, expect, it } from 'vitest';
import { WorldChatCreateMessageSchema } from './world-chat';

describe('chat message creation after legacy battle sharing retirement', () => {
  it('rejects old battle shares with an explicit retirement message', () => {
    const result = WorldChatCreateMessageSchema.safeParse({
      messageType: 'battle_showcase',
      battleRecordId: '00000000-0000-4000-8000-000000000001',
      textContent: '旧战报',
    });
    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.error.issues[0].message).toContain('旧版战报分享已停用');
  });
  it('continues to accept text and item showcases', () => {
    expect(
      WorldChatCreateMessageSchema.safeParse({
        messageType: 'text',
        textContent: '你好',
      }).success,
    ).toBe(true);
    expect(
      WorldChatCreateMessageSchema.safeParse({
        messageType: 'item_showcase',
        revision: 0,
        itemId: 'material-id',
      }).success,
    ).toBe(true);
  });
  it('requires a fresh inventory reference and rejects client snapshots and legacy types', () => {
    const input = { messageType: 'item_showcase', itemId: 'item', revision: 2 };
    for (const change of [
      { revision: undefined },
      { revision: -1 },
      { revision: 1.5 },
      { snapshot: { name: '伪造道装' } },
      { itemType: 'artifact' },
    ])
      expect(
        WorldChatCreateMessageSchema.safeParse({ ...input, ...change }).success,
      ).toBe(false);
  });
});
