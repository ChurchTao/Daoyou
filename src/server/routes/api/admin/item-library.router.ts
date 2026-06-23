import { requireAdmin } from '@server/lib/hono/middleware';
import type { AppEnv } from '@server/lib/hono/types';
import {
  getItemLibraryDailyMaterialGenerationSettings,
  upsertItemLibraryDailyMaterialGenerationSettings,
} from '@server/lib/repositories/appSettingsRepository';
import {
  archiveItemLibraryEntry,
  createItemLibraryEntry,
  findItemLibraryById,
  listItemLibrary,
  normalizeItemLibraryFilters,
  updateItemLibraryEntry,
} from '@server/lib/repositories/itemLibraryRepository';
import { generateMaterialLibraryEntries } from '@server/lib/services/MaterialLibraryService';
import { buildPresetArtifact } from '@shared/engine/cultivator/creation/presetProducts';
import { DEFAULT_AFFIX_REGISTRY } from '@shared/engine/creation-v2/affixes';
import {
  rehydrateStoredProductModel,
  serializeProductModel,
} from '@shared/engine/creation-v2/persistence/ProductPersistenceMapper';
import { calculateProductScore } from '@shared/engine/creation-v2/persistence/ScoreCalculator';
import { ItemLibraryDailyMaterialGenerationSettingsSchema } from '@shared/lib/constants/appSettings';
import {
  ArtifactPreviewRequestSchema,
  CreateItemLibraryEntrySchema,
  ItemLibraryArtifactPayloadSchema,
  ItemLibraryListQuerySchema,
  ItemLibraryMaterialGenerateSchema,
  UpdateItemLibraryEntrySchema,
  type CreateItemLibraryEntry,
  type UpdateItemLibraryEntry,
} from '@shared/lib/itemLibrary';
import { Hono } from 'hono';
import type { z } from 'zod';

const router = new Hono<AppEnv>();

function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const maybe = error as { code?: string };
  return maybe.code === '23505';
}

function validateArtifactAffixes(affixIds: string[]): string | null {
  for (const affixId of affixIds) {
    const def = DEFAULT_AFFIX_REGISTRY.queryById(affixId);
    if (!def) return `未知词缀：${affixId}`;
    if (!def.applicableTo.includes('artifact')) {
      return `词缀不可用于法宝：${affixId}`;
    }
  }
  return null;
}

function buildArtifactPayload(
  input: z.infer<typeof ArtifactPreviewRequestSchema>,
) {
  const affixError = validateArtifactAffixes(input.affixIds);
  if (affixError) {
    throw new Error(affixError);
  }

  const artifact = buildPresetArtifact({
    name: input.name,
    description: input.description,
    slot: input.slot,
    element: input.element,
    quality: input.quality,
    affixIds: input.affixIds,
    realm: input.realm,
    realmStage: input.realmStage,
    creatorName: '道具库',
    creatorCultivatorId: 'item-library',
    isEquipped: false,
  });
  const productModel = serializeProductModel(artifact.productModel);
  const rehydrated = rehydrateStoredProductModel(productModel, artifact.element);

  if (!rehydrated) {
    throw new Error('法宝 productModel 无法校验');
  }

  return ItemLibraryArtifactPayloadSchema.parse({
    name: artifact.name,
    slot: artifact.slot,
    element: artifact.element,
    quality: artifact.quality,
    description: artifact.description,
    score: calculateProductScore(
      artifact.productModel.balanceMetrics,
      artifact.productModel.affixes,
    ),
    productModel,
  });
}

function normalizeArtifactEntry<T extends CreateItemLibraryEntry | UpdateItemLibraryEntry>(
  entry: T,
): T {
  if (entry.type !== 'artifact') return entry;

  return {
    ...entry,
    payload: buildArtifactPayload({
      name: entry.payload.name,
      description: entry.payload.description,
      ...entry.editorConfig,
    }),
  };
}

router.get('/', requireAdmin(), async (c) => {
  const parsed = ItemLibraryListQuerySchema.safeParse({
    status: c.req.query('status') || undefined,
    type: c.req.query('type') || undefined,
    materialType: c.req.query('materialType') || undefined,
    quality: c.req.query('quality') || undefined,
    q: c.req.query('q') || undefined,
    itemIds: c.req.query('itemIds') || undefined,
    page: c.req.query('page') || undefined,
    pageSize: c.req.query('pageSize') || undefined,
  });

  if (!parsed.success) {
    return c.json({ error: '参数错误', details: parsed.error.flatten() }, 400);
  }

  const result = await listItemLibrary(normalizeItemLibraryFilters(parsed.data));
  return c.json(result);
});

