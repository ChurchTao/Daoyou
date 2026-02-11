import { withAdminAuth } from '@/lib/api/adminAuth';
import { db } from '@/lib/drizzle/db';
import { adminMessageTemplates } from '@/lib/drizzle/schema';
import { AdminChannel, TemplateStatus } from '@/types/admin-broadcast';
import { eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const UpdateTemplateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  channel: z.enum(['email', 'game_mail']).optional(),
  subjectTemplate: z.string().trim().max(300).optional(),
  contentTemplate: z.string().trim().min(1).max(20000).optional(),
  defaultPayload: z
    .record(z.string(), z.union([z.string(), z.number()]))
    .optional(),
  status: z.enum(['active', 'disabled']).optional(),
});

function validateEmailSubject(
  channel: AdminChannel,
  subjectTemplate?: string | null,
): string | null {
  if (channel === 'email' && !subjectTemplate?.trim()) {
    return 'email 模板必须提供 subjectTemplate';
  }
  return null;
}

export const GET = withAdminAuth<{ id: string }>(
  async (_request: NextRequest, _ctx, params) => {
    const template = await db().query.adminMessageTemplates.findFirst({
      where: eq(adminMessageTemplates.id, params.id),
    });

    if (!template) {
      return NextResponse.json({ error: '模板不存在' }, { status: 404 });
    }

    return NextResponse.json({ template });
  },
);

export const PATCH = withAdminAuth<{ id: string }>(
  async (request: NextRequest, { user }, params) => {
    const template = await db().query.adminMessageTemplates.findFirst({
      where: eq(adminMessageTemplates.id, params.id),
    });

    if (!template) {
      return NextResponse.json({ error: '模板不存在' }, { status: 404 });
    }

    const body = await request.json();
    const parsed = UpdateTemplateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: '参数错误', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const nextChannel = (parsed.data.channel ??
      template.channel) as AdminChannel;
    const nextSubjectTemplate =
      parsed.data.subjectTemplate ?? template.subjectTemplate;

    const subjectError = validateEmailSubject(nextChannel, nextSubjectTemplate);
    if (subjectError) {
      return NextResponse.json({ error: subjectError }, { status: 400 });
    }

    const patch: {
      name?: string;
      channel?: AdminChannel;
      subjectTemplate?: string;
      contentTemplate?: string;
      defaultPayload?: Record<string, string | number>;
      status?: TemplateStatus;
      updatedBy: string;
    } = {
      updatedBy: user.id,
    };

    if (parsed.data.name !== undefined) patch.name = parsed.data.name;
    if (parsed.data.channel !== undefined) patch.channel = parsed.data.channel;
    if (parsed.data.subjectTemplate !== undefined) {
      patch.subjectTemplate = parsed.data.subjectTemplate;
    }
    if (parsed.data.contentTemplate !== undefined) {
      patch.contentTemplate = parsed.data.contentTemplate;
    }
    if (parsed.data.defaultPayload !== undefined) {
      patch.defaultPayload = parsed.data.defaultPayload;
    }
    if (parsed.data.status !== undefined) patch.status = parsed.data.status;

    const [updated] = await db()
      .update(adminMessageTemplates)
      .set(patch)
      .where(eq(adminMessageTemplates.id, params.id))
      .returning();

    return NextResponse.json({ success: true, template: updated });
  },
);
