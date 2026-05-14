import { requireUser } from '@server/lib/hono/middleware';
import type { AppEnv } from '@server/lib/hono/types';
import {
  getBattleRecordV2ByIdForCultivator,
  listBattleRecordV2Summaries,
  type ListBattleRecordV2Input,
} from '@server/lib/repositories/battleRecordV2Repository';
import {
  getUserAliveCultivatorId,
} from '@server/lib/services/cultivatorService';
import { Hono } from 'hono';

const router = new Hono<AppEnv>();

router.get('/v2', requireUser(), async (c) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ success: false, error: '未授权' }, 401);
  }

  const page = Math.max(1, Number(c.req.query('page') ?? '1'));
  const pageSize = Math.min(50, Math.max(1, Number(c.req.query('pageSize') ?? '10')));
  const typeParam = c.req.query('type');
  const type: ListBattleRecordV2Input['type'] =
    typeParam === 'challenge' || typeParam === 'challenged' ? typeParam : null;

  const cultivatorId = await getUserAliveCultivatorId(user.id);
  if (!cultivatorId) {
    return c.json({ success: false, error: '未找到角色' }, 404);
  }

  const result = await listBattleRecordV2Summaries({
    cultivatorId,
    page,
    pageSize,
    type,
  });

  return c.json({
    success: true,
    data: result.data,
    pagination: {
      page,
      pageSize,
      total: result.total,
      totalPages: result.totalPages,
    },
  });
});

router.get('/v2/:id', requireUser(), async (c) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ success: false, error: '未授权' }, 401);
  }

  const cultivatorId = await getUserAliveCultivatorId(user.id);
  if (!cultivatorId) {
    return c.json({ success: false, error: '未找到角色' }, 404);
  }

  const record = await getBattleRecordV2ByIdForCultivator(
    c.req.param('id'),
    cultivatorId,
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
