import { withAdminAuth } from '@/lib/api/adminAuth';
import { db } from '@/lib/drizzle/db';
import { cultivators, mails } from '@/lib/drizzle/schema';
import { MailAttachment } from '@/lib/services/MailService';
import { eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const GameMailBroadcastSchema = z.object({
  title: z.string().trim().min(1).max(200),
  content: z.string().trim().min(1).max(10000),
  rewardSpiritStones: z.number().int().min(0).max(100000000).default(0),
  dryRun: z.boolean().optional().default(false),
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

  const { title, content, rewardSpiritStones, dryRun } = parsed.data;

  const recipients = await db
    .select({ id: cultivators.id })
    .from(cultivators)
    .where(eq(cultivators.status, 'active'));

  if (dryRun) {
    return NextResponse.json({
      dryRun: true,
      totalRecipients: recipients.length,
    });
  }

  const attachments: MailAttachment[] =
    rewardSpiritStones > 0
      ? [
          {
            type: 'spirit_stones',
            name: '灵石',
            quantity: rewardSpiritStones,
          },
        ]
      : [];

  const type = attachments.length > 0 ? 'reward' : 'system';
  const rows = recipients.map((recipient) => ({
    cultivatorId: recipient.id,
    title,
    content,
    type,
    attachments,
    isRead: false,
    isClaimed: false,
  }));

  const batchSize = 500;
  for (let i = 0; i < rows.length; i += batchSize) {
    await db.insert(mails).values(rows.slice(i, i + batchSize));
  }

  return NextResponse.json({
    success: true,
    totalRecipients: recipients.length,
    mailType: type,
    rewardSpiritStones,
  });
});
