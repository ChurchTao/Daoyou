import { describe, expect, it } from 'vitest';
import { WorldChatCreateMessageSchema } from './world-chat.js';

describe('chat message creation', () => {
  it('rejects unsupported message types', () => {
    const result = WorldChatCreateMessageSchema.safeParse({
      messageType: 'battle_showcase',
      battleRecordId: '00000000-0000-4000-8000-000000000001',
      textContent: '旧战报',
    });
    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.error.issues[0].message).toContain('仅支持文字、道具、灵兽与战绩消息');
  });
  it('accepts text, item and beast showcases', () => {
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
    expect(
      WorldChatCreateMessageSchema.safeParse({
        messageType: 'beast_showcase',
        revision: 0,
        beastId: '00000000-0000-4000-8000-000000000001',
      }).success,
    ).toBe(true);
  });
  it('accepts a V6 battle reference but rejects client supplied replay facts', () => {
    const input = {
      messageType: 'combat_v6_replay',
      battleId: '00000000-0000-4000-8000-000000000001',
    };
    expect(WorldChatCreateMessageSchema.safeParse(input).success).toBe(true);
    expect(WorldChatCreateMessageSchema.safeParse({ ...input, shareCode: 'forged' }).success).toBe(false);
    expect(WorldChatCreateMessageSchema.safeParse({ ...input, battleId: 'invalid' }).success).toBe(false);
  });
  it('requires an owned beast reference rather than client supplied beast facts', () => {
    const input = {
      messageType: 'beast_showcase',
      beastId: '00000000-0000-4000-8000-000000000001',
      revision: 2,
    };
    for (const change of [
      { revision: -1 },
      { beastId: 'invalid' },
      { beast: { name: '伪造灵兽' } },
    ])
      expect(
        WorldChatCreateMessageSchema.safeParse({ ...input, ...change }).success,
      ).toBe(false);
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
