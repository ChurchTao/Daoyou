import { db } from '@server/lib/drizzle/db';
import { mails, systemMailCampaigns } from '@server/lib/drizzle/schema';
import {
  getValidatedJson,
  getValidatedQuery,
  requireAdmin,
  validateJson,
  validateQuery,
} from '@server/lib/hono/middleware';
import type { AppEnv } from '@server/lib/hono/types';
import { SystemMailInputSchema } from '@shared/contracts/systemMail';
import { and, desc, eq, ilike, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { createHash } from 'node:crypto';
import { z } from 'zod';

const router = new Hono<AppEnv>();
router.use('*', requireAdmin());
const CreateSchema = z
  .object({ requestId: z.uuid(), input: SystemMailInputSchema })
  .strict();
const UpdateSchema = z
  .object({
    revision: z.number().int().positive(),
    input: SystemMailInputSchema,
  })
  .strict();
const RevisionSchema = z
  .object({ revision: z.number().int().positive() })
  .strict();
const ListSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  search: z.string().trim().max(200).default(''),
});
const countDeliveries = sql<number>`(select count(*)::int from ${mails} delivered where delivered.system_mail_campaign_id = ${systemMailCampaigns}.id)`;

function values(input: z.infer<typeof SystemMailInputSchema>) {
  return {
    ...input,
    startsAt: new Date(input.startsAt),
    endsAt: new Date(input.endsAt),
  };
}

router.get('/', validateQuery(ListSchema), async (c) => {
  const { page, search } = getValidatedQuery<z.infer<typeof ListSchema>>(c);
  const rows = await db
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
    .where(search ? ilike(systemMailCampaigns.title, `%${search}%`) : undefined)
    .orderBy(desc(systemMailCampaigns.createdAt), desc(systemMailCampaigns.id))
    .limit(21)
    .offset((page - 1) * 20);
  return c.json({ items: rows.slice(0, 20), hasMore: rows.length > 20 });
});

router.get('/:id', async (c) => {
  const id = z.uuid().parse(c.req.param('id'));
  const [row] = await db
    .select()
    .from(systemMailCampaigns)
    .where(eq(systemMailCampaigns.id, id));
  if (!row) return c.json({ error: '邮件发布记录不存在' }, 404);
  const [count] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(mails)
    .where(eq(mails.systemMailCampaignId, id));
  return c.json({
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
  });
});

router.post('/', validateJson(CreateSchema), async (c) => {
  const { requestId, input } =
    getValidatedJson<z.infer<typeof CreateSchema>>(c);
  const creationFingerprint = createHash('sha256')
    .update(JSON.stringify(input))
    .digest('hex');
  await db
    .insert(systemMailCampaigns)
    .values({
      ...values(input),
      id: requestId,
      creationFingerprint,
      createdBy: c.get('user')!.id,
    })
    .onConflictDoNothing({ target: systemMailCampaigns.id });
  const [row] = await db
    .select()
    .from(systemMailCampaigns)
    .where(eq(systemMailCampaigns.id, requestId));
  if (!row || row.creationFingerprint !== creationFingerprint)
    return c.json({ error: '此请求已用于其他内容，请重新打开编辑器' }, 409);
  return c.json({ id: row.id, revision: row.revision, status: row.status });
});

router.put('/:id', validateJson(UpdateSchema), async (c) => {
  const id = z.uuid().parse(c.req.param('id'));
  const { revision, input } = getValidatedJson<z.infer<typeof UpdateSchema>>(c);
  const [row] = await db
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
    return c.json({ error: '草稿已变化或已发布，请关闭后重新打开' }, 409);
  return c.json(row);
});

router.post('/:id/publish', validateJson(RevisionSchema), async (c) => {
  const id = z.uuid().parse(c.req.param('id'));
  const { revision } = getValidatedJson<z.infer<typeof RevisionSchema>>(c);
  const result = await db.transaction(async (tx) => {
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
  if (result === 'missing') return c.json({ error: '邮件发布记录不存在' }, 404);
  if (result !== 'ok')
    return c.json(
      {
        error:
          result === 'expired'
            ? '投递结束时间已过，请修改草稿'
            : '草稿已变化，请重新打开核对',
      },
      409,
    );
  return c.json({ success: true });
});

router.post('/:id/stop', validateJson(RevisionSchema), async (c) => {
  const id = z.uuid().parse(c.req.param('id'));
  const { revision } = getValidatedJson<z.infer<typeof RevisionSchema>>(c);
  // UPDATE conflicts with the consumer's SHARE lock: after this commits,
  // no new delivery transaction can observe the campaign as published.
  const [row] = await db
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
    const [current] = await db
      .select({ status: systemMailCampaigns.status })
      .from(systemMailCampaigns)
      .where(eq(systemMailCampaigns.id, id));
    if (current?.status !== 'stopped')
      return c.json({ error: '发布记录已变化，请重新打开' }, 409);
  }
  return c.json({ success: true });
});

export default router;
