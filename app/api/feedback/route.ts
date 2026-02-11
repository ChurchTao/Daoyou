import { withAuth } from '@/lib/api/withAuth';
import { db } from '@/lib/drizzle/db';
import { cultivators } from '@/lib/drizzle/schema';
import {
  createFeedback,
  type FeedbackType,
} from '@/lib/repositories/feedbackRepository';
import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

/**
 * POST /api/feedback
 * 创建反馈
 */
export const POST = withAuth(async (req, { user }) => {
  try {
    const body = await req.json();
    const { type, content } = body;

    // 验证类型
    const validTypes: FeedbackType[] = ['bug', 'feature', 'balance', 'other'];
    if (!type || !validTypes.includes(type)) {
      return NextResponse.json(
        { success: false, error: '请选择有效的反馈类型' },
        { status: 400 },
      );
    }

    // 验证内容
    if (!content || typeof content !== 'string') {
      return NextResponse.json(
        { success: false, error: '请填写反馈内容' },
        { status: 400 },
      );
    }

    const trimmedContent = content.trim();
    if (trimmedContent.length < 10) {
      return NextResponse.json(
        { success: false, error: '反馈内容至少需要 10 个字' },
        { status: 400 },
      );
    }

    // 获取用户当前活跃角色（如果有）
    const activeCultivator = await db().query.cultivators.findFirst({
      where: and(
        eq(cultivators.userId, user.id),
        eq(cultivators.status, 'active'),
      ),
    });

    // 创建反馈
    const feedback = await createFeedback({
      userId: user.id,
      cultivatorId: activeCultivator?.id ?? null,
      type,
      content: trimmedContent,
    });

    return NextResponse.json({
      success: true,
      feedbackId: feedback.id,
    });
  } catch (error) {
    console.error('Create feedback error:', error);
    return NextResponse.json(
      { success: false, error: '提交反馈失败，请稍后重试' },
      { status: 500 },
    );
  }
});
