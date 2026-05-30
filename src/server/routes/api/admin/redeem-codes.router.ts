import { getExecutor } from '@server/lib/drizzle/db';
import { redeemCodes } from '@server/lib/drizzle/schema';
import { getRewardCatalog } from '@server/lib/repositories/rewardCatalogRepository';
import {
  generateRedeemCode,
  isValidRedeemCodeFormat,
  normalizeRedeemCode,
} from '@server/lib/redeem/code';
import { describeRedeemCodeReward } from '@server/lib/redeem/reward';
import { requireAdmin } from '@server/lib/hono/middleware';
import type { AppEnv } from '@server/lib/hono/types';
import type { MailAttachment } from '@shared/types/mail';
import {
  RewardCatalogResolveError,
  RewardSelectionsSchema,
} from '@shared/lib/rewardCatalog';
import { resolveRewardSelections } from '@shared/lib/rewardCatalog';
import { and, desc, eq, type SQL } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';

const SNAPSHOT_REWARD_PRESET_ID = '__reward_catalog_snapshot__';

const CreateRedeemCodeSchema = z
  .object({
    code: z.string().trim().max(64).optional(),
    rewardSelections: RewardSelectionsSchema.min(1, '至少选择一项奖励'),
    mailTitle: z.string().trim().min(1).max(200),
    mailContent: z.string().trim().min(1).max(10000),
    totalLimit: z.number().int().min(1).max(100000000).nullable().optional(),
    startsAt: z.string().trim().optional(),
    endsAt: z.string().trim().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.startsAt && Number.isNaN(new Date(value.startsAt).getTime())) {
      ctx.addIssue({
        code: 'custom',
        path: ['startsAt'],
        message: '开始时间格式错误',
      });
    }
    if (value.endsAt && Number.isNaN(new Date(value.endsAt).getTime())) {
      ctx.addIssue({
        code: 'custom',
        path: ['endsAt'],
        message: '结束时间格式错误',
      });
    }
    if (value.startsAt && value.endsAt) {
      const startsAt = new Date(value.startsAt).getTime();
      const endsAt = new Date(value.endsAt).getTime();
      if (!Number.isNaN(startsAt) && !Number.isNaN(endsAt) && startsAt > endsAt) {
        ctx.addIssue({
          code: 'custom',
          path: ['endsAt'],
          message: '结束时间必须晚于开始时间',
        });
      }
    }
  });

function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const maybe = error as { code?: string };
  return maybe.code === '23505';
}

async function createWithAutoCode(params: {
  rewardAttachments: MailAttachment[];
  mailTitle: string;
  mailContent: string;
  totalLimit: number | null;
  startsAt: Date | null;
  endsAt: Date | null;
  userId: string;
}) {
  const q = getExecutor();

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = generateRedeemCode();
    try {
      const [inserted] = await q
        .insert(redeemCodes)
        .values({
          code,
          rewardPresetId: SNAPSHOT_REWARD_PRESET_ID,
          rewardAttachments: params.rewardAttachments,
          mailTitle: params.mailTitle,
          mailContent: params.mailContent,
          totalLimit: params.totalLimit,
          startsAt: params.startsAt,
          endsAt: params.endsAt,
          status: 'active',
          createdBy: params.userId,
          updatedBy: params.userId,
        })
        .returning();
      return inserted;
    } catch (error) {
      if (isUniqueViolation(error)) continue;
      throw error;
    }
  }

  throw new Error('自动生成兑换码失败，请重试');
}

const router = new Hono<AppEnv>();

