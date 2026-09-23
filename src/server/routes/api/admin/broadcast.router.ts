import {
  RecipientResolveError,
  resolveGameMailRecipients,
} from '@server/lib/admin/recipient-resolver';
import { db } from '@server/lib/drizzle/db';
import { requireAdmin } from '@server/lib/hono/middleware';
import type { AppEnv } from '@server/lib/hono/types';
import { findPublishedItemLibraryForSelections } from '@server/lib/repositories/itemLibraryRepository';
import {
  MailService,
  type MailAttachment,
} from '@server/lib/services/MailService';
import {
  ItemLibraryResolveError,
  ItemLibraryRewardSelectionsSchema,
  resolveItemLibrarySelections,
  summarizeMailAttachments,
} from '@shared/lib/itemLibrary';
import { REALM_VALUES } from '@shared/types/constants';
import { Hono } from 'hono';
import { z } from 'zod';

const GameMailBroadcastSchema = z.object({
  title: z.string().trim().min(1).max(200),
  content: z.string().trim().min(1).max(10000),
  rewardSelections: ItemLibraryRewardSelectionsSchema.default([]),
  filters: z
    .object({
      targetCultivatorId: z.string().uuid().optional(),
      cultivatorCreatedFrom: z.string().optional(),
      cultivatorCreatedTo: z.string().optional(),
      realmMin: z.enum(REALM_VALUES).optional(),
      realmMax: z.enum(REALM_VALUES).optional(),
    })
    .default({}),
  dryRun: z.boolean().optional().default(false),
});

const router = new Hono<AppEnv>();

router.post('/game-mail', requireAdmin(), async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = GameMailBroadcastSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: '参数错误', details: parsed.error.flatten() }, 400);
  }

  const { title, content, filters, dryRun } = parsed.data;
  let resolvedRecipients;
  try {
    resolvedRecipients = await resolveGameMailRecipients(filters);
  } catch (error) {
    if (error instanceof RecipientResolveError) {
      return c.json(
        { error: error.message },
        { status: error.status as 400 | 404 },
      );
    }
    throw error;
  }

  if (dryRun) {
    return c.json({
      dryRun: true,
      totalRecipients: resolvedRecipients.totalCount,
      sampleRecipients: resolvedRecipients.sampleRecipients,
    });
  }

  let attachments: MailAttachment[] = [];

  try {
    const itemLibraryEntries = await findPublishedItemLibraryForSelections(
      parsed.data.rewardSelections,
    );
    attachments = resolveItemLibrarySelections(
      parsed.data.rewardSelections,
      itemLibraryEntries,
    );
  } catch (error) {
    if (error instanceof ItemLibraryResolveError) {
      return c.json({ error: error.message }, 400);
    }

    return c.json(
      {
        error: error instanceof Error ? error.message : '道具库加载失败',
      },
      500,
    );
  }

  const type = attachments.length > 0 ? 'reward' : 'system';
  const rows = resolvedRecipients.recipients.map((recipient) => ({
    cultivatorId: recipient.recipientKey,
    title,
    content,
    attachments,
  }));

  const batchSize = Number(process.env.ADMIN_BROADCAST_BATCH_SIZE ?? 500);
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    await db.transaction(async (tx) => {
      for (const row of batch) {
        await MailService.sendNewRewardMail(
          row.cultivatorId,
          row.title,
          row.content,
          row.attachments,
          type,
          tx,
        );
      }
    });
  }

  return c.json({
    success: true,
    totalRecipients: rows.length,
    mailType: type,
    rewardSummary: summarizeMailAttachments(attachments),
  });
});

export default router;
