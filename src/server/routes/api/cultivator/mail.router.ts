import { getExecutor, type DbExecutor, type DbTransaction } from '@server/lib/drizzle/db';
import { mails } from '@server/lib/drizzle/schema';
import {
  redisLockErrorResponse,
  requireActiveCultivatorRef,
} from '@server/lib/hono/middleware';
import { jsonWithStatus } from '@server/lib/hono/response';
import type { AppEnv } from '@server/lib/hono/types';
import {
  claimAllCultivatorMail,
  claimCultivatorMail,
  markAllCultivatorMailRead,
  markCultivatorMailRead,
  PlayerMailCommandError,
  sendCultivatorMail,
} from '@server/lib/services/PlayerMailApplicationService';
import { PlayerMailServiceError } from '@server/lib/services/PlayerMailService';
import { toPlayerStateMutationResponse } from '@server/lib/services/ResourceMutationResponse';
import { MAX_PLAYER_ITEM_QUANTITY } from '@shared/config/itemQuantity';
import { and, desc, eq, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';

const MailIdSchema = z.object({ mailId: z.string() });
const SendMailSchema = z.object({
  recipientCultivatorId: z.string().uuid(),
  content: z.string().trim().min(1).max(1000),
  attachment: z
    .object({
      itemType: z.enum(['material', 'artifact', 'consumable']),
      itemId: z.string().uuid(),
      quantity: z
        .number()
        .int()
        .min(1)
        .max(MAX_PLAYER_ITEM_QUANTITY)
        .default(1),
    })
    .optional(),
});

async function countUnreadMail(
  cultivatorId: string,
  q: DbExecutor | DbTransaction = getExecutor(),
): Promise<number> {
  const [result] = await q
    .select({ count: sql<number>`count(*)::int` })
    .from(mails)
    .where(and(eq(mails.cultivatorId, cultivatorId), eq(mails.isRead, false)));
  return Number(result?.count ?? 0);
}

const mailRouter = new Hono<AppEnv>();

mailRouter.get('/', requireActiveCultivatorRef(), async (c) => {
  const ref = c.get('activeCultivatorRef');
  if (!ref) return c.json({ error: '当前没有活跃角色' }, 404);
  const pageRaw = parseInt(c.req.query('page') || '1', 10);
  const pageSizeRaw = parseInt(c.req.query('pageSize') || '20', 10);
  const page = Number.isNaN(pageRaw) ? 1 : Math.max(1, pageRaw);
  const pageSize = Number.isNaN(pageSizeRaw)
    ? 20
    : Math.min(100, Math.max(1, pageSizeRaw));
  const userMails = await getExecutor().query.mails.findMany({
    where: eq(mails.cultivatorId, ref.cultivatorId),
    orderBy: [desc(mails.createdAt)],
    limit: pageSize + 1,
    offset: (page - 1) * pageSize,
  });
  const hasMore = userMails.length > pageSize;
  return c.json({
    mails: hasMore ? userMails.slice(0, pageSize) : userMails,
    pagination: { page, pageSize, hasMore },
  });
});

mailRouter.post('/send', requireActiveCultivatorRef(), async (c) => {
  const user = c.get('user');
  const cultivator = c.get('activeCultivatorRef');
  if (!user || !cultivator) return c.json({ error: '未授权访问' }, 401);
  try {
    const parsed = SendMailSchema.parse(await c.req.json());
    const committed = await sendCultivatorMail({
      actor: {
        userId: user.id,
        cultivatorId: cultivator.cultivatorId,
      },
      recipientCultivatorId: parsed.recipientCultivatorId,
      content: parsed.content,
      attachment: parsed.attachment,
    });
    return c.json(toPlayerStateMutationResponse(committed));
  } catch (error) {
    const lockErrorResponse = redisLockErrorResponse(error);
    if (lockErrorResponse) return lockErrorResponse;
    if (error instanceof z.ZodError) {
      return c.json({ error: '参数错误', details: error.issues }, 400);
    }
    if (error instanceof PlayerMailServiceError) {
      return jsonWithStatus(c, { error: error.message }, error.status);
    }
    console.error('mail send api error:', error);
    return c.json({ error: '发送传音失败' }, 500);
  }
});

mailRouter.post('/claim', requireActiveCultivatorRef(), async (c) => {
  const user = c.get('user');
  const cultivator = c.get('activeCultivatorRef');
  if (!user || !cultivator) return c.json({ error: '未授权访问' }, 401);
  const { mailId } = MailIdSchema.parse(await c.req.json());
  try {
    const committed = await claimCultivatorMail({
      actor: {
        userId: user.id,
        cultivatorId: cultivator.cultivatorId,
      },
      mailId,
    });
    return c.json(toPlayerStateMutationResponse(committed));
  } catch (error) {
    const lockErrorResponse = redisLockErrorResponse(error);
    if (lockErrorResponse) return lockErrorResponse;
    if (error instanceof PlayerMailCommandError) {
      return c.json({ error: error.message }, error.status);
    }
    throw error;
  }
});

mailRouter.post('/claim-all', requireActiveCultivatorRef(), async (c) => {
  const user = c.get('user');
  const cultivator = c.get('activeCultivatorRef');
  if (!user || !cultivator) return c.json({ error: '未授权访问' }, 401);
  try {
    const committed = await claimAllCultivatorMail({
      actor: {
        userId: user.id,
        cultivatorId: cultivator.cultivatorId,
      },
    });
    return c.json(toPlayerStateMutationResponse(committed));
  } catch (error) {
    const lockErrorResponse = redisLockErrorResponse(error);
    if (lockErrorResponse) return lockErrorResponse;
    throw error;
  }
});

mailRouter.post('/read', requireActiveCultivatorRef(), async (c) => {
  const user = c.get('user');
  const cultivator = c.get('activeCultivatorRef');
  if (!user || !cultivator) return c.json({ error: '未授权访问' }, 401);
  const { mailId } = MailIdSchema.parse(await c.req.json());
  try {
    const committed = await markCultivatorMailRead({
      actor: {
        userId: user.id,
        cultivatorId: cultivator.cultivatorId,
      },
      mailId,
    });
    return c.json(toPlayerStateMutationResponse(committed));
  } catch (error) {
    if (error instanceof PlayerMailCommandError) {
      return c.json({ error: error.message }, error.status);
    }
    throw error;
  }
});

mailRouter.post('/read-all', requireActiveCultivatorRef(), async (c) => {
  const user = c.get('user');
  const cultivator = c.get('activeCultivatorRef');
  if (!user || !cultivator) return c.json({ error: '未授权访问' }, 401);
  const committed = await markAllCultivatorMailRead({
    actor: {
      userId: user.id,
      cultivatorId: cultivator.cultivatorId,
    },
  });
  return c.json(toPlayerStateMutationResponse(committed));
});

mailRouter.get('/unread-count', requireActiveCultivatorRef(), async (c) => {
  const ref = c.get('activeCultivatorRef');
  if (!ref) return c.json({ error: '当前没有活跃角色' }, 404);
  return c.json({ count: await countUnreadMail(ref.cultivatorId) });
});

export default mailRouter;