router.get('/', requireAdmin(), async (c) => {
  const q = getExecutor();
  const status = c.req.query('status');
  const whereConditions: SQL<unknown>[] = [];

  if (status === 'active' || status === 'disabled') {
    whereConditions.push(eq(redeemCodes.status, status));
  }

  const items = await q.query.redeemCodes.findMany({
    where: whereConditions.length > 0 ? and(...whereConditions) : undefined,
    orderBy: [desc(redeemCodes.createdAt)],
  });

  const rows = items.map((item) => {
    const hasRewardAttachments =
      item.rewardAttachments !== null && item.rewardAttachments !== undefined;
    let rewardSummary: string[];
    let rewardSource: 'snapshot' | 'expired_legacy' | 'broken_snapshot';

    if (hasRewardAttachments) {
      try {
        rewardSummary = describeRedeemCodeReward(item);
        rewardSource = 'snapshot';
      } catch {
        rewardSummary = ['奖励配置异常'];
        rewardSource = 'broken_snapshot';
      }
    } else if (item.rewardPresetId === SNAPSHOT_REWARD_PRESET_ID) {
      rewardSummary = ['奖励快照异常'];
      rewardSource = 'broken_snapshot';
    } else {
      rewardSummary = ['旧版兑换码（已失效）'];
      rewardSource = 'expired_legacy';
    }

    return {
      ...item,
      rewardSummary,
      rewardSource,
    };
  });

  return c.json({ redeemCodes: rows });
});

router.post('/', requireAdmin(), async (c) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ error: '未授权访问' }, 401);
  }

  const q = getExecutor();
  const body = await c.req.json().catch(() => null);
  const parsed = CreateRedeemCodeSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      { error: '参数错误', details: parsed.error.flatten() },
      400,
    );
  }

  const startsAt = parsed.data.startsAt ? new Date(parsed.data.startsAt) : null;
  const endsAt = parsed.data.endsAt ? new Date(parsed.data.endsAt) : null;
  const totalLimit = parsed.data.totalLimit ?? null;
  const manualCode = parsed.data.code
    ? normalizeRedeemCode(parsed.data.code)
    : '';
  let rewardAttachments: MailAttachment[] = [];

  try {
    const rewardCatalog = await getRewardCatalog();
    rewardAttachments = resolveRewardSelections(
      parsed.data.rewardSelections,
      rewardCatalog,
    );
  } catch (error) {
    if (error instanceof RewardCatalogResolveError) {
      return c.json({ error: error.message }, 400);
    }

    return c.json(
      {
        error:
          error instanceof Error ? error.message : '奖励目录加载失败',
      },
      500,
    );
  }

  try {
    if (manualCode) {
      if (!isValidRedeemCodeFormat(manualCode)) {
        return c.json(
          { error: '兑换码格式错误，仅支持 6-64 位大写字母数字' },
          400,
        );
      }

      const [inserted] = await q
        .insert(redeemCodes)
        .values({
          code: manualCode,
          rewardPresetId: SNAPSHOT_REWARD_PRESET_ID,
          rewardAttachments,
          mailTitle: parsed.data.mailTitle,
          mailContent: parsed.data.mailContent,
          totalLimit,
          startsAt,
          endsAt,
          status: 'active',
          createdBy: user.id,
          updatedBy: user.id,
        })
        .returning();

      return c.json({ success: true, redeemCode: inserted });
    }

    const inserted = await createWithAutoCode({
      rewardAttachments,
      mailTitle: parsed.data.mailTitle,
      mailContent: parsed.data.mailContent,
      totalLimit,
      startsAt,
      endsAt,
      userId: user.id,
    });

    return c.json({ success: true, redeemCode: inserted });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return c.json({ error: '兑换码已存在' }, 409);
    }

    console.error('Create redeem code error:', error);
    return c.json({ error: '创建兑换码失败' }, 500);
  }
});

router.post('/:id/toggle', requireAdmin(), async (c) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ error: '未授权访问' }, 401);
  }

  const q = getExecutor();
  const id = c.req.param('id');
  const item = await q.query.redeemCodes.findFirst({
    where: eq(redeemCodes.id, id),
  });

  if (!item) {
    return c.json({ error: '兑换码不存在' }, 404);
  }

  const nextStatus = item.status === 'active' ? 'disabled' : 'active';
  const [updated] = await q
    .update(redeemCodes)
    .set({
      status: nextStatus,
      updatedBy: user.id,
    })
    .where(eq(redeemCodes.id, item.id))
    .returning();

  return c.json({ success: true, redeemCode: updated });
});

export default router;
