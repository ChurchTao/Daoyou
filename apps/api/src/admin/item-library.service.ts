import { HttpException, Injectable } from '@nestjs/common';
import {
  getItemLibraryDailyMaterialGenerationSettings,
  upsertItemLibraryDailyMaterialGenerationSettings,
} from '@server/lib/repositories/appSettingsRepository.js';
import {
  archiveItemLibraryEntry,
  createItemLibraryEntry,
  findItemLibraryById,
  listItemLibrary,
  normalizeItemLibraryFilters,
  updateItemLibraryEntry,
} from '@server/lib/repositories/itemLibraryRepository.js';
import {
  generateMaterialLibraryEntries,
  generateSpiritSeedLibraryEntries,
} from '@server/admin/application/MaterialLibraryService.js';
import { ItemLibraryDailyMaterialGenerationSettingsSchema } from '@daoyou/shared/lib/constants/appSettings';
import {
  CreateItemLibraryEntrySchema,
  ItemLibraryListQuerySchema,
  ItemLibraryMaterialGenerateSchema,
  ItemLibrarySpiritSeedGenerateSchema,
  UpdateItemLibraryEntrySchema,
} from '@daoyou/shared/lib/itemLibrary';

function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const maybe = error as {
    code?: string;
  };
  return maybe.code === '23505';
}
@Injectable()
export class AdminItemLibraryService {
  async list(query: Record<string, string | undefined>) {
    const parsed = ItemLibraryListQuerySchema.safeParse({
      status: query['status'] || undefined,
      type: 'material',
      materialType: query['materialType'] || undefined,
      quality: query['quality'] || undefined,
      q: query['q'] || undefined,
      itemIds: query['itemIds'] || undefined,
      page: query['page'] || undefined,
      pageSize: query['pageSize'] || undefined,
    });
    if (!parsed.success) {
      throw new HttpException(
        { error: '参数错误', details: parsed.error.flatten() },
        400,
      );
    }
    const result = await listItemLibrary(
      normalizeItemLibraryFilters(parsed.data),
    );
    return result;
  }
  async generateMaterials(userId: string, inputBody: unknown) {
    const body = inputBody;
    const parsed = ItemLibraryMaterialGenerateSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpException(
        { error: '参数错误', details: parsed.error.flatten() },
        400,
      );
    }
    try {
      const items = await generateMaterialLibraryEntries({
        request: parsed.data,
        userId: userId,
      });
      return { success: true, items, generated: items.length };
    } catch (error) {
      throw new HttpException(
        { error: error instanceof Error ? error.message : '批量生成材料失败' },
        500,
      );
    }
  }
  async generateSeeds(userId: string, inputBody: unknown) {
    const body = inputBody;
    const parsed = ItemLibrarySpiritSeedGenerateSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpException(
        { error: '参数错误', details: parsed.error.flatten() },
        400,
      );
    }
    try {
      const items = await generateSpiritSeedLibraryEntries({
        request: parsed.data,
        userId: userId,
      });
      return { success: true, items, generated: items.length };
    } catch (error) {
      throw new HttpException(
        { error: error instanceof Error ? error.message : '批量生成灵种失败' },
        500,
      );
    }
  }
  async settings() {
    const settings = await getItemLibraryDailyMaterialGenerationSettings();
    return { settings };
  }
  async updateSettings(userId: string, inputBody: unknown) {
    const body = inputBody;
    const parsed =
      ItemLibraryDailyMaterialGenerationSettingsSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpException(
        { error: '参数错误', details: parsed.error.flatten() },
        400,
      );
    }
    await upsertItemLibraryDailyMaterialGenerationSettings({
      settings: parsed.data,
      updatedBy: userId,
    });
    return { success: true, settings: parsed.data };
  }
  async create(userId: string, inputBody: unknown) {
    const body = inputBody;
    if ((body as { type?: unknown } | null)?.type !== 'material')
      throw new HttpException(
        { error: '旧法宝与消耗品库已停用，请直接配置新版奖励' },
        410,
      );
    const parsed = CreateItemLibraryEntrySchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpException(
        { error: '参数错误', details: parsed.error.flatten() },
        400,
      );
    }
    try {
      const entry = await createItemLibraryEntry({
        entry: parsed.data,
        userId: userId,
      });
      return { success: true, item: entry };
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new HttpException({ error: '道具 ID 已存在' }, 409);
      }
      throw new HttpException(
        { error: error instanceof Error ? error.message : '创建道具失败' },
        400,
      );
    }
  }
  async update(userId: string, idParam: string, inputBody: unknown) {
    const id = idParam;
    const existing = await findItemLibraryById(id);
    if (existing && existing.type !== 'material')
      throw new HttpException(
        { error: '旧法宝与消耗品库已停用，请直接配置新版奖励' },
        410,
      );
    const body = inputBody;
    if ((body as { type?: unknown } | null)?.type !== 'material')
      throw new HttpException(
        { error: '旧法宝与消耗品库已停用，请直接配置新版奖励' },
        410,
      );
    const parsed = UpdateItemLibraryEntrySchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpException(
        { error: '参数错误', details: parsed.error.flatten() },
        400,
      );
    }
    try {
      const item = await updateItemLibraryEntry({
        id,
        entry: parsed.data,
        userId: userId,
      });
      if (!item) {
        throw new HttpException({ error: '道具不存在' }, 404);
      }
      return { success: true, item };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        { error: error instanceof Error ? error.message : '更新道具失败' },
        400,
      );
    }
  }
  async archive(userId: string, idParam: string) {
    const existing = await findItemLibraryById(idParam);
    if (!existing || existing.type !== 'material')
      throw new HttpException({ error: '材料不存在' }, 404);
    const item = await archiveItemLibraryEntry({
      id: idParam,
      userId: userId,
    });
    if (!item || item.type !== 'material') {
      throw new HttpException({ error: '道具不存在' }, 404);
    }
    return { success: true, item };
  }
  async detail(idParam: string) {
    const item = await findItemLibraryById(idParam);
    if (!item || item.type !== 'material') {
      throw new HttpException({ error: '道具不存在' }, 404);
    }
    return { item };
  }
}
