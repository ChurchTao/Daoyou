import { resourceEngine } from '@/engine/resource/ResourceEngine';
import { ResourceOperation } from '@/engine/resource/types';
import { withActiveCultivator } from '@/lib/api/withAuth';
import { getExecutor } from '@/lib/drizzle/db';
import { mails } from '@/lib/drizzle/schema';
import { MailAttachment } from '@/lib/services/MailService';
import { Artifact, Consumable, Material } from '@/types/cultivator';
import { and, eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const ClaimMailSchema = z.object({
  mailId: z.string(),
});

/**
 * POST /api/cultivator/mail/claim
 * 领取邮件附件
 */
export const POST = withActiveCultivator(
  async (request: NextRequest, { user, cultivator }) => {
    const q = getExecutor();
    const body = await request.json();
    const { mailId } = ClaimMailSchema.parse(body);

    // Verify mail belongs to this cultivator
    const mail = await q.query.mails.findFirst({
      where: and(eq(mails.id, mailId), eq(mails.cultivatorId, cultivator.id)),
    });

    if (!mail) {
      return NextResponse.json({ error: 'Mail not found' }, { status: 404 });
    }

    if (mail.isClaimed) {
      return NextResponse.json({ error: 'Already claimed' }, { status: 400 });
    }

    const attachments = (mail.attachments as MailAttachment[]) || [];

    if (attachments.length === 0) {
      return NextResponse.json({ message: 'No attachments' });
    }

    // Convert attachments to resource operations
    const gains: ResourceOperation[] = [];

    for (const item of attachments) {
      switch (item.type) {
        case 'spirit_stones':
          gains.push({
            type: 'spirit_stones',
            value: item.quantity,
          });
          break;
        case 'material':
          gains.push({
            type: 'material',
            value: item.quantity,
            data: item.data as Material,
          });
          break;
        case 'consumable':
          gains.push({
            type: 'consumable',
            value: item.quantity,
            data: item.data as Consumable,
          });
          break;
        case 'artifact':
          // Artifacts are typically 1 per attachment, but handle quantity just in case
          // ResourceEngine.gain() treats artifact value as 1 implicitly (no loop), so we add multiple ops if needed
          const qty = item.quantity || 1;
          for (let i = 0; i < qty; i++) {
            gains.push({
              type: 'artifact',
              value: 1,
              data: item.data as Artifact,
            });
          }
          break;
      }
    }

    // Use ResourceEngine to handle gains transactionally
    const result = await resourceEngine.gain(
      user.id,
      cultivator.id,
      gains,
      async () => {
        // Mark as claimed
        await q
          .update(mails)
          .set({ isClaimed: true, isRead: true })
          .where(eq(mails.id, mailId));
      },
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.errors?.[0] || '领取失败' },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  },
);
