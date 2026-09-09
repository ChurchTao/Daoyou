import {
  redisLockErrorResponse,
  requireActiveCultivatorRef,
} from '@server/lib/hono/middleware';
import { jsonWithStatus } from '@server/lib/hono/response';
import type { AppEnv } from '@server/lib/hono/types';
import {
  isValidRedeemCodeFormat,
  normalizeRedeemCode,
} from '@server/lib/redeem/code';
import { AttributeResetServiceError } from '@server/lib/services/AttributeResetService';

import {
  allocateCultivatorAttributes,
  reincarnateActiveCultivator,
  resetCultivatorAttributes,
  updateCultivatorTitle,
} from '@server/lib/services/CultivatorProfileApplicationService';
import { QiService } from '@server/lib/services/QiService';
import {
  claimRedeemCode,
  RedeemClaimError,
} from '@server/lib/services/RedeemCodeApplicationService';
import { toPlayerStateMutationResponse } from '@server/lib/services/ResourceMutationResponse';
import { Hono } from 'hono';
import { z } from 'zod';

const TitleSchema = z.object({
  title: z.string().min(2).max(8).optional().nullable(),
});

const ClaimRedeemCodeSchema = z.object({
  code: z.string().trim().min(1).max(64),
});

const AttributeAllocationSchema = z
  .object({
    attribute_model_version: z.literal(2),
    vitality: z.number().int().min(0).default(0),
    strength: z.number().int().min(0).default(0),
    spirit: z.number().int().min(0).default(0),
    endurance: z.number().int().min(0).default(0),
    speed: z.number().int().min(0).default(0),
    willpower: z.number().int().min(0).default(0),
  })
  .strict();

function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  return (error as { code?: string }).code === '23505';
}

function parsePositiveInt(
  rawValue: string | undefined,
  fallback: number,
): number {
  if (!rawValue) return fallback;
  const parsed = Number.parseInt(rawValue, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const router = new Hono<AppEnv>();

router.post('/active-reincarnate', requireActiveCultivatorRef(), async (c) => {
  const user = c.get('user');
  const cultivator = c.get('activeCultivatorRef');
  if (!user || !cultivator) {
    return c.json({ error: '当前没有活跃角色' }, 404);
  }

  const committed = await reincarnateActiveCultivator({
    actor: { userId: user.id, cultivatorId: cultivator.cultivatorId },
  });

  return c.json(toPlayerStateMutationResponse(committed));
});

router.post('/equip', requireActiveCultivatorRef(), (c) =>
  c.json({ error: '旧产物装配已停用' }, 410),
);

router.get('/qi/logs', requireActiveCultivatorRef(), async (c) => {
  const cultivator = c.get('activeCultivatorRef');
  if (!cultivator) {
    return c.json({ error: '当前没有活跃角色' }, 404);
  }

  const page = parsePositiveInt(c.req.query('page'), 1);
  const pageSize = Math.min(100, parsePositiveInt(c.req.query('pageSize'), 20));
  const data = await QiService.listLogs(cultivator.cultivatorId, {
    page,
    pageSize,
  });
  return c.json({ success: true, data });
});

router.post('/title', requireActiveCultivatorRef(), async (c) => {
  const user = c.get('user');
  const cultivator = c.get('activeCultivatorRef');
  if (!user || !cultivator) {
    return c.json({ error: '未授权访问' }, 401);
  }

  const { title } = TitleSchema.parse(await c.req.json());
  const committed = await updateCultivatorTitle({
    userId: user.id,
    cultivatorId: cultivator.cultivatorId,
    title: title || null,
  });

  return c.json(toPlayerStateMutationResponse(committed));
});

router.post('/attributes/allocate', requireActiveCultivatorRef(), async (c) => {
  const user = c.get('user');
  const cultivator = c.get('activeCultivatorRef');
  if (!user || !cultivator) {
    return c.json({ error: '未授权访问' }, 401);
  }

  const parsed = AttributeAllocationSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: '参数错误', details: parsed.error.flatten() }, 400);
  }

  try {
    const delta = {
      vitality: parsed.data.vitality,
      strength: parsed.data.strength,
      spirit: parsed.data.spirit,
      endurance: parsed.data.endurance,
      speed: parsed.data.speed,
      willpower: parsed.data.willpower,
    };
    const committed = await allocateCultivatorAttributes({
      actor: {
        userId: user.id,
        cultivatorId: cultivator.cultivatorId,
      },
      delta,
    });
    return c.json(toPlayerStateMutationResponse(committed));
  } catch (error) {
    const lockErrorResponse = redisLockErrorResponse(error);
    if (lockErrorResponse) return lockErrorResponse;
    const message = error instanceof Error ? error.message : '属性分配失败';
    if (
      [
        '角色不存在',
        '未分配属性点不足',
        '属性不能低于基础值',
        '属性总点数超过当前境界预算',
      ].includes(message)
    ) {
      return c.json({ error: message }, message === '角色不存在' ? 404 : 400);
    }
    throw error;
  }
});

router.post('/attributes/reset', requireActiveCultivatorRef(), async (c) => {
  const user = c.get('user');
  const cultivator = c.get('activeCultivatorRef');
  if (!user || !cultivator) {
    return c.json({ error: '未授权访问' }, 401);
  }

  try {
    const committed = await resetCultivatorAttributes({
      userId: user.id,
      cultivatorId: cultivator.cultivatorId,
    });

    return c.json(toPlayerStateMutationResponse(committed));
  } catch (error) {
    const lockErrorResponse = redisLockErrorResponse(error);
    if (lockErrorResponse) return lockErrorResponse;
    if (error instanceof AttributeResetServiceError) {
      return c.json({ error: error.message }, error.status as 400 | 404);
    }
    throw error;
  }
});

router.post('/redeem-code/claim', requireActiveCultivatorRef(), async (c) => {
  const user = c.get('user');
  const cultivator = c.get('activeCultivatorRef');
  if (!user || !cultivator) {
    return c.json({ error: '未授权访问' }, 401);
  }

  const parsed = ClaimRedeemCodeSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: '参数错误', details: parsed.error.flatten() }, 400);
  }

  const normalizedCode = normalizeRedeemCode(parsed.data.code);
  if (!isValidRedeemCodeFormat(normalizedCode)) {
    return c.json({ error: '兑换码格式错误，仅支持 6-64 位大写字母数字' }, 400);
  }

  try {
    const committed = await claimRedeemCode({
      userId: user.id,
      cultivatorId: cultivator.cultivatorId,
      code: normalizedCode,
    });

    return c.json(toPlayerStateMutationResponse(committed));
  } catch (error) {
    const lockErrorResponse = redisLockErrorResponse(error);
    if (lockErrorResponse) return lockErrorResponse;
    if (isUniqueViolation(error)) {
      return c.json({ error: '该兑换码你已使用过' }, 400);
    }
    if (error instanceof RedeemClaimError) {
      return jsonWithStatus(c, { error: error.message }, error.status);
    }
    console.error('Redeem claim error:', error);
    return c.json({ error: '兑换失败，请稍后重试' }, 500);
  }
});

export default router;
