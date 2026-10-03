import { getRuntimeEnvironment } from '@server/lib/config/environment.js';
import { allowsLocalDevTools } from '@daoyou/shared/config/deployment';
import { eq } from 'drizzle-orm';
import { db } from '@server/lib/drizzle/db.js';
import { cultivators, dailyDivinations } from '@server/lib/drizzle/schema.js';
import { redisLockKeys, withRedisLock } from '@server/lib/redis/lock.js';
import { DivinationError } from '@server/divination/application/DivinationService.js';

export async function resetDevDivination(owner: string) {
  if (!allowsLocalDevTools(getRuntimeEnvironment().APP_ENV, getRuntimeEnvironment().NODE_ENV))
    throw new DivinationError('仅允许纯本地环境使用');
  return withRedisLock(
    {
      key: redisLockKeys.divination(owner),
      context: 'dev-divination-reset',
      timeoutMs: 30_000,
      retries: 0,
    },
    async (lease) =>
      db.transaction(async (tx) => {
        const [actor] = await tx
          .select({ status: cultivators.status })
          .from(cultivators)
          .where(eq(cultivators.id, owner))
          .for('update');
        if (!actor || actor.status !== 'active')
          throw new DivinationError('活跃角色不存在', 404);
        const removed = await tx
          .delete(dailyDivinations)
          .where(eq(dailyDivinations.cultivatorId, owner))
          .returning({ drawId: dailyDivinations.drawId });
        lease.assertHeld();
        return { data: { removed: removed.length } };
      }),
  );
}
