import { withAdminAuth } from '@/lib/api/adminAuth';
import {
  findFeedbackById,
  updateFeedbackStatus,
  type FeedbackStatus,
} from '@/lib/repositories/feedbackRepository';
import { NextRequest, NextResponse } from 'next/server';

const VALID_STATUSES: FeedbackStatus[] = [
  'pending',
  'processing',
  'resolved',
  'closed',
];

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

      if (!status || !VALID_STATUSES.includes(status)) {
        return NextResponse.json(
          { success: false, error: '无效的状态值' },
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

      // 更新状态
      const updated = await updateFeedbackStatus(id, status);
      if (!updated) {
        return NextResponse.json(
          { success: false, error: '更新失败' },
          { status: 500 },
        );
      }

      return NextResponse.json({ success: true, feedback: updated });
    } catch (error) {
      console.error('Update feedback status error:', error);
      return NextResponse.json(
        { success: false, error: '更新失败，请稍后重试' },
        { status: 500 },
      );
    }
  },
);
