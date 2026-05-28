import { getExecutor } from '@server/lib/drizzle/db';
import { mails } from '@server/lib/drizzle/schema';
import { requireUser } from '@server/lib/hono/middleware';
import type { AppEnv } from '@server/lib/hono/types';
import {
  getCultivatorsByUserId,
  hasDeadCultivator,
} from '@server/lib/services/cultivatorService';
import { getCultivatorDisplaySnapshot } from '@shared/engine/battle-v5/adapters/CultivatorDisplayAdapter';
import type { PlayerActiveResponse } from '@shared/contracts/player';
import { and, eq, sql } from 'drizzle-orm';
import { Hono } from 'hono';

const router = new Hono<AppEnv>();

router.get('/active', requireUser(), async (c) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ success: false, error: '未授权访问' }, 401);
  }

  const cultivators = await getCultivatorsByUserId(user.id);
  const hasDead = await hasDeadCultivator(user.id);
  const cultivatorViews = cultivators.map((cultivator) => ({
    cultivator,
    display: getCultivatorDisplaySnapshot(cultivator),
  }));
  const activeCultivator = cultivatorViews[0] ?? null;
  const activeCultivatorId = activeCultivator?.cultivator.id;

  let unreadMailCount = 0;
  if (activeCultivatorId) {
    const result = await getExecutor()
      .select({ count: sql<number>`count(*)` })
      .from(mails)
      .where(
        and(
          eq(mails.cultivatorId, activeCultivatorId),
          eq(mails.isRead, false),
        ),
      );

    unreadMailCount = Number(result[0]?.count ?? 0);
  }

  const payload: PlayerActiveResponse = {
    success: true,
    data: {
      activeCultivator,
      cultivators: cultivatorViews,
      unreadMailCount,
    },
    meta: {
      hasActive: cultivatorViews.length > 0,
      hasDead,
    },
  };

  return c.json(payload);
});

export default router;
