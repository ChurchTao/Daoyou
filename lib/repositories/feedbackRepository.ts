import { and, desc, eq, ilike, sql, type SQL } from 'drizzle-orm';
import { db } from '../drizzle/db';
import * as schema from '../drizzle/schema';

/**
 * 反馈类型
 */
export type FeedbackType = 'bug' | 'feature' | 'balance' | 'other';

/**
 * 反馈状态
 */
export type FeedbackStatus = 'pending' | 'processing' | 'resolved' | 'closed';

/**
 * 反馈记录
 */
export type Feedback = typeof schema.feedbacks.$inferSelect;

/**
 * 创建反馈记录
 */
export async function createFeedback(data: {
  userId: string;
  cultivatorId?: string | null;
  type: FeedbackType;
  content: string;
}): Promise<Feedback> {
  const [feedback] = await db
    .insert(schema.feedbacks)
    .values({
      userId: data.userId,
      cultivatorId: data.cultivatorId ?? null,
      type: data.type,
      content: data.content,
      status: 'pending',
    })
    .returning();
  return feedback;
}

/**
 * 查询单个反馈记录
 */
export async function findFeedbackById(id: string): Promise<Feedback | null> {
  const [feedback] = await db
    .select()
    .from(schema.feedbacks)
    .where(eq(schema.feedbacks.id, id))
    .limit(1);
  return feedback || null;
}

/**
 * 查询用户的反馈列表
 */
export async function findFeedbacksByUserId(
  userId: string,
  options: { page?: number; limit?: number } = {},
): Promise<{ feedbacks: Feedback[]; total: number }> {
  const { page = 1, limit = 20 } = options;

  const whereClause = eq(schema.feedbacks.userId, userId);

  const [feedbacksResult, countResult] = await Promise.all([
    db
      .select()
      .from(schema.feedbacks)
      .where(whereClause)
      .orderBy(desc(schema.feedbacks.createdAt))
      .limit(limit)
      .offset((page - 1) * limit),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.feedbacks)
      .where(whereClause),
  ]);

  return {
    feedbacks: feedbacksResult,
    total: countResult[0]?.count || 0,
  };
}

/**
 * 管理端查询反馈列表
 */
export interface FindFeedbacksOptions {
  status?: FeedbackStatus;
  type?: FeedbackType;
  search?: string;
  page?: number;
  limit?: number;
}

export async function findFeedbacks(
  options: FindFeedbacksOptions = {},
): Promise<{ feedbacks: Feedback[]; total: number }> {
  const { status, type, search, page = 1, limit = 20 } = options;

  // 构建筛选条件
  const conditions: SQL<unknown>[] = [];

  if (status) {
    conditions.push(eq(schema.feedbacks.status, status));
  }
  if (type) {
    conditions.push(eq(schema.feedbacks.type, type));
  }
  if (search) {
    conditions.push(ilike(schema.feedbacks.content, `%${search}%`));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [feedbacksResult, countResult] = await Promise.all([
    db
      .select()
      .from(schema.feedbacks)
      .where(whereClause)
      .orderBy(desc(schema.feedbacks.createdAt))
      .limit(limit)
      .offset((page - 1) * limit),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.feedbacks)
      .where(whereClause),
  ]);

  return {
    feedbacks: feedbacksResult,
    total: countResult[0]?.count || 0,
  };
}

/**
 * 更新反馈状态
 */
export async function updateFeedbackStatus(
  id: string,
  status: FeedbackStatus,
): Promise<Feedback | null> {
  const [feedback] = await db
    .update(schema.feedbacks)
    .set({ status })
    .where(eq(schema.feedbacks.id, id))
    .returning();
  return feedback || null;
}
