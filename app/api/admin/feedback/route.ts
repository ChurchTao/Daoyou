import { withAdminAuth } from '@/lib/api/adminAuth';
import { getExecutor } from '@/lib/drizzle/db';
import { cultivators } from '@/lib/drizzle/schema';
import {
  findFeedbacks,
  type FeedbackStatus,
  type FeedbackType,
} from '@/lib/repositories/feedbackRepository';
import { inArray } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/admin/feedback
 * 获取反馈列表（分页 + 筛选）
 */
export const GET = withAdminAuth(async (request: NextRequest) => {
  const q = getExecutor();
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

  // 批量获取关联角色信息，避免循环单次查询
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

  const enrichFeedbacks: Array<
    (typeof feedbacks)[number] & {
      cultivatorName: string | null;
      cultivatorRealm: string | null;
    }
  > = feedbacks.map((feedback) => {
    const cultivator = feedback.cultivatorId
      ? cultivatorMap.get(feedback.cultivatorId)
      : null;

    return {
      ...feedback,
      cultivatorName: cultivator?.name ?? null,
      cultivatorRealm: cultivator?.realm ?? null,
    };
  });

  return NextResponse.json({
    feedbacks: enrichFeedbacks,
    total,
    page,
    limit,
  });
});
