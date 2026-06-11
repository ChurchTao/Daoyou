import {
  getValidatedQuery,
  requireActiveCultivatorRef,
  validateQuery,
} from '@server/lib/hono/middleware';
import type { AppEnv } from '@server/lib/hono/types';
import {
  getBattleRecordV2ByIdForCultivator,
  listBattleRecordV2Summaries,
} from '@server/lib/repositories/battleRecordV2Repository';
import { Hono } from 'hono';
import { z } from 'zod';

const router = new Hono<AppEnv>();

const BattleRecordListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(500).default(1),
  pageSize: z.coerce.number().int().min(1).max(5).default(5),
  type: z.enum(['challenge', 'challenged']).optional(),
});

type BattleRecordListQuery = z.infer<typeof BattleRecordListQuerySchema>;

router.get(
  '/v2',
  requireActiveCultivatorRef(),
  validateQuery(BattleRecordListQuerySchema),
  async (c) => {
    const { page, pageSize, type } =
      getValidatedQuery<BattleRecordListQuery>(c);
    const activeRef = c.get('activeCultivatorRef');
    if (!activeRef) {
      return c.json({ success: false, error: '当前没有活跃角色' }, 404);
    }
    const result = await listBattleRecordV2Summaries({
      cultivatorId: activeRef.cultivatorId,
      page,
      pageSize,
      type: type ?? null,
    });

    return c.json({
      success: true,
      data: result.data,
      pagination: {
        page,
        pageSize,
        hasMore: result.hasMore,
      },
    });
  },
);

router.get('/v2/:id', requireActiveCultivatorRef(), async (c) => {
  const activeRef = c.get('activeCultivatorRef');
  if (!activeRef) {
    return c.json({ success: false, error: '当前没有活跃角色' }, 404);
  }
  const record = await getBattleRecordV2ByIdForCultivator(
    c.req.param('id'),
    activeRef.cultivatorId,
  );

  if (!record) {
    return c.json({ success: false, error: '记录不存在' }, 404);
  }

  return c.json({
    success: true,
    data: {
      id: record.id,
      createdAt: record.createdAt,
      battleResult: record.battleResult,
      battleReport: record.battleReport,
    },
  });
});

export default router;
