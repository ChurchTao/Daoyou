import { withAdminAuth } from '@/lib/api/adminAuth';
import { db } from '@/lib/drizzle/db';
import { cultivators } from '@/lib/drizzle/schema';
import {
  findFeedbacks,
  type FeedbackStatus,
  type FeedbackType,
} from '@/lib/repositories/feedbackRepository';
import { eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/admin/feedback
 * 获取反馈列表（分页 + 筛选）
 */
export const GET = withAdminAuth(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = parseInt(searchParams.get('limit') || '20', 10);
  const status = searchParams.get('status') as FeedbackStatus | null;
  const type = searchParams.get('type') as FeedbackType | null;
  const search = searchParams.get('search')?.trim() || undefined;

  const validStatuses: FeedbackStatus[] = [
    'pending',
    'processing',
    'resolved',
    'closed',
  ];
  const validTypes: FeedbackType[] = ['bug', 'feature', 'balance', 'other'];

  const { feedbacks, total } = await findFeedbacks({
    status: status && validStatuses.includes(status) ? status : undefined,
    type: type && validTypes.includes(type) ? type : undefined,
    search,
    page,
    limit,
  });

  // 获取关联的用户和角色信息
  const enrichFeedbacks = await Promise.all(
    feedbacks.map(async (feedback) => {
      let userEmail: string | null = null;
      let cultivatorName: string | null = null;
      let cultivatorRealm: string | null = null;

      // 获取用户邮箱
      try {
        const { createClient } = await import('@/lib/supabase/server');
        const supabase = await createClient();
        const { data } = await supabase.auth.admin.getUserById(feedback.userId);
        userEmail = data.user?.email || null;
      } catch {
        // ignore
      }

      // 获取角色信息
      if (feedback.cultivatorId) {
        const cultivator = await db().query.cultivators.findFirst({
          where: eq(cultivators.id, feedback.cultivatorId),
          columns: { name: true, realm: true },
        });
        if (cultivator) {
          cultivatorName = cultivator.name;
          cultivatorRealm = cultivator.realm;
        }
      }

      return {
        ...feedback,
        userEmail,
        cultivatorName,
        cultivatorRealm,
      };
    }),
  );

  return NextResponse.json({
    feedbacks: enrichFeedbacks,
    total,
    page,
    limit,
  });
});
