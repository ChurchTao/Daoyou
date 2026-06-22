const {
  assertAuctionListableItemMock,
  assertFriendMock,
  consumeFirstTalismanByScenarioMock,
  deleteArtifactsByIdsAndCultivatorMock,
  getAuctionItemSnapshotMock,
  sendMailMock,
} = vi.hoisted(() => ({
  assertAuctionListableItemMock: vi.fn(),
  assertFriendMock: vi.fn(),
  consumeFirstTalismanByScenarioMock: vi.fn(),
  deleteArtifactsByIdsAndCultivatorMock: vi.fn(),
  getAuctionItemSnapshotMock: vi.fn(),
  sendMailMock: vi.fn(),
}));

vi.mock('./AuctionService', () => ({
  assertAuctionListableItem: assertAuctionListableItemMock,
  AuctionServiceError: class AuctionServiceError extends Error {
    constructor(
      public readonly code: string,
      message: string,
    ) {
      super(message);
    }
  },
  getAuctionItemSnapshot: getAuctionItemSnapshotMock,
}));

vi.mock('./FriendService', () => ({
  assertFriend: assertFriendMock,
  FriendServiceError: class FriendServiceError extends Error {
    constructor(
      public readonly status: number,
      message: string,
    ) {
      super(message);
    }
  },
}));

vi.mock('./TalismanScenarioService', () => ({
  consumeFirstTalismanByScenario: consumeFirstTalismanByScenarioMock,
  TalismanScenarioError: class TalismanScenarioError extends Error {},
}));

vi.mock('./MailService', () => ({
  MailService: {
    sendMail: sendMailMock,
  },
}));

vi.mock('@server/lib/drizzle/db', () => ({
  getExecutor: vi.fn(),
}));

vi.mock('@server/lib/repositories/creationProductRepository', () => ({
  deleteArtifactsByIdsAndCultivator: deleteArtifactsByIdsAndCultivatorMock,
}));

import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as schema from '../drizzle/schema';
import { sendPlayerMail } from './PlayerMailService';

function createTx() {
  const updateSetMock = vi.fn(() => ({ where: vi.fn() }));
  return {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => [{ id: 'recipient-1', name: '南宫婉' }]),
        })),
      })),
    })),
    delete: vi.fn(() => ({ where: vi.fn() })),
    update: vi.fn(() => ({ set: updateSetMock })),
    updateSetMock,
  };
}

describe('PlayerMailService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    assertFriendMock.mockResolvedValue(undefined);
    consumeFirstTalismanByScenarioMock.mockResolvedValue(undefined);
    sendMailMock.mockResolvedValue({ id: 'mail-1' });
    deleteArtifactsByIdsAndCultivatorMock.mockResolvedValue([{ id: 'artifact-1' }]);
    getAuctionItemSnapshotMock.mockResolvedValue({
      id: 'material-1',
      name: '玄铁',
      type: 'ore',
      rank: '玄品',
      quantity: 3,
    });
  });

  it('consumes the blank jade slip, detaches one transferable attachment, and sends mail', async () => {
    const tx = createTx();

    await expect(
      sendPlayerMail({
        senderCultivatorId: 'sender-1',
        senderName: '韩立',
        recipientCultivatorId: 'recipient-1',
        content: '此物赠与道友。',
        attachment: {
          itemType: 'material',
          itemId: 'material-1',
          quantity: 2,
        },
        tx: tx as any,
      }),
    ).resolves.toEqual({
      recipientName: '南宫婉',
      attachmentCount: 1,
    });

    expect(assertFriendMock).toHaveBeenCalledWith(
      'sender-1',
      'recipient-1',
      tx,
    );
    expect(consumeFirstTalismanByScenarioMock).toHaveBeenCalledWith(
      'sender-1',
      'friend_mail_send',
      tx,
    );
    expect(assertAuctionListableItemMock).toHaveBeenCalledWith(
      'material',
      expect.objectContaining({ name: '玄铁', quantity: 3 }),
      2,
    );
    expect(tx.update).toHaveBeenCalledWith(schema.materials);
    expect(tx.updateSetMock).toHaveBeenCalledWith({ quantity: 1 });
    expect(sendMailMock).toHaveBeenCalledWith(
      'recipient-1',
      '来自韩立的传音',
      '此物赠与道友。',
      [
        {
          type: 'material',
          name: '玄铁',
          quantity: 2,
          data: expect.objectContaining({ name: '玄铁', quantity: 2 }),
        },
      ],
      'reward',
      tx,
    );
  });

  it('rejects sending to non-friends', async () => {
    const tx = createTx();
    assertFriendMock.mockRejectedValueOnce(new Error('只能向好友名录中的道友发送'));

    await expect(
      sendPlayerMail({
        senderCultivatorId: 'sender-1',
        senderName: '韩立',
        recipientCultivatorId: 'recipient-1',
        content: '此物赠与道友。',
        tx: tx as any,
      }),
    ).rejects.toThrow('只能向好友名录中的道友发送');
    expect(sendMailMock).not.toHaveBeenCalled();
  });
});
