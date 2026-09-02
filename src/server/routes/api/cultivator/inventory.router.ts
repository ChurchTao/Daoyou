import {
  redisLockErrorResponse,
  requireActiveCultivatorRef,
} from '@server/lib/hono/middleware';
import { jsonWithStatus } from '@server/lib/hono/response';
import type { AppEnv } from '@server/lib/hono/types';
import {
  discardInventoryItem,
  identifyMysteryMaterial,
} from '@server/lib/services/InventoryApplicationService';
import { MarketServiceError } from '@server/lib/services/MarketService';
import {
  QiInsufficientError,
  QiServiceError,
} from '@server/lib/services/QiService';
import { toPlayerStateMutationResponse } from '@server/lib/services/ResourceMutationResponse';
import { readResourceWithMeta } from '@server/lib/services/ResourceReadService';
import { getPaginatedInventoryByType } from '@server/lib/services/cultivator/CultivatorInventoryRepository';
import {
  ELEMENT_VALUES,
  MATERIAL_TYPE_VALUES,
  QUALITY_VALUES,
  type ElementType,
  type MaterialType,
  type Quality,
} from '@shared/types/constants';
import { Hono, type Context } from 'hono';
import { z } from 'zod';

const DiscardSchema = z.object({
  itemId: z.string(),
  itemType: z.enum(['artifact', 'consumable', 'material']),
});
const IdentifySchema = z.object({ materialId: z.string().min(1) });

function parseList<T extends string>(
  raw: string | null,
  values: readonly T[],
  label: string,
): T[] | undefined {
  if (!raw) return undefined;
  const parsed = raw
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean) as T[];
  if (parsed.length === 0) return undefined;
  const allowed = new Set(values);
  if (parsed.some((value) => !allowed.has(value))) {
    throw new Error(`无效的${label}，支持：${values.join(', ')}`);
  }
  return parsed;
}

