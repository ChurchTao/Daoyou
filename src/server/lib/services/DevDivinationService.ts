import { allowsLocalDevTools } from '@shared/config/deployment';
import { eq } from 'drizzle-orm';
import { db } from '../drizzle/db';
import { cultivators, dailyDivinations } from '../drizzle/schema';
import { redisLockKeys, withRedisLock } from '../redis/lock';
import { DivinationError } from './DivinationService';

export async function resetDevDivination(owner: string) {
  if (!allowsLocalDevTools(process.env.APP_ENV, process.env.NODE_ENV))
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
