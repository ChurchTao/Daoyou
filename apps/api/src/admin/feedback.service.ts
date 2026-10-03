import { HttpException, Inject, Injectable } from '@nestjs/common';
import { DRIZZLE_DATABASE } from '@server/database/database.service.js';
import type { DbClient } from '@server/lib/drizzle/db.js';
import { cultivators } from '@server/lib/drizzle/schema.js';
import {
  findFeedbackById,
  findFeedbacks,
  updateFeedbackStatus,
  type FeedbackStatus,
  type FeedbackType,
} from '@server/lib/repositories/feedbackRepository.js';
import { MailService } from '@server/mail/application/MailService.js';
import { updateSpiritStones } from '@server/cultivator/application/readers/CultivatorStateRepository.js';
import { and, eq, inArray } from 'drizzle-orm';
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

const FEEDBACK_RESOLVE_REWARD = 8000;

function buildFeedbackStatusMailContent(params: {
  feedbackType: FeedbackType;
  status: FeedbackStatus;
  adminMessage?: string;
  feedbackContent: string;
}) {
  const message = params.adminMessage?.trim();

  const lines = [
    '你提交的反馈工单状态已更新。',
    '',
    `反馈类型：${TYPE_LABELS[params.feedbackType]}`,
    `当前状态：${STATUS_LABELS[params.status]}`,
    '',
    '── 你的反馈内容 ──',
    params.feedbackContent,
    '──────────────',
    '',
    `管理员留言：${message || '感谢你的反馈，我们会持续跟进。'}`,
  ];

  if (params.status === 'resolved') {
    lines.push(
      '',
      `奖励发放：你的问题已解决，特发放 ${FEEDBACK_RESOLVE_REWARD} 灵石作为奖励。`,
    );
  }

  return lines.join('\n');
}

@Injectable()
export class AdminFeedbackService {
  constructor(@Inject(DRIZZLE_DATABASE) private readonly database: DbClient) {}

  async list(query: Record<string, string | undefined>) {
    const q = this.database;
    const page = Number.parseInt(query.page ?? '1', 10);
    const limit = Number.parseInt(query.limit ?? '20', 10);
    const status = query.status as FeedbackStatus | undefined;
    const type = query.type as FeedbackType | undefined;
    const search = query.search?.trim() || undefined;

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

    return {
      feedbacks: enrichedFeedbacks,
      total,
      page,
      limit,
    };
  }

  async update(id: string, input: unknown) {
    const body = input;
    const parsed = UpdateFeedbackStatusSchema.safeParse(body);

    if (!parsed.success) {
      throw new HttpException(
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
      throw new HttpException({ success: false, error: '反馈不存在' }, 404);
    }

    const hasStatusChanged = existing.status !== status;
    const updated = await updateFeedbackStatus(id, status);

    if (!updated) {
      throw new HttpException({ success: false, error: '更新失败' }, 500);
    }

    let notifiedUser = false;
    let rewardGranted = false;
    if (hasStatusChanged) {
      const q = this.database;
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
        // 发放奖励：仅当状态变为 resolved 时固定发放 8000 灵石
        if (status === 'resolved') {
          try {
            await updateSpiritStones(
              existing.userId,
              recipientCultivatorId,
              FEEDBACK_RESOLVE_REWARD,
            );
            rewardGranted = true;
          } catch (err) {
            console.warn(
              `Failed to grant feedback reward for feedback ${id}: ${err instanceof Error ? err.message : String(err)}`,
            );
          }
        }

        await MailService.sendNewRewardMail(
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

    return {
      success: true,
      feedback: updated,
      statusChanged: hasStatusChanged,
      notifiedUser,
      rewardGranted,
    };
  }
}
