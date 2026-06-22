import { getExecutor, type DbTransaction } from '@server/lib/drizzle/db';
import * as creationProductRepository from '@server/lib/repositories/creationProductRepository';
import * as schema from '@server/lib/drizzle/schema';
import { FRIEND_MAIL_TALISMAN_SCENARIO } from '@shared/config/socialConfig';
import type { Artifact, Consumable, Material } from '@shared/types/cultivator';
import type { MailAttachment } from '@shared/types/mail';
import { and, eq } from 'drizzle-orm';
import {
  assertAuctionListableItem,
  AuctionServiceError,
  getAuctionItemSnapshot,
  type AuctionItemType,
} from './AuctionService';
import { assertFriend, FriendServiceError } from './FriendService';
import { MailService } from './MailService';
import {
  consumeFirstTalismanByScenario,
  TalismanScenarioError,
} from './TalismanScenarioService';

export type PlayerMailAttachmentInput = {
  itemType: AuctionItemType;
  itemId: string;
  quantity: number;
};

export class PlayerMailServiceError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'PlayerMailServiceError';
  }
}

async function assertActiveRecipient(
  recipientCultivatorId: string,
  tx: DbTransaction,
): Promise<{ id: string; name: string }> {
  const [recipient] = await tx
    .select({
      id: schema.cultivators.id,
      name: schema.cultivators.name,
    })
    .from(schema.cultivators)
    .where(
      and(
        eq(schema.cultivators.id, recipientCultivatorId),
        eq(schema.cultivators.status, 'active'),
      ),
    )
    .limit(1);

  if (!recipient) {
    throw new PlayerMailServiceError(404, '未找到收信道友');
  }

  return recipient;
}

async function detachAttachment(
  senderCultivatorId: string,
  attachment: PlayerMailAttachmentInput,
  tx: DbTransaction,
): Promise<MailAttachment> {
  if (attachment.quantity < 1) {
    throw new PlayerMailServiceError(400, '附件数量必须至少为 1');
  }

  const item = await getAuctionItemSnapshot(
    attachment.itemType,
    attachment.itemId,
    senderCultivatorId,
    tx,
  );
  if (!item) {
    throw new PlayerMailServiceError(404, '附件物品不存在或已被消耗');
  }

  try {
    assertAuctionListableItem(attachment.itemType, item, attachment.quantity);
  } catch (error) {
    if (error instanceof AuctionServiceError) {
      throw new PlayerMailServiceError(400, error.message);
    }
    throw error;
  }

  if (attachment.itemType === 'artifact') {
    const deleted =
      await creationProductRepository.deleteArtifactsByIdsAndCultivator(
        senderCultivatorId,
        [attachment.itemId],
        tx,
      );
    if (deleted.length !== 1) {
      throw new PlayerMailServiceError(404, '附件物品不存在或已被消耗');
    }
  } else if (attachment.itemType === 'material') {
    const current = item as Material;
    if (attachment.quantity === current.quantity) {
      await tx
        .delete(schema.materials)
        .where(
          and(
            eq(schema.materials.id, attachment.itemId),
            eq(schema.materials.cultivatorId, senderCultivatorId),
          ),
        );
    } else {
      await tx
        .update(schema.materials)
        .set({ quantity: current.quantity - attachment.quantity })
        .where(
          and(
            eq(schema.materials.id, attachment.itemId),
            eq(schema.materials.cultivatorId, senderCultivatorId),
          ),
        );
    }
  } else {
    const current = item as Consumable;
    if (attachment.quantity === current.quantity) {
      await tx
        .delete(schema.consumables)
        .where(
          and(
            eq(schema.consumables.id, attachment.itemId),
            eq(schema.consumables.cultivatorId, senderCultivatorId),
          ),
        );
    } else {
      await tx
        .update(schema.consumables)
        .set({ quantity: current.quantity - attachment.quantity })
        .where(
          and(
            eq(schema.consumables.id, attachment.itemId),
            eq(schema.consumables.cultivatorId, senderCultivatorId),
          ),
        );
    }
  }

  const snapshot =
    attachment.itemType === 'artifact'
      ? (item as Artifact)
      : ({ ...item, quantity: attachment.quantity } as Material | Consumable);

  return {
    type: attachment.itemType,
    name: snapshot.name,
    quantity: attachment.quantity,
    data: snapshot,
  };
}

export async function sendPlayerMail(input: {
  senderCultivatorId: string;
  senderName: string;
  recipientCultivatorId: string;
  content: string;
  attachment?: PlayerMailAttachmentInput;
  tx?: DbTransaction;
}): Promise<{ recipientName: string; attachmentCount: number }> {
  const persist = async (tx: DbTransaction) => {
    if (input.senderCultivatorId === input.recipientCultivatorId) {
      throw new PlayerMailServiceError(400, '不能给自己发送传音');
    }

    try {
      await assertFriend(
        input.senderCultivatorId,
        input.recipientCultivatorId,
        tx,
      );
      await consumeFirstTalismanByScenario(
        input.senderCultivatorId,
        FRIEND_MAIL_TALISMAN_SCENARIO,
        tx,
      );
    } catch (error) {
      if (error instanceof FriendServiceError) {
        throw new PlayerMailServiceError(403, error.message);
      }
      if (error instanceof TalismanScenarioError) {
        throw new PlayerMailServiceError(
          400,
          '缺少空白传音符，可前往天骄宝阁购买后再发送传音',
        );
      }
      throw error;
    }

    const recipient = await assertActiveRecipient(input.recipientCultivatorId, tx);
    const attachments = input.attachment
      ? [await detachAttachment(input.senderCultivatorId, input.attachment, tx)]
      : [];

    await MailService.sendMail(
      input.recipientCultivatorId,
      `来自${input.senderName}的传音`,
      input.content,
      attachments,
      attachments.length > 0 ? 'reward' : 'system',
      tx,
    );

    return {
      recipientName: recipient.name,
      attachmentCount: attachments.length,
    };
  };

  return input.tx
    ? persist(input.tx)
    : getExecutor().transaction((tx) => persist(tx));
}
