import type { DbTransaction } from '@server/lib/drizzle/db.js';
import { cultivatorBeasts } from '@server/lib/drizzle/schema.js';
import { beastIndividualData } from '@server/lib/repositories/combatV6BeastRepository.js';
import {
  BeastTransferSchema,
  planBeastMailClaims,
  receiveTradedBeast,
} from '@daoyou/game-rules/beasts/trade';
import { BEAST_CAPACITY } from '@daoyou/game-rules/beasts/growth';
import type { MailAttachment } from '@daoyou/game-domain/mail';
import { count, eq } from 'drizzle-orm';
import {
  assertBeastIdle,
  BeastError,
  beastMutationOccupied,
} from '@server/combat/application/BeastMutationGuard.js';

function beastTransfers(attachments: MailAttachment[]) {
  return attachments
    .filter((a) => a.type === 'beast_v1')
    .map((a) => {
      if (a.quantity !== 1) throw new Error('灵兽附件数量无效');
      return BeastTransferSchema.parse(a.beast);
    });
}
async function freeSlots(owner: string, tx: DbTransaction) {
  const [row] = await tx
    .select({ count: count() })
    .from(cultivatorBeasts)
    .where(eq(cultivatorBeasts.cultivatorId, owner));
  return Math.max(0, BEAST_CAPACITY - row.count);
}

/** Called while the owning player command holds the character lock and transaction. */
export async function deliverMailBeasts(
  owner: string,
  attachments: MailAttachment[],
  tx: DbTransaction,
) {
  const transfers = beastTransfers(attachments);
  if (!transfers.length) return [];
  await assertBeastIdle(owner);
  if (transfers.length > (await freeSlots(owner, tx)))
    throw new BeastError('灵兽袋已满，请腾出位置后再领取；附件仍会保留');
  for (const transfer of transfers) {
    const beast = receiveTradedBeast(transfer, owner);
    await tx.insert(cultivatorBeasts).values({
      id: beast.id,
      cultivatorId: owner,
      individual: beastIndividualData(beast),
      createdAt: new Date(transfer.createdAt),
    });
  }
  return ['beasts'];
}

export async function selectClaimableBeastMails<
  T extends { id: string; createdAt: Date; attachments: unknown },
>(owner: string, mails: T[], tx: DbTransaction) {
  const candidates = mails.map((mail) => ({
    ...mail,
    beastCount: beastTransfers((mail.attachments ?? []) as MailAttachment[])
      .length,
  }));
  const hasBeasts = candidates.some((m) => m.beastCount > 0);
  return planBeastMailClaims(
    candidates,
    hasBeasts ? await freeSlots(owner, tx) : 0,
    hasBeasts && (await beastMutationOccupied(owner)),
  );
}
