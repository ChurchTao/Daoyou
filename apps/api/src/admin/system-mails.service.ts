import { SystemMailInputSchema } from '@daoyou/game-rules/mail';
import { HttpException, Inject, Injectable } from '@nestjs/common';
import { DRIZZLE_DATABASE } from '@server/database/database.service.js';
import type { DbClient } from '@server/lib/drizzle/db.js';
import { mails, systemMailCampaigns } from '@server/lib/drizzle/schema.js';
import { and, desc, eq, ilike, sql } from 'drizzle-orm';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import {
  CreateSchema,
  ListSchema,
  RevisionSchema,
  UpdateSchema,
} from './system-mails-input.js';
const countDeliveries = sql<number>`(select count(*)::int from ${mails} delivered where delivered.system_mail_campaign_id = ${systemMailCampaigns}.id)`;
function values(input: z.infer<typeof SystemMailInputSchema>) {
  return {
    ...input,
    startsAt: new Date(input.startsAt),
    endsAt: new Date(input.endsAt),
  };
}
@Injectable()
export class AdminSystemMailsService {
  constructor(@Inject(DRIZZLE_DATABASE) private readonly database: DbClient) {}

  async list(query: z.infer<typeof ListSchema>) {
    const { page, search } = query;
    const rows = await this.database
      .select({
        id: systemMailCampaigns.id,
        title: systemMailCampaigns.title,
        status: systemMailCampaigns.status,
        revision: systemMailCampaigns.revision,
        conditions: systemMailCampaigns.conditions,
        startsAt: systemMailCampaigns.startsAt,
        endsAt: systemMailCampaigns.endsAt,
        createdAt: systemMailCampaigns.createdAt,
        publishedAt: systemMailCampaigns.publishedAt,
        deliveredCount: countDeliveries,
      })
      .from(systemMailCampaigns)
      .where(
        search ? ilike(systemMailCampaigns.title, `%${search}%`) : undefined,
      )
      .orderBy(
        desc(systemMailCampaigns.createdAt),
        desc(systemMailCampaigns.id),
      )
      .limit(21)
      .offset((page - 1) * 20);
    return { items: rows.slice(0, 20), hasMore: rows.length > 20 };
  }
  async detail(idParam: string) {
    const id = z.uuid().parse(idParam);
    const [row] = await this.database
      .select()
      .from(systemMailCampaigns)
      .where(eq(systemMailCampaigns.id, id));
    if (!row) throw new HttpException({ error: '邮件发布记录不存在' }, 404);
    const [count] = await this.database
      .select({ count: sql<number>`count(*)::int` })
      .from(mails)
      .where(eq(mails.systemMailCampaignId, id));
    return {
      id: row.id,
      title: row.title,
      content: row.content,
      rewardSelections: row.rewardSelections,
      conditions: row.conditions,
      startsAt: row.startsAt,
      endsAt: row.endsAt,
      status: row.status,
      revision: row.revision,
      createdAt: row.createdAt,
      publishedAt: row.publishedAt,
      deliveredCount: count?.count ?? 0,
    };
  }
  async create(userId: string, request: z.infer<typeof CreateSchema>) {
    const { requestId, input } = request;
    const creationFingerprint = createHash('sha256')
      .update(JSON.stringify(input))
      .digest('hex');
    await this.database
      .insert(systemMailCampaigns)
      .values({
        ...values(input),
        id: requestId,
        creationFingerprint,
        createdBy: userId,
      })
      .onConflictDoNothing({ target: systemMailCampaigns.id });
    const [row] = await this.database
      .select()
      .from(systemMailCampaigns)
      .where(eq(systemMailCampaigns.id, requestId));
    if (!row || row.creationFingerprint !== creationFingerprint)
      throw new HttpException(
        { error: '此请求已用于其他内容，请重新打开编辑器' },
        409,
      );
    return { id: row.id, revision: row.revision, status: row.status };
  }
  async update(idParam: string, request: z.infer<typeof UpdateSchema>) {
    const id = z.uuid().parse(idParam);
    const { revision, input } = request;
    const [row] = await this.database
      .update(systemMailCampaigns)
      .set({ ...values(input), revision: revision + 1 })
      .where(
        and(
          eq(systemMailCampaigns.id, id),
          eq(systemMailCampaigns.status, 'draft'),
          eq(systemMailCampaigns.revision, revision),
        ),
      )
      .returning({
        id: systemMailCampaigns.id,
        revision: systemMailCampaigns.revision,
      });
    if (!row)
      throw new HttpException(
        { error: '草稿已变化或已发布，请关闭后重新打开' },
        409,
      );
    return row;
  }
  async publish(idParam: string, input: z.infer<typeof RevisionSchema>) {
    const id = z.uuid().parse(idParam);
    const { revision } = input;
    const result = await this.database.transaction(async (tx) => {
      const [row] = await tx
        .select()
        .from(systemMailCampaigns)
        .where(eq(systemMailCampaigns.id, id))
        .for('update');
      if (!row) return 'missing';
      if (row.status === 'published' && row.revision === revision + 1)
        return 'ok';
      if (row.status !== 'draft' || row.revision !== revision) return 'changed';
      if (row.endsAt.getTime() <= Date.now()) return 'expired';
      SystemMailInputSchema.parse({
        title: row.title,
        content: row.content,
        rewardSelections: row.rewardSelections,
        conditions: row.conditions,
        startsAt: row.startsAt.toISOString(),
        endsAt: row.endsAt.toISOString(),
      });
      await tx
        .update(systemMailCampaigns)
        .set({
          status: 'published',
          publishedAt: new Date(),
          revision: revision + 1,
        })
        .where(eq(systemMailCampaigns.id, id));
      return 'ok';
    });
    if (result === 'missing')
      throw new HttpException({ error: '邮件发布记录不存在' }, 404);
    if (result !== 'ok')
      throw new HttpException(
        {
          error:
            result === 'expired'
              ? '投递结束时间已过，请修改草稿'
              : '草稿已变化，请重新打开核对',
        },
        409,
      );
    return { success: true };
  }
  async stop(idParam: string, input: z.infer<typeof RevisionSchema>) {
    const id = z.uuid().parse(idParam);
    const { revision } = input;
    // UPDATE conflicts with the consumer's SHARE lock: after this commits,
    // no new delivery transaction can observe the campaign as published.
    const [row] = await this.database
      .update(systemMailCampaigns)
      .set({ status: 'stopped', revision: revision + 1 })
      .where(
        and(
          eq(systemMailCampaigns.id, id),
          eq(systemMailCampaigns.status, 'published'),
          eq(systemMailCampaigns.revision, revision),
        ),
      )
      .returning({ id: systemMailCampaigns.id });
    if (!row) {
      const [current] = await this.database
        .select({ status: systemMailCampaigns.status })
        .from(systemMailCampaigns)
        .where(eq(systemMailCampaigns.id, id));
      if (current?.status !== 'stopped')
        throw new HttpException({ error: '发布记录已变化，请重新打开' }, 409);
    }
    return { success: true };
  }
}
