import { getExecutor } from '@server/lib/drizzle/db';
import { cultivators } from '@server/lib/drizzle/schema';
import {
  requireUser,
  validateJson,
  getValidatedJson,
} from '@server/lib/hono/middleware';
import type { AppEnv } from '@server/lib/hono/types';
import { createFeedback } from '@server/lib/repositories/feedbackRepository';
import { FeedbackCreateRequestSchema } from '@shared/contracts/feedback';
import { and, eq } from 'drizzle-orm';
import { Hono } from 'hono';

const router = new Hono<AppEnv>();

router.post('/', requireUser(), validateJson(FeedbackCreateRequestSchema), async (c) => {
  try {
    const user = c.get('user');
    if (!user) {
      return c.json({ success: false, error: '未授权访问' }, 401);
    }

    const q = getExecutor();
    const { type, content } = getValidatedJson<{
      type: 'bug' | 'feature' | 'balance' | 'other';
      content: string;
    }>(c);

    const activeCultivator = await q.query.cultivators.findFirst({
      where: and(eq(cultivators.userId, user.id), eq(cultivators.status, 'active')),
    });

    const feedback = await createFeedback({
      userId: user.id,
      cultivatorId: activeCultivator?.id ?? null,
      type,
      content,
    });

    return c.json({
      success: true,
      data: {
        feedbackId: feedback.id,
      },
    });
  } catch (error) {
    console.error('Create feedback error:', error);
    return c.json({ success: false, error: '提交反馈失败，请稍后重试' }, 500);
  }
});

export default router;
