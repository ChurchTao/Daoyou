import { resolveEmailRecipients } from '@/lib/admin/recipient-resolver';
import { normalizeTemplatePayload, renderTemplate } from '@/lib/admin/template';
import { sendViaSmtp } from '@/lib/admin/smtp';
import { withAdminAuth } from '@/lib/api/adminAuth';
import { db } from '@/lib/drizzle/db';
import { adminMessageTemplates } from '@/lib/drizzle/schema';
import { REALM_VALUES } from '@/types/constants';
import { eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const EmailBroadcastSchema = z
  .object({
    templateId: z.string().uuid().optional(),
    subject: z.string().trim().min(1).max(200).optional(),
    content: z.string().trim().min(1).max(10000).optional(),
    payload: z.record(z.string(), z.union([z.string(), z.number()])).default({}),
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

export const POST = withAdminAuth(async (request: NextRequest) => {
  const body = await request.json();
  const parsed = EmailBroadcastSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: '参数错误', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { templateId, payload, filters, dryRun } = parsed.data;
  const resolvedRecipients = await resolveEmailRecipients(filters);

  if (dryRun) {
    return NextResponse.json({
      dryRun: true,
      totalRecipients: resolvedRecipients.totalCount,
      sampleRecipients: resolvedRecipients.sampleRecipients,
    });
  }

  let finalSubject = parsed.data.subject ?? '';
  let finalContent = parsed.data.content ?? '';

  if (templateId) {
    const template = await db.query.adminMessageTemplates.findFirst({
      where: eq(adminMessageTemplates.id, templateId),
    });

    if (!template) {
      return NextResponse.json({ error: '模板不存在' }, { status: 404 });
    }
    if (template.channel !== 'email') {
      return NextResponse.json({ error: '模板频道不匹配' }, { status: 400 });
    }
    if (template.status !== 'active') {
      return NextResponse.json({ error: '模板已停用' }, { status: 400 });
    }
    if (!template.subjectTemplate) {
      return NextResponse.json(
        { error: 'email 模板缺少 subjectTemplate' },
        { status: 400 },
      );
    }

    const mergedPayload = normalizeTemplatePayload(template.defaultPayload, payload);
    finalSubject = renderTemplate(template.subjectTemplate, mergedPayload);
    finalContent = renderTemplate(template.contentTemplate, mergedPayload);
  }

  const recipients = resolvedRecipients.recipients.map((item) => item.recipientKey);
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
          errors.push(`${batch[index]}: ${result.reason?.message ?? 'unknown'}`);
        }
      }
    });
  }

  return NextResponse.json({
    success: failed === 0,
    totalRecipients: recipients.length,
    sent,
    failed,
    errors,
  });
});
