import { withAdminAuth } from '@/lib/api/adminAuth';
import { getExecutor } from '@/lib/drizzle/db';
import { adminMessageTemplates } from '@/lib/drizzle/schema';
import { AdminChannel, TemplateStatus } from '@/types/admin-broadcast';
import { and, desc, eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const CreateTemplateSchema = z.object({
  channel: z.enum(['email', 'game_mail']),
  name: z.string().trim().min(1).max(120),
  subjectTemplate: z.string().trim().max(300).optional(),
  contentTemplate: z.string().trim().min(1).max(20000),
  defaultPayload: z
    .record(z.string(), z.union([z.string(), z.number()]))
    .default({}),
  status: z.enum(['active', 'disabled']).default('active'),
});

function validateEmailSubject(
  channel: AdminChannel,
  subjectTemplate?: string,
): string | null {
  if (channel === 'email' && !subjectTemplate?.trim()) {
    return 'email 模板必须提供 subjectTemplate';
  }
  return null;
}

export const GET = withAdminAuth(async (request: NextRequest) => {
  const q = getExecutor();
  const { searchParams } = new URL(request.url);
  const channel = searchParams.get('channel') as AdminChannel | null;
  const status = searchParams.get('status') as TemplateStatus | null;

  const whereConditions = [];
  if (channel === 'email' || channel === 'game_mail') {
    whereConditions.push(eq(adminMessageTemplates.channel, channel));
  }
  if (status === 'active' || status === 'disabled') {
    whereConditions.push(eq(adminMessageTemplates.status, status));
  }

  const templates = await q.query.adminMessageTemplates.findMany({
    where: whereConditions.length > 0 ? and(...whereConditions) : undefined,
    orderBy: [desc(adminMessageTemplates.createdAt)],
  });

  return NextResponse.json({ templates });
});

export const POST = withAdminAuth(async (request: NextRequest, { user }) => {
  const q = getExecutor();
  const body = await request.json();
  const parsed = CreateTemplateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: '参数错误', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const subjectError = validateEmailSubject(
    parsed.data.channel,
    parsed.data.subjectTemplate,
  );
  if (subjectError) {
    return NextResponse.json({ error: subjectError }, { status: 400 });
  }

  const [template] = await q
    .insert(adminMessageTemplates)
    .values({
      channel: parsed.data.channel,
      name: parsed.data.name,
      subjectTemplate: parsed.data.subjectTemplate,
      contentTemplate: parsed.data.contentTemplate,
      defaultPayload: parsed.data.defaultPayload,
      status: parsed.data.status,
      createdBy: user.id,
      updatedBy: user.id,
    })
    .returning();

  return NextResponse.json({ success: true, template });
});
