import {
  redisLockErrorResponse,
  requireActiveCultivatorRef,
} from '@server/lib/hono/middleware';
import { jsonWithStatus } from '@server/lib/hono/response';
import type { AppEnv } from '@server/lib/hono/types';
import { toPlayerStateMutationResponse } from '@server/lib/services/ResourceMutationResponse';
import {
  SpiritFieldServiceError,
  careSpiritField,
  claimSpiritFieldStarterSeeds,
  getSpiritFieldSnapshot,
  harvestSpiritField,
  interpretSpiritFieldAction,
  sowSpiritField,
  upgradeSpiritField,
} from '@server/lib/services/spirit-field/SpiritFieldService';
import {
  QiInsufficientError,
  QiServiceError,
} from '@server/lib/services/QiService';
import {
  SpiritFieldCareRequestSchema,
  SpiritFieldHarvestRequestSchema,
  SpiritFieldInterpretRequestSchema,
  SpiritFieldSowRequestSchema,
  SpiritFieldUpgradeRequestSchema,
} from '@shared/contracts/spiritField';
import { Hono, type Context } from 'hono';
import { z } from 'zod';

const router = new Hono<AppEnv>();
router.use('*', requireActiveCultivatorRef());

function actor(c: Context<AppEnv>) {
  const active = c.get('activeCultivatorRef');
  if (!active) {
    throw new SpiritFieldServiceError('当前没有活跃角色', 404);
  }
  return { userId: active.userId, cultivatorId: active.cultivatorId };
}

function errorResponse(c: Context<AppEnv>, error: unknown) {
  const lockResponse = redisLockErrorResponse(error);
  if (lockResponse) return lockResponse;

  if (error instanceof z.ZodError) {
    return c.json(
      {
        success: false,
        error: error.issues[0]?.message || '参数错误',
        details: error.issues,
      },
      400,
    );
  }

  if (error instanceof SpiritFieldServiceError) {
    return jsonWithStatus(
      c,
      { success: false, error: error.message },
      error.status,
    );
  }

  if (error instanceof QiInsufficientError) {
    return c.json(
      {
        success: false,
        error: error.code,
        message: error.message,
        required: error.required,
        current: error.current,
        action: error.action,
      },
      409,
    );
  }

  if (error instanceof QiServiceError) {
    return jsonWithStatus(
      c,
      { success: false, error: error.message },
      error.status,
    );
  }

  console.error('spirit field api error:', error);
  return c.json(
    { success: false, error: '灵田灵机暂乱，请稍后再试' },
    500,
  );
}

router.get('/', async (c) => {
  try {
    return c.json({
      success: true,
      data: await getSpiritFieldSnapshot(actor(c)),
    });
  } catch (error) {
    return errorResponse(c, error);
  }
});

router.post('/starter', async (c) => {
  try {
    const committed = await claimSpiritFieldStarterSeeds(actor(c));
    return c.json(toPlayerStateMutationResponse(committed));
  } catch (error) {
    return errorResponse(c, error);
  }
});

router.post('/sow', async (c) => {
  try {
    const input = SpiritFieldSowRequestSchema.parse(await c.req.json());
    const committed = await sowSpiritField(actor(c), input);
    return c.json(toPlayerStateMutationResponse(committed));
  } catch (error) {
    return errorResponse(c, error);
  }
});

router.post('/interpret', async (c) => {
  try {
    const input = SpiritFieldInterpretRequestSchema.parse(await c.req.json());
    return c.json({
      success: true,
      data: await interpretSpiritFieldAction(actor(c), {
        ...input,
        abortSignal: c.req.raw.signal,
      }),
    });
  } catch (error) {
    return errorResponse(c, error);
  }
});

router.post('/care', async (c) => {
  try {
    const input = SpiritFieldCareRequestSchema.parse(await c.req.json());
    const committed = await careSpiritField(actor(c), input);
    return c.json(toPlayerStateMutationResponse(committed));
  } catch (error) {
    return errorResponse(c, error);
  }
});

router.post('/harvest', async (c) => {
  try {
    const input = SpiritFieldHarvestRequestSchema.parse(await c.req.json());
    const committed = await harvestSpiritField(actor(c), input);
    return c.json(toPlayerStateMutationResponse(committed));
  } catch (error) {
    return errorResponse(c, error);
  }
});

router.post('/upgrade', async (c) => {
  try {
    const input = SpiritFieldUpgradeRequestSchema.parse(await c.req.json());
    const committed = await upgradeSpiritField(actor(c), input);
    return c.json(toPlayerStateMutationResponse(committed));
  } catch (error) {
    return errorResponse(c, error);
  }
});

export default router;
