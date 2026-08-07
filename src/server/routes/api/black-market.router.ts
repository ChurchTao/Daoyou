import {
  redisLockErrorResponse,
  requireActiveCultivatorRef,
} from '@server/lib/hono/middleware';
import { jsonWithStatus } from '@server/lib/hono/response';
import type { AppEnv } from '@server/lib/hono/types';
import {
  BlackMarketServiceError,
  commitBlackMarketPurchase,
  getBlackMarketOverview,
  interactWithBlackMarket,
  leaveBlackMarketSession,
  openBlackMarketSession,
} from '@server/lib/services/black-market/BlackMarketService';
import { toPlayerStateMutationResponse } from '@server/lib/services/ResourceMutationResponse';
import {
  BLACK_MARKET_INSPECTION_KINDS,
  BLACK_MARKET_NPC_IDS,
} from '@shared/types/blackMarket';
import { Hono, type Context } from 'hono';
import { z } from 'zod';

const OpenSessionSchema = z.object({
  npcId: z.enum(BLACK_MARKET_NPC_IDS),
});

const InteractSchema = z
  .object({
    action: z.enum(['inspect', 'question', 'haggle']),
    inspectionKind: z.enum(BLACK_MARKET_INSPECTION_KINDS).optional(),
    message: z.string().trim().min(1).max(240).optional(),
    offeredPrice: z.number().int().min(1).max(2_000_000_000).optional(),
    version: z.number().int().min(1),
  })
  .superRefine((value, context) => {
    if (value.action === 'inspect' && !value.inspectionKind) {
      context.addIssue({ code: 'custom', message: '请选择调查方式' });
    }
    if (value.action === 'question' && !value.message) {
      context.addIssue({ code: 'custom', message: '请输入想问的问题' });
    }
    if (value.action === 'haggle' && !value.offeredPrice) {
      context.addIssue({ code: 'custom', message: '请输入灵石报价' });
    }
  });

const LeaveSchema = z.object({ version: z.number().int().min(1) });
const CommitSchema = z.object({
  version: z.number().int().min(1),
  expectedPrice: z.number().int().min(1).max(2_000_000_000),
});

const router = new Hono<AppEnv>();
router.use('*', requireActiveCultivatorRef());

function actor(c: Context<AppEnv>) {
  const active = c.get('activeCultivatorRef');
  if (!active) throw new BlackMarketServiceError(404, '当前没有活跃角色');
  return { userId: active.userId, cultivatorId: active.cultivatorId };
}

function errorResponse(c: Context<AppEnv>, error: unknown) {
  const lockResponse = redisLockErrorResponse(error);
  if (lockResponse) return lockResponse;
  if (error instanceof z.ZodError) {
    return c.json({ error: error.issues[0]?.message || '参数错误' }, 400);
  }
  if (error instanceof BlackMarketServiceError) {
    return jsonWithStatus(c, { error: error.message }, error.status);
  }
  console.error('black market api error:', error);
  return c.json({ error: '黑市暂时闭门，请稍后再来' }, 500);
}

router.get('/:nodeId', async (c) => {
  try {
    return c.json(
      await getBlackMarketOverview({
        actor: actor(c),
        nodeId: c.req.param('nodeId'),
      }),
    );
  } catch (error) {
    return errorResponse(c, error);
  }
});

router.post('/:nodeId/sessions', async (c) => {
  try {
    const parsed = OpenSessionSchema.parse(await c.req.json());
    return c.json(
      await openBlackMarketSession({
        actor: actor(c),
        nodeId: c.req.param('nodeId'),
        npcId: parsed.npcId,
      }),
    );
  } catch (error) {
    return errorResponse(c, error);
  }
});

router.post('/:nodeId/sessions/:sessionId/interact', async (c) => {
  try {
    const command = InteractSchema.parse(await c.req.json());
    return c.json(
      await interactWithBlackMarket({
        actor: actor(c),
        nodeId: c.req.param('nodeId'),
        sessionId: c.req.param('sessionId'),
        command,
        abortSignal: c.req.raw.signal,
      }),
    );
  } catch (error) {
    return errorResponse(c, error);
  }
});

router.post('/:nodeId/sessions/:sessionId/commit', async (c) => {
  try {
    const parsed = CommitSchema.parse(await c.req.json());
    const committed = await commitBlackMarketPurchase({
      actor: actor(c),
      nodeId: c.req.param('nodeId'),
      sessionId: c.req.param('sessionId'),
      version: parsed.version,
      expectedPrice: parsed.expectedPrice,
    });
    return c.json(toPlayerStateMutationResponse(await committed));
  } catch (error) {
    return errorResponse(c, error);
  }
});

router.post('/:nodeId/sessions/:sessionId/leave', async (c) => {
  try {
    const parsed = LeaveSchema.parse(await c.req.json());
    return c.json(
      await leaveBlackMarketSession({
        actor: actor(c),
        nodeId: c.req.param('nodeId'),
        sessionId: c.req.param('sessionId'),
        version: parsed.version,
      }),
    );
  } catch (error) {
    return errorResponse(c, error);
  }
});

export default router;
