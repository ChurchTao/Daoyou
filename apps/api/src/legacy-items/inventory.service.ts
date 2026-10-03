import {
  ELEMENT_VALUES,
  MATERIAL_TYPE_VALUES,
  QUALITY_VALUES,
  type ElementType,
  type MaterialType,
  type Quality,
} from '@daoyou/shared/types/constants';
import { HttpException, Inject, Injectable } from '@nestjs/common';
import { getPaginatedInventoryByType } from '@server/cultivator/application/readers/CultivatorInventoryRepository.js';
import { DRIZZLE_DATABASE } from '@server/database/database.service.js';
import { discardInventoryItem } from '@server/inventory/application/InventoryApplicationService.js';
import type { ActiveCultivatorRef } from '@server/lib/auth/types.js';
import type { DbClient } from '@server/lib/drizzle/db.js';
import { toPlayerStateMutationResponse } from '@server/player/application/state/ResourceMutationResponse.js';
import { readResourceWithMeta } from '@server/player/application/state/ResourceReadService.js';
import { z } from 'zod';
const DiscardSchema = z.object({
  itemId: z.string(),
  itemType: z.enum(['artifact', 'consumable', 'material']),
});
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
@Injectable()
export class LegacyInventoryService {
  constructor(@Inject(DRIZZLE_DATABASE) private readonly database: DbClient) {}
  async list(
    actor: ActiveCultivatorRef,
    query: Record<string, string | undefined>,
  ) {
    const type = query['type'];
    if (!type) {
      throw new HttpException(
        { success: false, error: '必须指定背包类型和分页参数' },
        400,
      );
    }
    if (!['artifacts', 'materials', 'consumables'].includes(type)) {
      throw new HttpException(
        {
          success: false,
          error: '无效的背包类型，仅支持 artifacts | materials | consumables',
        },
        400,
      );
    }
    const page = Math.max(1, parseInt(query['page'] || '1', 10));
    const pageSize = Math.min(
      100,
      Math.max(1, parseInt(query['pageSize'] || '20', 10)),
    );
    const consumableKind = query['consumableKind'];
    if (consumableKind && consumableKind !== 'pill') {
      throw new HttpException(
        { success: false, error: '无效的消耗品分类' },
        400,
      );
    }
    let materialTypes: MaterialType[] | undefined;
    let excludeMaterialTypes: MaterialType[] | undefined;
    let materialRanks: Quality[] | undefined;
    let materialElements: ElementType[] | undefined;
    try {
      materialTypes = parseList(
        query['materialTypes'] ?? null,
        MATERIAL_TYPE_VALUES,
        '材料类型',
      );
      excludeMaterialTypes = parseList(
        query['excludeMaterialTypes'] ?? null,
        MATERIAL_TYPE_VALUES,
        '材料类型',
      );
      materialRanks = parseList(
        query['materialRanks'] ?? null,
        QUALITY_VALUES,
        '材料品级',
      );
      materialElements = parseList(
        query['materialElements'] ?? null,
        ELEMENT_VALUES,
        '材料属性',
      );
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          error:
            error instanceof Error ? error.message : '材料类型参数解析失败',
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
    const materialSortBy = query['materialSortBy'];
    const materialSortOrder = query['materialSortOrder'];
    if (
      materialSortBy &&
      !validSortBy.includes(materialSortBy as (typeof validSortBy)[number])
    ) {
      throw new HttpException(
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
      throw new HttpException(
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
      materialSortBy: materialSortBy as
        (typeof validSortBy)[number] | undefined,
      materialSortOrder: materialSortOrder as 'asc' | 'desc' | undefined,
      consumableKind: consumableKind as 'pill' | undefined,
    };
    const scope = { kind: 'cultivator' as const, id: actor.cultivatorId };
    if (type === 'artifacts') {
      return await readResourceWithMeta(
        scope,
        'inventory.artifacts',
        (q) =>
          getPaginatedInventoryByType(
            actor.userId,
            actor.cultivatorId,
            { ...options, type: 'artifacts' },
            q,
          ),
        this.database,
      );
    }
    if (type === 'materials') {
      return await readResourceWithMeta(
        scope,
        'inventory.materials',
        (q) =>
          getPaginatedInventoryByType(
            actor.userId,
            actor.cultivatorId,
            { ...options, type: 'materials' },
            q,
          ),
        this.database,
      );
    }
    return await readResourceWithMeta(
      scope,
      'inventory.consumables',
      (q) =>
        getPaginatedInventoryByType(
          actor.userId,
          actor.cultivatorId,
          { ...options, type: 'consumables' },
          q,
        ),
      this.database,
    );
  }
  async discard(actor: ActiveCultivatorRef, body: unknown) {
    const { itemId, itemType } = DiscardSchema.parse(body);
    if (itemType === 'artifact') {
      throw new HttpException(
        { success: false, error: '历史法宝已停用，仅支持查看' },
        410,
      );
    }
    const committed = await discardInventoryItem({
      actor: { userId: actor.userId, cultivatorId: actor.cultivatorId },
      itemId,
      itemType,
    });
    return toPlayerStateMutationResponse(committed);
  }
}