function qiErrorResponse(c: Context<AppEnv>, error: unknown) {
  if (error instanceof QiInsufficientError) {
    return c.json(
      {
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
    return jsonWithStatus(c, { error: error.message }, error.status);
  }
  return null;
}

const inventoryRouter = new Hono<AppEnv>();

inventoryRouter.get('/', requireActiveCultivatorRef(), async (c) => {
  const user = c.get('user');
  const ref = c.get('activeCultivatorRef');
  if (!user || !ref) {
    return c.json({ success: false, error: '未授权访问' }, 401);
  }
  const type = c.req.query('type');
  if (!type) {
    return c.json({ success: false, error: '必须指定背包类型和分页参数' }, 400);
  }
  if (!['artifacts', 'materials', 'consumables'].includes(type)) {
    return c.json(
      {
        success: false,
        error: '无效的背包类型，仅支持 artifacts | materials | consumables',
      },
      400,
    );
  }

  const page = Math.max(1, parseInt(c.req.query('page') || '1', 10));
  const pageSize = Math.min(
    100,
    Math.max(1, parseInt(c.req.query('pageSize') || '20', 10)),
  );
  const consumableKind = c.req.query('consumableKind');
  if (
    consumableKind &&
    !['pill', 'spirit_fruit', 'tradable'].includes(consumableKind)
  ) {
    return c.json({ success: false, error: '无效的消耗品分类' }, 400);
  }
  let materialTypes: MaterialType[] | undefined;
  let excludeMaterialTypes: MaterialType[] | undefined;
  let materialRanks: Quality[] | undefined;
  let materialElements: ElementType[] | undefined;
  try {
    materialTypes = parseList(
      c.req.query('materialTypes') ?? null,
      MATERIAL_TYPE_VALUES,
      '材料类型',
    );
    excludeMaterialTypes = parseList(
      c.req.query('excludeMaterialTypes') ?? null,
      MATERIAL_TYPE_VALUES,
      '材料类型',
    );
    materialRanks = parseList(
      c.req.query('materialRanks') ?? null,
      QUALITY_VALUES,
      '材料品级',
    );
    materialElements = parseList(
      c.req.query('materialElements') ?? null,
      ELEMENT_VALUES,
      '材料属性',
    );
  } catch (error) {
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '材料类型参数解析失败',
      },
      400,
    );
  }

  const validSortBy = [
    'createdAt',
    'rank',
    'type',
    'element',
    'quantity',
    'name',
  ] as const;
  const validSortOrder = ['asc', 'desc'] as const;
  const materialSortBy = c.req.query('materialSortBy');
  const materialSortOrder = c.req.query('materialSortOrder');
  if (
    materialSortBy &&
    !validSortBy.includes(materialSortBy as (typeof validSortBy)[number])
  ) {
    return c.json(
      {
        success: false,
        error: `无效的排序字段，支持：${validSortBy.join(', ')}`,
      },
      400,
    );
  }
  if (
    materialSortOrder &&
    !validSortOrder.includes(
      materialSortOrder as (typeof validSortOrder)[number],
    )
  ) {
    return c.json(
      {
        success: false,
        error: `无效的排序方向，支持：${validSortOrder.join(', ')}`,
      },
      400,
    );
  }

  const options = {
    page,
    pageSize,
    materialTypes,
    excludeMaterialTypes,
    materialRanks,
    materialElements,
    materialSortBy: materialSortBy as (typeof validSortBy)[number] | undefined,
    materialSortOrder: materialSortOrder as 'asc' | 'desc' | undefined,
    consumableKind: consumableKind as
      'pill' | 'spirit_fruit' | 'tradable' | undefined,
  };
  const scope = { kind: 'cultivator' as const, id: ref.cultivatorId };
  if (type === 'artifacts') {
    return c.json(
      await readResourceWithMeta(scope, 'inventory.artifacts', (q) =>
        getPaginatedInventoryByType(
          user.id,
          ref.cultivatorId,
          { ...options, type: 'artifacts' },
          q,
        ),
      ),
    );
  }
  if (type === 'materials') {
    return c.json(
      await readResourceWithMeta(scope, 'inventory.materials', (q) =>
        getPaginatedInventoryByType(
          user.id,
          ref.cultivatorId,
          { ...options, type: 'materials' },
          q,
        ),
      ),
    );
  }
  return c.json(
    await readResourceWithMeta(scope, 'inventory.consumables', (q) =>
      getPaginatedInventoryByType(
        user.id,
        ref.cultivatorId,
        { ...options, type: 'consumables' },
        q,
      ),
    ),
  );
});

inventoryRouter.post('/discard', requireActiveCultivatorRef(), async (c) => {
  const user = c.get('user');
  const cultivator = c.get('activeCultivatorRef');
  if (!user || !cultivator) {
    return c.json({ success: false, error: '未授权访问' }, 401);
  }
  const { itemId, itemType } = DiscardSchema.parse(await c.req.json());
  const committed = await discardInventoryItem({
    actor: { userId: user.id, cultivatorId: cultivator.cultivatorId },
    itemId,
    itemType,
  });
  return c.json(toPlayerStateMutationResponse(committed));
});

inventoryRouter.post('/identify', requireActiveCultivatorRef(), async (c) => {
  const user = c.get('user');
  const cultivator = c.get('activeCultivatorRef');
  if (!user || !cultivator) {
    return c.json({ error: '未授权访问' }, 401);
  }
  try {
    const { materialId } = IdentifySchema.parse(await c.req.json());
    const committed = await identifyMysteryMaterial({
      actor: { userId: user.id, cultivatorId: cultivator.cultivatorId },
      materialId,
    });
    return c.json(toPlayerStateMutationResponse(committed));
  } catch (error) {
    const lockErrorResponse = redisLockErrorResponse(error);
    if (lockErrorResponse) return lockErrorResponse;
    const qiResponse = qiErrorResponse(c, error);
    if (qiResponse) return qiResponse;
    if (error instanceof MarketServiceError) {
      return jsonWithStatus(c, { error: error.message }, error.status);
    }
    if (error instanceof z.ZodError) {
      return c.json({ error: error.issues[0]?.message || '参数错误' }, 400);
    }
    console.error('Identify API error:', error);
    return c.json({ error: '鉴定失败' }, 500);
  }
});

export default inventoryRouter;
