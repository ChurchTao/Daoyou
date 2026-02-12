import { withAdminAuth } from '@/lib/api/adminAuth';
import { getExecutor } from '@/lib/drizzle/db';
import { cultivators } from '@/lib/drizzle/schema';
import {
  findFeedbackById,
  updateFeedbackStatus,
  type FeedbackStatus,
  type FeedbackType,
} from '@/lib/repositories/feedbackRepository';
import { MailService } from '@/lib/services/MailService';
import { and, eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';

const VALID_STATUSES: FeedbackStatus[] = [
  'pending',
  'processing',
  'resolved',
  'closed',
];

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

/**
 * PATCH /api/admin/feedback/[id]/status
 * 更新反馈状态
 */
export const PATCH = withAdminAuth<{ id: string }>(
  async (request: NextRequest, _context, params) => {
    const { id } = params;

    if (!id) {
      return NextResponse.json(
        { success: false, error: '缺少反馈 ID' },
        { status: 400 },
      );
    }

    try {
      const body = await request.json();
      const { status } = body;
      const adminMessage =
        typeof body.adminMessage === 'string' ? body.adminMessage.trim() : '';

      if (!status || !VALID_STATUSES.includes(status)) {
        return NextResponse.json(
          { success: false, error: '无效的状态值' },
          { status: 400 },
        );
      }

      if (adminMessage.length > 1000) {
        return NextResponse.json(
          { success: false, error: '管理员留言过长（最多 1000 字）' },
          { status: 400 },
        );
      }

      // 检查反馈是否存在
      const existing = await findFeedbackById(id);
      if (!existing) {
        return NextResponse.json(
          { success: false, error: '反馈不存在' },
          { status: 404 },
        );
      }

      const hasStatusChanged = existing.status !== status;

      // 更新状态
      const updated = await updateFeedbackStatus(id, status);
      if (!updated) {
        return NextResponse.json(
          { success: false, error: '更新失败' },
          { status: 500 },
        );
      }

      // 状态变更后，给反馈提交者发送游戏内邮件通知
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
          await MailService.sendSystemMail(
            recipientCultivatorId,
            '反馈工单状态更新',
            buildFeedbackStatusMailContent({
              feedbackType: existing.type as FeedbackType,
              status,
              adminMessage,
              feedbackContent: existing.content,
            }),
          );
          notifiedUser = true;
        } else {
          console.warn(
            `Feedback ${id} status updated but no cultivator found for user ${existing.userId}`,
          );
        }
      }

      return NextResponse.json({
        success: true,
        feedback: updated,
        statusChanged: hasStatusChanged,
        notifiedUser,
      });
    } catch (error) {
      console.error('Update feedback status error:', error);
      return NextResponse.json(
        { success: false, error: '更新失败，请稍后重试' },
        { status: 500 },
      );
    }
  },
);
