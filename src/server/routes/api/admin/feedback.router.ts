import { getExecutor } from '@server/lib/drizzle/db';
import { cultivators } from '@server/lib/drizzle/schema';
import {
  findFeedbackById,
  findFeedbacks,
  updateFeedbackStatus,
  type FeedbackStatus,
  type FeedbackType,
} from '@server/lib/repositories/feedbackRepository';
import { requireAdmin } from '@server/lib/hono/middleware';
import type { AppEnv } from '@server/lib/hono/types';
import { MailService } from '@server/lib/services/MailService';
import { and, eq, inArray } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';

const VALID_STATUSES: FeedbackStatus[] = [
  'pending',
  'processing',
  'resolved',
  'closed',
];

const VALID_TYPES: FeedbackType[] = ['bug', 'feature', 'balance', 'other'];

const STATUS_LABELS: Record<FeedbackStatus, string> = {
  pending: '待处理',
  processing: '处理中',
  resolved: '已解决',
  closed: '已关闭',
};

const TYPE_LABELS: Record<FeedbackType, string> = {
  bug: 'Bug 反馈',
  feature: '功能建议',
  balance: '游戏平衡',
  other: '其他意见',
};

const UpdateFeedbackStatusSchema = z.object({
  status: z.enum(['pending', 'processing', 'resolved', 'closed']),
  adminMessage: z.string().trim().max(1000).optional(),
});

function buildFeedbackStatusMailContent(params: {
  feedbackType: FeedbackType;
  status: FeedbackStatus;
  adminMessage?: string;
  feedbackContent: string;
}) {
  const summary =
    params.feedbackContent.length > 80
      ? `${params.feedbackContent.slice(0, 80)}...`
      : params.feedbackContent;

  const message = params.adminMessage?.trim();

  return [
    '你提交的反馈工单状态已更新。',
    '',
    `反馈类型：${TYPE_LABELS[params.feedbackType]}`,
    `当前状态：${STATUS_LABELS[params.status]}`,
    `反馈摘要：${summary}`,
    '',
    `管理员留言：${message || '感谢你的反馈，我们会持续跟进。'}`,
  ].join('\n');
}

const router = new Hono<AppEnv>();

router.get('/', requireAdmin(), async (c) => {
  const q = getExecutor();
  const page = Number.parseInt(c.req.query('page') ?? '1', 10);
  const limit = Number.parseInt(c.req.query('limit') ?? '20', 10);
  const status = c.req.query('status') as FeedbackStatus | undefined;
  const type = c.req.query('type') as FeedbackType | undefined;
  const search = c.req.query('search')?.trim() || undefined;

  const { feedbacks, total } = await findFeedbacks({
    status: status && VALID_STATUSES.includes(status) ? status : undefined,
    type: type && VALID_TYPES.includes(type) ? type : undefined,
    search,
    page,
    limit,
  });

  const cultivatorIds = Array.from(
    new Set(
      feedbacks
        .map((feedback) => feedback.cultivatorId)
        .filter((id): id is string => Boolean(id)),
    ),
  );

  const cultivatorMap = new Map<
    string,
    { name: string | null; realm: string | null }
  >();

  if (cultivatorIds.length > 0) {
    const cultivatorRows = await q
      .select({
        id: cultivators.id,
        name: cultivators.name,
        realm: cultivators.realm,
      })
      .from(cultivators)
      .where(inArray(cultivators.id, cultivatorIds));

    for (const row of cultivatorRows) {
      cultivatorMap.set(row.id, {
        name: row.name,
        realm: row.realm,
      });
    }
  }

  const enrichedFeedbacks = feedbacks.map((feedback) => {
    const cultivator = feedback.cultivatorId
      ? cultivatorMap.get(feedback.cultivatorId)
      : null;

    return {
      ...feedback,
      cultivatorName: cultivator?.name ?? null,
      cultivatorRealm: cultivator?.realm ?? null,
    };
  });

  return c.json({
    feedbacks: enrichedFeedbacks,
    total,
    page,
    limit,
  });
});

router.patch('/:id/status', requireAdmin(), async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => null);
  const parsed = UpdateFeedbackStatusSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      {
        success: false,
        error: parsed.error.issues[0]?.message ?? '参数错误',
      },
      400,
    );
  }

  const { status, adminMessage } = parsed.data;
  const existing = await findFeedbackById(id);

  if (!existing) {
    return c.json({ success: false, error: '反馈不存在' }, 404);
  }

  const hasStatusChanged = existing.status !== status;
  const updated = await updateFeedbackStatus(id, status);

  if (!updated) {
    return c.json({ success: false, error: '更新失败' }, 500);
  }

  let notifiedUser = false;
  if (hasStatusChanged) {
    const q = getExecutor();
    const fallbackCultivator = existing.cultivatorId
      ? null
      : await q.query.cultivators.findFirst({
          where: and(
            eq(cultivators.userId, existing.userId),
            eq(cultivators.status, 'active'),
          ),
          columns: { id: true },
        });

    const recipientCultivatorId =
      existing.cultivatorId ?? fallbackCultivator?.id;

    if (recipientCultivatorId) {
      await MailService.sendMail(
        recipientCultivatorId,
        '反馈工单状态更新',
        buildFeedbackStatusMailContent({
          feedbackType: existing.type as FeedbackType,
          status,
          adminMessage,
          feedbackContent: existing.content,
        }),
        [],
      );
      notifiedUser = true;
    } else {
      console.warn(
        `Feedback ${id} status updated but no cultivator found for user ${existing.userId}`,
      );
    }
  }

  return c.json({
    success: true,
    feedback: updated,
    statusChanged: hasStatusChanged,
    notifiedUser,
  });
});

export default router;
