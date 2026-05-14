import {
  requireActiveCultivator,
} from '@server/lib/hono/middleware';
import type { AppEnv } from '@server/lib/hono/types';
import * as creationProductRepository from '@server/lib/repositories/creationProductRepository';
import type { CreationProductType } from '@shared/engine/creation-v2/types';
import { Hono } from 'hono';
import { z } from 'zod';

const VALID_TYPES = new Set(['skill', 'gongfa', 'artifact']);
const EquipSchema = z.object({
  productId: z.string().uuid(),
});

const router = new Hono<AppEnv>();

router.get('/', requireActiveCultivator(), async (c) => {
  const cultivator = c.get('cultivator');
  if (!cultivator) {
    return c.json({ error: '当前没有活跃角色' }, 404);
  }

  const type = c.req.query('type');
  if (!type || !VALID_TYPES.has(type)) {
    return c.json({ error: '请指定有效的产物类型 (skill|gongfa|artifact)' }, 400);
  }

  const products = await creationProductRepository.findByTypeAndCultivator(
    cultivator.id,
    type as CreationProductType,
  );

  return c.json({ success: true, data: products });
});

router.get('/equip', requireActiveCultivator(), async (c) => {
  const cultivator = c.get('cultivator');
  if (!cultivator) {
    return c.json({ error: '当前没有活跃角色' }, 404);
  }

  const equipped = await creationProductRepository.findEquippedArtifacts(cultivator.id);
  return c.json({ success: true, data: equipped });
});

router.post('/equip', requireActiveCultivator(), async (c) => {
  const cultivator = c.get('cultivator');
  if (!cultivator) {
    return c.json({ error: '当前没有活跃角色' }, 404);
  }

  const { productId } = EquipSchema.parse(await c.req.json());
  const product = await creationProductRepository.findById(productId);

  if (!product || product.cultivatorId !== cultivator.id) {
    return c.json({ error: '法宝不存在或不属于你' }, 404);
  }
  if (product.productType !== 'artifact') {
    return c.json({ error: '只有法宝才能装备' }, 400);
  }
  if (!product.slot) {
    return c.json({ error: '法宝缺少槽位信息' }, 400);
  }

  if (product.isEquipped) {
    await creationProductRepository.unequipArtifact(productId);
    return c.json({ success: true, equipped: false });
  }

  await creationProductRepository.equipArtifact(
    productId,
    cultivator.id,
    product.slot,
  );

  return c.json({ success: true, equipped: true });
});

router.get('/:id', requireActiveCultivator(), async (c) => {
  const cultivator = c.get('cultivator');
  if (!cultivator) {
    return c.json({ error: '当前没有活跃角色' }, 404);
  }

  const product = await creationProductRepository.findById(c.req.param('id'));
  if (!product || product.cultivatorId !== cultivator.id) {
    return c.json({ error: '产物不存在' }, 404);
  }

  return c.json({ success: true, data: product });
});

router.delete('/:id', requireActiveCultivator(), async (c) => {
  const cultivator = c.get('cultivator');
  if (!cultivator) {
    return c.json({ error: '当前没有活跃角色' }, 404);
  }

  const id = c.req.param('id');
  const product = await creationProductRepository.findById(id);
  if (!product || product.cultivatorId !== cultivator.id) {
    return c.json({ error: '产物不存在或不属于你' }, 404);
  }

  await creationProductRepository.deleteById(id);
  return c.json({ success: true });
});

export default router;
