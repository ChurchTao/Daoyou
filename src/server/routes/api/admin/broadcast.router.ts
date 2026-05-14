import {
  resolveEmailRecipients,
  resolveGameMailRecipients,
} from '@server/lib/admin/recipient-resolver';
import { sendViaSmtp } from '@server/lib/admin/smtp';
import {
  normalizeTemplatePayload,
  renderTemplate,
} from '@server/lib/admin/template';
import { getExecutor } from '@server/lib/drizzle/db';
import { adminMessageTemplates, mails } from '@server/lib/drizzle/schema';
import { requireAdmin } from '@server/lib/hono/middleware';
import type { AppEnv } from '@server/lib/hono/types';
import type { MailAttachment } from '@server/lib/services/MailService';
import { REALM_VALUES } from '@shared/types/constants';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';

const EmailBroadcastSchema = z
  .object({
    templateId: z.string().uuid().optional(),
    subject: z.string().trim().min(1).max(200).optional(),
    content: z.string().trim().min(1).max(10000).optional(),
    payload: z
      .record(z.string(), z.union([z.string(), z.number()]))
      .default({}),
    filters: z
      .object({
        registeredFrom: z.string().optional(),
        registeredTo: z.string().optional(),
        hasActiveCultivator: z.boolean().optional(),
        realmMin: z.enum(REALM_VALUES).optional(),
        realmMax: z.enum(REALM_VALUES).optional(),
      })
      .default({}),
    dryRun: z.boolean().optional().default(false),
  })
  .superRefine((value, ctx) => {
    if (!value.templateId && (!value.subject || !value.content)) {
      ctx.addIssue({
        code: 'custom',
        path: ['subject'],
        message: '未使用模板时，subject/content 必填',
      });
    }
  });

const GameMailBroadcastSchema = z
  .object({
    templateId: z.string().uuid().optional(),
    title: z.string().trim().min(1).max(200).optional(),
    content: z.string().trim().min(1).max(10000).optional(),
    rewardSpiritStones: z.number().int().min(0).max(100000000).optional(),
    payload: z
      .record(z.string(), z.union([z.string(), z.number()]))
      .default({}),
    filters: z
      .object({
        cultivatorCreatedFrom: z.string().optional(),
        cultivatorCreatedTo: z.string().optional(),
        realmMin: z.enum(REALM_VALUES).optional(),
        realmMax: z.enum(REALM_VALUES).optional(),
      })
      .default({}),
    dryRun: z.boolean().optional().default(false),
  })
  .superRefine((value, ctx) => {
    if (!value.templateId && (!value.title || !value.content)) {
      ctx.addIssue({
        code: 'custom',
        path: ['title'],
        message: '未使用模板时，title/content 必填',
      });
    }
  });

const router = new Hono<AppEnv>();

router.post('/email', requireAdmin(), async (c) => {
  const q = getExecutor();
  const body = await c.req.json().catch(() => null);
  const parsed = EmailBroadcastSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      { error: '参数错误', details: parsed.error.flatten() },
      400,
    );
  }

  const { templateId, payload, filters, dryRun } = parsed.data;
  const resolvedRecipients = await resolveEmailRecipients(filters);

  if (dryRun) {
    return c.json({
      dryRun: true,
      totalRecipients: resolvedRecipients.totalCount,
      sampleRecipients: resolvedRecipients.sampleRecipients,
    });
  }

  let finalSubject = parsed.data.subject ?? '';
  let finalContent = parsed.data.content ?? '';

  if (templateId) {
    const template = await q.query.adminMessageTemplates.findFirst({
      where: eq(adminMessageTemplates.id, templateId),
    });

    if (!template) {
      return c.json({ error: '模板不存在' }, 404);
    }
    if (template.channel !== 'email') {
      return c.json({ error: '模板频道不匹配' }, 400);
    }
    if (template.status !== 'active') {
      return c.json({ error: '模板已停用' }, 400);
    }
    if (!template.subjectTemplate) {
      return c.json({ error: 'email 模板缺少 subjectTemplate' }, 400);
    }

    const mergedPayload = normalizeTemplatePayload(
      template.defaultPayload,
      payload,
    );
    finalSubject = renderTemplate(template.subjectTemplate, mergedPayload);
    finalContent = renderTemplate(template.contentTemplate, mergedPayload);
  }

  const recipients = resolvedRecipients.recipients.map(
    (item) => item.recipientKey,
  );
  const batchSize = Number(process.env.ADMIN_BROADCAST_BATCH_SIZE ?? 20);

  let sent = 0;
  let failed = 0;
  const errors: string[] = [];

  for (let i = 0; i < recipients.length; i += batchSize) {
    const batch = recipients.slice(i, i + batchSize);
    const results = await Promise.allSettled(
      batch.map((email) => sendViaSmtp(email, finalSubject, finalContent)),
    );

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        sent += 1;
      } else {
        failed += 1;
        if (errors.length < 20) {
          errors.push(
            `${batch[index]}: ${result.reason?.message ?? 'unknown'}`,
          );
        }
      }
    });
  }

  return c.json({
    success: failed === 0,
    totalRecipients: recipients.length,
    sent,
    failed,
    errors,
  });
});

