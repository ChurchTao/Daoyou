import { getExecutor, type DbTransaction } from '@server/lib/drizzle/db';
import * as schema from '@server/lib/drizzle/schema';
import { FRIEND_MAIL_TALISMAN_SCENARIO } from '@shared/config/socialConfig';
import {
  mailGiftBlockReason,
  type SendMailRequest,
} from '@shared/contracts/mail';
import { itemDefinition, ItemGrantSchema } from '@shared/inventory';
import type { MailAttachment } from '@shared/types/mail';
import { and, eq } from 'drizzle-orm';
import { assertFriend, FriendServiceError } from './FriendService';
import {
  assertInventoryIdle,
  InventoryError,
  inventoryItemOf,
  saveInventoryPlan,
} from './InventoryService';
import { MailService } from './MailService';
import {
  consumeFirstTalismanByScenario,
  TalismanScenarioError,
} from './TalismanScenarioService';

export type PlayerMailAttachmentInput = NonNullable<
  SendMailRequest['attachment']
>;

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
  owner: string,
  input: PlayerMailAttachmentInput,
  tx: DbTransaction,
): Promise<MailAttachment> {
  await assertInventoryIdle(owner);
  const before = (
    await tx
      .select()
      .from(schema.inventoryItems)
      .where(
        and(
          eq(schema.inventoryItems.cultivatorId, owner),
          eq(schema.inventoryItems.location, 'bag'),
        ),
      )
  ).map(inventoryItemOf);
  const item = before.find((row) => row.id === input.itemId);
  if (
    !item ||
    item.revision !== input.revision ||
    item.quantity < input.quantity
  )
    throw new InventoryError('附件已变化或数量不足，请重新选择');
  const equipped = await tx
    .select()
    .from(schema.combatV6EquipmentLoadouts)
    .where(eq(schema.combatV6EquipmentLoadouts.equipmentInstanceId, item.id))
    .limit(1);
  const reason = mailGiftBlockReason({
    ...item,
    equipped: equipped.length > 0,
  });
  if (reason) throw new InventoryError(reason);
  const grant = ItemGrantSchema.parse({
    definitionId: item.definitionId,
    quantity: input.quantity,
    ...(item.instanceData === null ? {} : { instanceData: item.instanceData }),
  });
  await saveInventoryPlan(
    owner,
    before,
    before.flatMap((row) =>
      row.id !== item.id
        ? [row]
        : row.quantity === input.quantity
          ? []
          : [
              {
                ...row,
                quantity: row.quantity - input.quantity,
                revision: row.revision + 1,
              },
            ],
    ),
    tx,
  );
  const name =
    (item.instanceData as { name?: string } | null)?.name ??
    itemDefinition(item.definitionId).name;
  return {
    type: 'inventory_v1',
    name,
    quantity: input.quantity,
    inventory: grant,
  };
}

export async function sendPlayerMail(input: {
  senderCultivatorId: string;
  senderName: string;
  recipientCultivatorId: string;
  content: string;
  attachment?: PlayerMailAttachmentInput;
  tx?: DbTransaction;
}): Promise<{
  recipientName: string;
  attachmentCount: number;
}> {
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
      const recipient = await assertActiveRecipient(
        input.recipientCultivatorId,
        tx,
      );
      const detached = input.attachment
        ? await detachAttachment(input.senderCultivatorId, input.attachment, tx)
        : null;
      const attachments = detached ? [detached] : [];

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
  };

  return input.tx
    ? persist(input.tx)
    : getExecutor().transaction((tx) => persist(tx));
}
