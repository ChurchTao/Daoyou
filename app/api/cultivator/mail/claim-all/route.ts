import { resourceEngine } from '@/engine/resource/ResourceEngine';
import { ResourceOperation } from '@/engine/resource/types';
import { withActiveCultivator } from '@/lib/api/withAuth';
import { getExecutor, type DbTransaction } from '@/lib/drizzle/db';
import { mails } from '@/lib/drizzle/schema';
import { MailAttachment } from '@/lib/services/MailService';
import { Artifact, Consumable, Material } from '@/types/cultivator';
import { and, eq, inArray } from 'drizzle-orm';
import { NextResponse } from 'next/server';

/**
 * POST /api/cultivator/mail/claim-all
 * 一键领取所有可领取附件
 */
export const POST = withActiveCultivator(
  async (_request, { user, cultivator }) => {
    const q = getExecutor();

    const pendingMails = await q.query.mails.findMany({
      where: and(
        eq(mails.type, 'reward'),
        eq(mails.cultivatorId, cultivator.id),
        eq(mails.isClaimed, false),
      ),
    });

    const claimableMails = pendingMails.filter((mail) => {
      const attachments = (mail.attachments as MailAttachment[]) || [];
      return attachments.length > 0;
    });

    if (claimableMails.length === 0) {
      return NextResponse.json({
        success: true,
        claimedCount: 0,
        claimedMailIds: [],
      });
    }

    const gains: ResourceOperation[] = [];
    const claimedMailIds = claimableMails.map((mail) => mail.id);

    for (const mail of claimableMails) {
      const attachments = (mail.attachments as MailAttachment[]) || [];
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
            // Artifact 领取以单件入包，按数量展开操作
            for (let i = 0; i < (item.quantity || 1); i++) {
              gains.push({
                type: 'artifact',
                value: 1,
                data: item.data as Artifact,
              });
            }
            break;
        }
      }
    }

    const result = await resourceEngine.gain(
      user.id,
      cultivator.id,
      gains,
      async (tx: DbTransaction) => {
        await tx
          .update(mails)
          .set({ isClaimed: true, isRead: true })
          .where(inArray(mails.id, claimedMailIds));
      },
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.errors?.[0] || '一键领取失败' },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      claimedCount: claimedMailIds.length,
      claimedMailIds,
    });
  },
);
