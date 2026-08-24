import { db } from '@server/lib/drizzle/db';
import { consumables, cultivators, mails } from '@server/lib/drizzle/schema';
import type { CultivatorCondition } from '@shared/types/condition';
import type { PillSpec } from '@shared/types/consumable';
import type { Consumable } from '@shared/types/cultivator';
import type { MailAttachment } from '@shared/types/mail';
import { eq, inArray, sql } from 'drizzle-orm';

function disablePillToxicity(input: unknown): {
  spec: unknown;
  changed: boolean;
  isSystemAuctionPill: boolean;
} {
  if (!input || typeof input !== 'object') {
    return { spec: input, changed: false, isSystemAuctionPill: false };
  }
  const spec = structuredClone(input) as PillSpec;
  if (
    spec.kind !== 'pill' ||
    !Array.isArray(spec.operations) ||
    !spec.alchemyMeta?.tags?.includes('system-auction')
  ) {
    return { spec: input, changed: false, isSystemAuctionPill: false };
  }

  const operations = spec.operations.filter(
    (operation) =>
      !(
        operation.type === 'change_gauge' && operation.gauge === 'pillToxicity'
      ),
  );
  const changed =
    operations.length !== spec.operations.length ||
    spec.alchemyMeta.toxicityRating !== 0;
  if (!changed) {
    return { spec: input, changed: false, isSystemAuctionPill: true };
  }

  spec.operations = operations;
  spec.alchemyMeta = {
    ...spec.alchemyMeta,
    toxicityRating: 0,
  };
  return { spec, changed: true, isSystemAuctionPill: true };
}

async function disable(): Promise<{
  inventoryItems: number;
  mailAttachments: number;
  mails: number;
  toxicityResets: number;
}> {
  return db.transaction(async (tx) => {
    const affectedCultivatorIds = new Set<string>();
    const inventoryRows = await tx
      .select({
        id: consumables.id,
        cultivatorId: consumables.cultivatorId,
        spec: consumables.spec,
      })
      .from(consumables)
      .where(
        sql`${consumables.spec}->'alchemyMeta'->'tags' ? 'system-auction'`,
      );
    let inventoryItems = 0;
    for (const row of inventoryRows) {
      const result = disablePillToxicity(row.spec);
      if (!result.isSystemAuctionPill) continue;
      affectedCultivatorIds.add(row.cultivatorId);
      if (!result.changed) continue;
      await tx
        .update(consumables)
        .set({ spec: result.spec as PillSpec })
        .where(eq(consumables.id, row.id));
      inventoryItems += 1;
    }

    const mailRows = await tx
      .select({
        id: mails.id,
        cultivatorId: mails.cultivatorId,
        attachments: mails.attachments,
      })
      .from(mails);
    let repairedMails = 0;
    let mailAttachments = 0;
    for (const row of mailRows) {
      if (!Array.isArray(row.attachments)) continue;
      let changed = false;
      let containsSystemAuctionPill = false;
      const attachments = (row.attachments as MailAttachment[]).map(
        (attachment) => {
          if (attachment.type !== 'consumable' || !attachment.data) {
            return attachment;
          }
          const consumable = attachment.data as Consumable;
          const result = disablePillToxicity(consumable.spec);
          if (result.isSystemAuctionPill) containsSystemAuctionPill = true;
          if (!result.changed) return attachment;
          changed = true;
          mailAttachments += 1;
          return {
            ...attachment,
            data: { ...consumable, spec: result.spec as PillSpec },
          };
        },
      );
      if (containsSystemAuctionPill) {
        affectedCultivatorIds.add(row.cultivatorId);
      }
      if (!changed) continue;
      await tx.update(mails).set({ attachments }).where(eq(mails.id, row.id));
      repairedMails += 1;
    }

    let toxicityResets = 0;
    if (affectedCultivatorIds.size > 0) {
      const conditionRows = await tx
        .select({ id: cultivators.id, condition: cultivators.condition })
        .from(cultivators)
        .where(inArray(cultivators.id, [...affectedCultivatorIds]));
      for (const row of conditionRows) {
        const condition = structuredClone(row.condition) as CultivatorCondition;
        if (!condition.gauges || condition.gauges.pillToxicity <= 0) continue;
        condition.gauges = { ...condition.gauges, pillToxicity: 0 };
        await tx
          .update(cultivators)
          .set({ condition })
          .where(eq(cultivators.id, row.id));
        toxicityResets += 1;
      }
    }

    return {
      inventoryItems,
      mailAttachments,
      mails: repairedMails,
      toxicityResets,
    };
  });
}

try {
  console.info(await disable());
  process.exit(0);
} catch (error) {
  console.error(error);
  process.exit(1);
}
