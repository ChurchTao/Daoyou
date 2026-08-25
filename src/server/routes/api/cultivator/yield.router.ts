import {
  redisLockErrorResponse,
  requireActiveCultivatorRef,
} from '@server/lib/hono/middleware';
import { streamSseEvents } from '@server/lib/hono/streaming';
import type { AppEnv } from '@server/lib/hono/types';
import {
  executeYieldCommand,
  YieldCommandError,
} from '@server/lib/services/YieldApplicationService';
import { getGameConceptLabel } from '@shared/lib/gameConceptDisplay';
import { Hono } from 'hono';

const yieldRouter = new Hono<AppEnv>();

yieldRouter.post('/', requireActiveCultivatorRef(), async (c) => {
  const user = c.get('user');
  const activeCultivator = c.get('activeCultivatorRef');
  if (!user || !activeCultivator) {
    return c.json({ success: false, error: '未授权访问' }, 401);
  }

  try {
    const { committed, result } = await executeYieldCommand({
      userId: user.id,
      cultivatorId: activeCultivator.cultivatorId,
    });
    return streamSseEvents(c, async (stream) => {
      await stream.writeSSE({
        data: JSON.stringify({ type: 'result', data: committed.result }),
      });
      if (committed.state.changes.length > 0) {
        await stream.writeSSE({
          data: JSON.stringify({ type: 'state', state: committed.state }),
        });
      }

      const hours = Math.max(1, Math.floor(result.hours));
      const gains = [
        `${result.amount} 灵石`,
        result.expGain ? `${result.expGain} 点修为` : '',
        result.insightGain
          ? `${result.insightGain} 点${getGameConceptLabel('comprehension_insight')}`
          : '',
      ]
        .filter(Boolean)
        .join('、');
      await stream.writeSSE({
        data: JSON.stringify({
          type: 'chunk',
          text: `${result.cultivatorName}结束了约${hours}小时的外出历练，平安归来，共带回${gains}。`,
        }),
      });
    });
  } catch (error) {
    const lockErrorResponse = redisLockErrorResponse(error);
    if (lockErrorResponse) return lockErrorResponse;
    if (error instanceof YieldCommandError) {
      return c.json({ success: false, error: error.message }, error.status);
    }
    throw error;
  }
});

export default yieldRouter;
