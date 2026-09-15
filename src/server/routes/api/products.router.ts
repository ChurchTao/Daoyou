import { requireActiveCultivatorRef } from '@server/lib/hono/middleware';
import type { AppEnv } from '@server/lib/hono/types';
import * as creationProductRepository from '@server/lib/repositories/creationProductRepository';

import type { LegacyProductType as CreationProductType } from '@shared/legacy/products';

import { Hono } from 'hono';

const VALID_TYPES = new Set(['skill', 'gongfa', 'artifact']);

const router = new Hono<AppEnv>();

router.get('/', requireActiveCultivatorRef(), async (c) => {
  const ref = c.get('activeCultivatorRef');
  if (!ref) {
    return c.json({ error: '当前没有活跃角色' }, 404);
  }

  const type = c.req.query('type');
  if (!type || !VALID_TYPES.has(type)) {
    return c.json(
      { error: '请指定有效的产物类型 (skill|gongfa|artifact)' },
      400,
    );
  }

  const page = Math.max(1, parseInt(c.req.query('page') || '1', 10));
  const pageSize = Math.min(
    100,
    Math.max(1, parseInt(c.req.query('pageSize') || '20', 10)),
  );
  const [total, products] = await Promise.all([
    creationProductRepository.countByType(
      ref.cultivatorId,
      type as CreationProductType,
    ),
    creationProductRepository.findByTypeAndCultivatorPage(
      ref.cultivatorId,
      type as CreationProductType,
      { page, pageSize },
    ),
  ]);
  const totalPages = Math.ceil(total / pageSize);

  return c.json({
    success: true,
    data: {
      items: products,
      pagination: {
        page,
        pageSize,
        total,
        totalPages,
        hasMore: page < totalPages,
      },
    },
  });
});

router.post('/equip', requireActiveCultivatorRef(), (c) =>
  c.json({ error: '旧产物装配已停用' }, 410),
);

router.get('/:id', requireActiveCultivatorRef(), async (c) => {
  const cultivator = c.get('activeCultivatorRef');
  if (!cultivator) {
    return c.json({ error: '当前没有活跃角色' }, 404);
  }

  const product = await creationProductRepository.findById(c.req.param('id'));
  if (!product || product.cultivatorId !== cultivator.cultivatorId) {
    return c.json({ error: '产物不存在' }, 404);
  }

  return c.json({ success: true, data: product });
});

router.delete('/:id', requireActiveCultivatorRef(), (c) =>
  c.json({ error: '历史产物直接删除已停用' }, 410),
);

export default router;
