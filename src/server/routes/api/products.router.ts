import {
  requireActiveCultivator,
  requireActiveCultivatorRef,
} from '@server/lib/hono/middleware';
import type { AppEnv } from '@server/lib/hono/types';
import * as creationProductRepository from '@server/lib/repositories/creationProductRepository';
import {
  commitPlayerStateMutation,
  toPlayerStateMutationResponse,
  type StateChangeDescriptor,
} from '@server/lib/services/PlayerStateMutationService';
import {
  MAX_EQUIPPED_GONGFA,
} from '@shared/config/creationProductLimits';
import { DEFAULT_MAX_ACTIVE_SKILLS } from '@shared/config/skillLimits';
import { rehydrateStoredProductModel } from '@shared/engine/creation-v2/persistence/ProductPersistenceMapper';
import type { CreationProductType } from '@shared/engine/creation-v2/types';
import { getCreationProductTypeLabel } from '@shared/lib/gameConceptDisplay';
import type { ElementType } from '@shared/types/constants';
import { Hono } from 'hono';
import { z } from 'zod';
import { loadCultivatorSectState } from '@server/lib/repositories/sectRepository';

const VALID_TYPES = new Set(['skill', 'gongfa', 'artifact']);
const EquipSchema = z.object({
  productId: z.string().uuid(),
});

const router = new Hono<AppEnv>();

function withRehydratedProductModel<
  T extends { productModel?: unknown; element?: string | null },
>(product: T): T {
  const productModel = rehydrateStoredProductModel(
    (product.productModel ?? null) as Record<string, unknown> | null,
    (product.element as ElementType | null) ?? undefined,
  );

  if (!productModel) {
    return product;
  }

  return {
    ...product,
    productModel,
  };
}

router.get('/', requireActiveCultivatorRef(), async (c) => {
  const ref = c.get('activeCultivatorRef');
  if (!ref) {
    return c.json({ error: '当前没有活跃角色' }, 404);
  }

  const type = c.req.query('type');
  if (!type || !VALID_TYPES.has(type)) {
    return c.json({ error: '请指定有效的产物类型 (skill|gongfa|artifact)' }, 400);
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
      items: products.map(withRehydratedProductModel),
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

router.get('/equip', requireActiveCultivatorRef(), async (c) => {
  const ref = c.get('activeCultivatorRef');
  if (!ref) {
    return c.json({ error: '当前没有活跃角色' }, 404);
  }

  const equipped = await creationProductRepository.findEquippedArtifacts(
    ref.cultivatorId,
  );
  return c.json({
    success: true,
    data: equipped.map(withRehydratedProductModel),
  });
});

router.post('/equip', requireActiveCultivator(), async (c) => {
  const user = c.get('user');
  const cultivator = c.get('cultivator');
  if (!user || !cultivator) {
    return c.json({ error: '未授权访问' }, 401);
  }

  const { productId } = EquipSchema.parse(await c.req.json());
  const product = await creationProductRepository.findById(productId);

  if (!product || product.cultivatorId !== cultivator.id) {
    return c.json({ error: '产物不存在或不属于你' }, 404);
  }

  const productType = product.productType as CreationProductType;
  if (!VALID_TYPES.has(productType)) {
    return c.json({ error: '产物类型无效' }, 400);
  }

  if (productType === 'artifact') {
    if (!product.slot) {
      return c.json({ error: '法宝缺少槽位信息' }, 400);
    }

    const equipped = !product.isEquipped;
    const committed = await commitPlayerStateMutation({
      userId: user.id,
      cultivatorId: cultivator.id,
      source: 'product_equip',
      run: async (tx) => {
        if (product.isEquipped) {
          await creationProductRepository.unequipArtifact(productId, tx);
        } else {
          await creationProductRepository.equipArtifact(
            productId,
            cultivator.id,
            product.slot!,
            tx,
          );
        }

        return {
          result: {
            productId,
            productType,
            equipped,
          },
          changes: buildProductStateChanges(productType, 'loadout.equipped'),
        };
      },
    });
    const response = toPlayerStateMutationResponse(committed);
    return c.json({ ...response, equipped });
  }

  if (product.isEquipped) {
    const committed = await commitPlayerStateMutation({
      userId: user.id,
      cultivatorId: cultivator.id,
      source: 'product_equip',
      run: async (tx) => {
        await creationProductRepository.setProductEquipped(productId, false, tx);

        return {
          result: {
            productId,
            productType,
            equipped: false,
          },
          changes: buildProductStateChanges(productType, 'loadout.equipped'),
        };
      },
    });
    const response = toPlayerStateMutationResponse(committed);
    return c.json({ ...response, equipped: false });
  }

  if (productType === 'skill') {
    const executor = c.get('executor');
    const sect = executor
      ? await loadCultivatorSectState(cultivator.id, executor)
      : undefined;
    if (sect?.status === 'active') {
      return c.json({ success: false, error: '宗门弟子只能上阵宗门神通', code: 'SECT_SKILL_ONLY_LOADOUT' }, 409);
    }
  }

  const maxEquipped =
    productType === 'skill' ? DEFAULT_MAX_ACTIVE_SKILLS : MAX_EQUIPPED_GONGFA;
  const equippedCount = await creationProductRepository.countEquippedByType(
    cultivator.id,
    productType,
  );
  if (equippedCount >= maxEquipped) {
    return c.json(
      {
        error: `${getCreationProductTypeLabel(productType)}启用数量已达上限，请先停用旧项`,
      },
      409,
    );
  }

  const committed = await commitPlayerStateMutation({
    userId: user.id,
    cultivatorId: cultivator.id,
    source: 'product_equip',
    run: async (tx) => {
      await creationProductRepository.setProductEquipped(productId, true, tx);

      return {
        result: {
          productId,
          productType,
          equipped: true,
        },
        changes: buildProductStateChanges(productType, 'loadout.equipped'),
      };
    },
  });
  const response = toPlayerStateMutationResponse(committed);
  return c.json({ ...response, equipped: true });
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

  return c.json({ success: true, data: withRehydratedProductModel(product) });
});

router.delete('/:id', requireActiveCultivator(), async (c) => {
  const user = c.get('user');
  const cultivator = c.get('cultivator');
  if (!user || !cultivator) {
    return c.json({ error: '未授权访问' }, 401);
  }

  const id = c.req.param('id');
  const product = await creationProductRepository.findById(id);
  if (!product || product.cultivatorId !== cultivator.id) {
    return c.json({ error: '产物不存在或不属于你' }, 404);
  }

  const productType = product.productType as CreationProductType;
  const committed = await commitPlayerStateMutation({
    userId: user.id,
    cultivatorId: cultivator.id,
    source: 'product_delete',
    run: async (tx) => {
      await creationProductRepository.deleteById(id, tx);

      return {
        result: {
          productId: id,
          productType,
        },
        changes: buildProductStateChanges(productType, 'loadout.deleted'),
      };
    },
  });

  return c.json(toPlayerStateMutationResponse(committed));
});

function buildProductStateChanges(
  productType: CreationProductType,
  eventType: string,
): StateChangeDescriptor[] {
  const changes: StateChangeDescriptor[] = [
    {
      domain: 'loadout',
      eventType,
      invalidates: ['loadout'],
    },
    {
      domain: 'profile',
      eventType: 'profile.loadout.changed',
      invalidates: ['profile'],
    },
  ];

  return changes;
}

export default router;