router.post('/game-mail', requireAdmin(), async (c) => {
  const q = getExecutor();
  const body = await c.req.json().catch(() => null);
  const parsed = GameMailBroadcastSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      { error: '参数错误', details: parsed.error.flatten() },
      400,
    );
  }

  const { templateId, filters, payload, dryRun } = parsed.data;
  const resolvedRecipients = await resolveGameMailRecipients(filters);

  if (dryRun) {
    return c.json({
      dryRun: true,
      totalRecipients: resolvedRecipients.totalCount,
      sampleRecipients: resolvedRecipients.sampleRecipients,
    });
  }

  let finalTitle = parsed.data.title ?? '';
  let finalContent = parsed.data.content ?? '';
  let finalReward = parsed.data.rewardSpiritStones ?? 0;

  if (templateId) {
    const template = await q.query.adminMessageTemplates.findFirst({
      where: eq(adminMessageTemplates.id, templateId),
    });

    if (!template) {
      return c.json({ error: '模板不存在' }, 404);
    }
    if (template.channel !== 'game_mail') {
      return c.json({ error: '模板频道不匹配' }, 400);
    }
    if (template.status !== 'active') {
      return c.json({ error: '模板已停用' }, 400);
    }

    const mergedPayload = normalizeTemplatePayload(
      template.defaultPayload,
      payload,
    );
    finalContent = renderTemplate(template.contentTemplate, mergedPayload);

    if (template.subjectTemplate) {
      finalTitle = renderTemplate(template.subjectTemplate, mergedPayload);
    } else if (!finalTitle) {
      return c.json(
        { error: '模板缺少标题，请填写 title 或配置 subjectTemplate' },
        400,
      );
    }

    if (parsed.data.rewardSpiritStones === undefined) {
      const maybeReward = mergedPayload.rewardSpiritStones;
      if (typeof maybeReward === 'number') {
        finalReward = Math.max(0, Math.floor(maybeReward));
      }
    }
  }

  const attachments: MailAttachment[] =
    finalReward > 0
      ? [
          {
            type: 'spirit_stones',
            name: '灵石',
            quantity: finalReward,
          },
        ]
      : [];

  const type = attachments.length > 0 ? 'reward' : 'system';
  const rows = resolvedRecipients.recipients.map((recipient) => ({
    cultivatorId: recipient.recipientKey,
    title: finalTitle,
    content: finalContent,
    type,
    attachments,
    isRead: false,
    isClaimed: false,
  }));

  const batchSize = Number(process.env.ADMIN_BROADCAST_BATCH_SIZE ?? 500);
  for (let i = 0; i < rows.length; i += batchSize) {
    await q.insert(mails).values(rows.slice(i, i + batchSize));
  }

  return c.json({
    success: true,
    totalRecipients: rows.length,
    mailType: type,
    rewardSpiritStones: finalReward,
  });
});

export default router;
