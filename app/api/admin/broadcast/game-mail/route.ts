import { resolveGameMailRecipients } from '@/lib/admin/recipient-resolver';
import { normalizeTemplatePayload, renderTemplate } from '@/lib/admin/template';
import { withAdminAuth } from '@/lib/api/adminAuth';
import { db } from '@/lib/drizzle/db';
import { adminMessageTemplates, mails } from '@/lib/drizzle/schema';
import { MailAttachment } from '@/lib/services/MailService';
import { REALM_VALUES } from '@/types/constants';
import { eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

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

export const POST = withAdminAuth(async (request: NextRequest) => {
  const body = await request.json();
  const parsed = GameMailBroadcastSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: '参数错误', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { templateId, filters, payload, dryRun } = parsed.data;
  const resolvedRecipients = await resolveGameMailRecipients(filters);

  if (dryRun) {
    return NextResponse.json({
      dryRun: true,
      totalRecipients: resolvedRecipients.totalCount,
      sampleRecipients: resolvedRecipients.sampleRecipients,
    });
  }

  let finalTitle = parsed.data.title ?? '';
  let finalContent = parsed.data.content ?? '';
  let finalReward = parsed.data.rewardSpiritStones ?? 0;

  if (templateId) {
    const template = await db().query.adminMessageTemplates.findFirst({
      where: eq(adminMessageTemplates.id, templateId),
    });

    if (!template) {
      return NextResponse.json({ error: '模板不存在' }, { status: 404 });
    }
    if (template.channel !== 'game_mail') {
      return NextResponse.json({ error: '模板频道不匹配' }, { status: 400 });
    }
    if (template.status !== 'active') {
      return NextResponse.json({ error: '模板已停用' }, { status: 400 });
    }

    const mergedPayload = normalizeTemplatePayload(
      template.defaultPayload,
      payload,
    );
    finalContent = renderTemplate(template.contentTemplate, mergedPayload);

    if (template.subjectTemplate) {
      finalTitle = renderTemplate(template.subjectTemplate, mergedPayload);
    } else if (!finalTitle) {
      return NextResponse.json(
        { error: '模板缺少标题，请填写 title 或配置 subjectTemplate' },
        { status: 400 },
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
    await db()
      .insert(mails)
      .values(rows.slice(i, i + batchSize));
  }

  return NextResponse.json({
    success: true,
    totalRecipients: rows.length,
    mailType: type,
    rewardSpiritStones: finalReward,
  });
});
