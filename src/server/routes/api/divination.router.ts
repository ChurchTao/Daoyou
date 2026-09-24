import {
  redisLockErrorResponse,
  requireActiveCultivatorRef,
  validateJson,
} from '@server/lib/hono/middleware';
import { streamSseEvents } from '@server/lib/hono/streaming';
import type { AppEnv } from '@server/lib/hono/types';
import {
  DivinationError,
  drawDivination,
  interpretDivination,
  readDivination,
} from '@server/lib/services/DivinationService';
import { InventoryError } from '@server/lib/services/InventoryService';
import {
  DivinationDrawSchema,
  DivinationInterpretSchema,
  type DivinationStreamEvent,
} from '@shared/contracts/divination';
import { Hono } from 'hono';

const router = new Hono<AppEnv>();
router.use('*', requireActiveCultivatorRef());
router.get('/', async (c) =>
  c.json(await readDivination(c.get('activeCultivatorRef')!)),
);
router.post('/draw', validateJson(DivinationDrawSchema), async (c) => {
  try {
    const input = DivinationDrawSchema.parse(await c.req.json());
    return c.json(
      await drawDivination(c.get('activeCultivatorRef')!, input.direction),
    );
  } catch (error) {
    const lock = redisLockErrorResponse(error);
    if (lock) return lock;
    if (error instanceof DivinationError)
      return c.json({ error: error.message }, error.status);
    throw error;
  }
});
router.post(
  '/interpret',
  validateJson(DivinationInterpretSchema),
  async (c) => {
    const { drawId } = DivinationInterpretSchema.parse(await c.req.json());
    const actor = c.get('activeCultivatorRef')!;
    return streamSseEvents(c, async (stream, isAborted, signal) => {
      const emit = async (event: DivinationStreamEvent) => {
        if (isAborted()) return;
        try {
          await stream.writeSSE({ data: JSON.stringify(event) });
        } catch {
          /* 解读与发奖不依赖客户端是否收到最后一个事件。 */
        }
      };
      try {
        await interpretDivination(actor, drawId, signal, emit);
      } catch (error) {
        console.warn('[divination] interpretation incomplete', {
          drawId,
          error,
        });
        const lock = redisLockErrorResponse(error);
        await emit({
          type: 'error',
          message: lock
            ? '此签正在处理，请稍后重新查看。'
            : error instanceof DivinationError ||
                error instanceof InventoryError
              ? error.message
              : '解签暂未完成，请稍后继续。',
        });
      }
    });
  },
);
export default router;
