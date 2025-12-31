import { withActiveCultivator } from '@/lib/api/withAuth';
import { db } from '@/lib/drizzle/db';
import {
  artifacts,
  consumables,
  cultivators,
  mails,
  materials,
} from '@/lib/drizzle/schema';
import { MailAttachment } from '@/lib/services/MailService';
import { Artifact, Consumable, Material } from '@/types/cultivator';
import { and, eq, sql } from 'drizzle-orm';
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
  async (request: NextRequest, { cultivator }) => {
    const body = await request.json();
    const { mailId } = ClaimMailSchema.parse(body);

    // Verify mail belongs to this cultivator
    const mail = await db.query.mails.findFirst({
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

    await db.transaction(async (tx) => {
      for (const item of attachments) {
        if (item.type === 'spirit_stones') {
          await tx
            .update(cultivators)
            .set({
              spirit_stones: sql`${cultivators.spirit_stones} + ${item.quantity}`,
            })
            .where(eq(cultivators.id, cultivator.id));
        } else if (item.type === 'material') {
          const material = item.data as Material;
          // Check if exists
          const existing = await tx
            .select()
            .from(materials)
            .where(
              and(
                eq(materials.cultivatorId, cultivator.id),
                eq(materials.name, material.name),
                eq(materials.rank, material.rank || '凡品'),
              ),
            )
            .limit(1);

          if (existing.length > 0) {
            await tx
              .update(materials)
              .set({
                quantity: sql`${materials.quantity} + ${item.quantity}`,
              })
              .where(eq(materials.id, existing[0].id));
          } else {
            await tx.insert(materials).values({
              cultivatorId: cultivator.id,
              name: material.name,
              quantity: item.quantity,
              type: material.type || 'other',
              rank: material.rank || '凡品',
              element: material.element || '无',
              description: material.description || '',
              details: material.details || {},
            });
          }
        } else if (item.type === 'consumable') {
          const consumable = item.data as Consumable;
          const existing = await tx
            .select()
            .from(consumables)
            .where(
              and(
                eq(consumables.cultivatorId, cultivator.id),
                eq(consumables.name, consumable.name),
                eq(consumables.quality, consumable.quality || '凡品'),
              ),
            )
            .limit(1);

          if (existing.length > 0) {
            await tx
              .update(consumables)
              .set({
                quantity: sql`${consumables.quantity} + ${item.quantity}`,
              })
              .where(eq(consumables.id, existing[0].id));
          } else {
            await tx.insert(consumables).values({
              cultivatorId: cultivator.id,
              name: consumable.name,
              quantity: item.quantity,
              type: consumable.type || '丹药',
              quality: consumable.quality || '凡品',
              effect: consumable.effect || {},
              description: consumable.description || '',
            });
          }
        } else if (item.type === 'artifact') {
          // Artifacts don't stack, just insert
          const artifact = item.data as Artifact;
          await tx.insert(artifacts).values({
            cultivatorId: cultivator.id,
            name: artifact.name,
            quality: artifact.quality || '凡品',
            slot: artifact.slot || 'weapon',
            element: artifact.element || '无',
            bonus: artifact.bonus || {},
            special_effects: artifact.special_effects || [],
            curses: artifact.curses || [],
            description: artifact.description || '',
          });
        }
      }

      // Mark as claimed
      await tx
        .update(mails)
        .set({ isClaimed: true, isRead: true })
        .where(eq(mails.id, mailId));
    });

    return NextResponse.json({ success: true });
  },
);