router.post('/materials/generate', requireAdmin(), async (c) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ error: '未授权访问' }, 401);
  }

  const body = await c.req.json().catch(() => null);
  const parsed = ItemLibraryMaterialGenerateSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: '参数错误', details: parsed.error.flatten() }, 400);
  }

  try {
    const items = await generateMaterialLibraryEntries({
      request: parsed.data,
      userId: user.id,
    });
    return c.json({ success: true, items, generated: items.length });
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : '批量生成材料失败' },
      500,
    );
  }
});

router.get('/materials/daily-generation-settings', requireAdmin(), async (c) => {
  const settings = await getItemLibraryDailyMaterialGenerationSettings();
  return c.json({ settings });
});

router.put('/materials/daily-generation-settings', requireAdmin(), async (c) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ error: '未授权访问' }, 401);
  }

  const body = await c.req.json().catch(() => null);
  const parsed =
    ItemLibraryDailyMaterialGenerationSettingsSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: '参数错误', details: parsed.error.flatten() }, 400);
  }

  await upsertItemLibraryDailyMaterialGenerationSettings({
    settings: parsed.data,
    updatedBy: user.id,
  });

  return c.json({ success: true, settings: parsed.data });
});

router.post('/', requireAdmin(), async (c) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ error: '未授权访问' }, 401);
  }

  const body = await c.req.json().catch(() => null);
  const parsed = CreateItemLibraryEntrySchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: '参数错误', details: parsed.error.flatten() }, 400);
  }

  try {
    const entry = await createItemLibraryEntry({
      entry: normalizeArtifactEntry(parsed.data),
      userId: user.id,
    });
    return c.json({ success: true, item: entry });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return c.json({ error: '道具 ID 已存在' }, 409);
    }
    return c.json(
      { error: error instanceof Error ? error.message : '创建道具失败' },
      400,
    );
  }
});

router.put('/:id', requireAdmin(), async (c) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ error: '未授权访问' }, 401);
  }

  const id = c.req.param('id');
  const body = await c.req.json().catch(() => null);
  const parsed = UpdateItemLibraryEntrySchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: '参数错误', details: parsed.error.flatten() }, 400);
  }

  try {
    const item = await updateItemLibraryEntry({
      id,
      entry: normalizeArtifactEntry(parsed.data),
      userId: user.id,
    });

    if (!item) {
      return c.json({ error: '道具不存在' }, 404);
    }

    return c.json({ success: true, item });
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : '更新道具失败' },
      400,
    );
  }
});

router.post('/artifact/preview', requireAdmin(), async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = ArtifactPreviewRequestSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: '参数错误', details: parsed.error.flatten() }, 400);
  }

  try {
    const payload = buildArtifactPayload(parsed.data);
    const affixes = parsed.data.affixIds.map((affixId) => {
      const def = DEFAULT_AFFIX_REGISTRY.queryById(affixId);
      return {
        id: affixId,
        name: def?.displayName ?? affixId,
        description: def?.displayDescription ?? '',
        slot: def?.slot ?? '',
        rarity: def?.rarity ?? '',
      };
    });

    return c.json({
      success: true,
      payload,
      editorConfig: {
        slot: parsed.data.slot,
        element: parsed.data.element,
        quality: parsed.data.quality,
        realm: parsed.data.realm,
        realmStage: parsed.data.realmStage,
        affixIds: parsed.data.affixIds,
      },
      affixes,
    });
  } catch (error) {
    return c.json(
      { error: error instanceof Error ? error.message : '生成法宝预览失败' },
      400,
    );
  }
});

router.post('/:id/archive', requireAdmin(), async (c) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ error: '未授权访问' }, 401);
  }

  const item = await archiveItemLibraryEntry({
    id: c.req.param('id'),
    userId: user.id,
  });

  if (!item) {
    return c.json({ error: '道具不存在' }, 404);
  }

  return c.json({ success: true, item });
});

router.get('/:id', requireAdmin(), async (c) => {
  const item = await findItemLibraryById(c.req.param('id'));
  if (!item) {
    return c.json({ error: '道具不存在' }, 404);
  }
  return c.json({ item });
});

export default router;
