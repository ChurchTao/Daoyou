import { deserializeAbilityConfig } from '@/engine/creation-v2/persistence/ProductPersistenceMapper';
import { getExecutor } from '@/lib/drizzle/db';
import {
  consumables,
  creationProducts,
  cultivators,
} from '@/lib/drizzle/schema';
import {
  EquipmentSlot,
  QUALITY_VALUES,
} from '@/types/constants';
import { getEquipmentSlotLabel } from '@/types/dictionaries';
import { ItemRankingEntry } from '@/types/rankings';
import { and, desc, eq, inArray, isNotNull } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type');

    if (!type || !['artifact', 'skill', 'elixir', 'technique'].includes(type)) {
      return NextResponse.json({ success: false, error: '无效的榜单类型' });
    }

    let items: ItemRankingEntry[] = [];
    const LIMIT = 100;

    // Filter logic: Only Xuan (玄) grade or higher
    // For artifacts/elixirs: QUALITY_VALUES index >= 2
    const validQualities = QUALITY_VALUES.slice(2);
    // Unified products also use quality as the visible ranking threshold.
    const validProductQualities = QUALITY_VALUES.slice(2);

    if (type === 'artifact') {
      const rows = await getExecutor()
        .select({
          item: creationProducts,
          owner: cultivators,
        })
        .from(creationProducts)
        .leftJoin(cultivators, eq(creationProducts.cultivatorId, cultivators.id))
        .where(
          and(
            isNotNull(creationProducts.cultivatorId),
            eq(creationProducts.productType, 'artifact'),
            inArray(creationProducts.quality, validQualities as string[]),
          ),
        ) // ensure has owner and high quality
        .orderBy(desc(creationProducts.score))
        .limit(LIMIT);

      items = rows.map(({ item, owner }, index) => ({
        id: item.id,
        rank: index + 1,
        name: item.name,
        itemType: 'artifact',
        type: getEquipmentSlotLabel(item.slot as EquipmentSlot),
        quality: item.quality ?? undefined,
        ownerName: owner?.name || '未知',
        score: item.score || 0,
        description: item.description || '',
        title: item.quality ?? undefined,
        element: item.element ?? undefined,
        slot: item.slot ?? undefined,
      }));
    } else if (type === 'skill') {
      const rows = await getExecutor()
        .select({
          item: creationProducts,
          owner: cultivators,
        })
        .from(creationProducts)
        .leftJoin(cultivators, eq(creationProducts.cultivatorId, cultivators.id))
        .where(
          and(
            isNotNull(creationProducts.cultivatorId),
            eq(creationProducts.productType, 'skill'),
            inArray(creationProducts.quality, validProductQualities as string[]),
          ),
        )
        .orderBy(desc(creationProducts.score))
        .limit(LIMIT);

      items = rows.map(({ item, owner }, index) => {
        const abilityConfig = deserializeAbilityConfig(
          (item.abilityConfig ?? {}) as Record<string, unknown>,
          item.id,
        );

        return {
          id: item.id,
          rank: index + 1,
          name: item.name,
          itemType: 'skill',
          type: item.element ? `${item.element}系神通` : '神通',
          quality: (item.quality as string | undefined) || undefined,
          ownerName: owner?.name || '未知',
          score: item.score || 0,
          description: item.description || '',
          title: item.quality || '未知品阶',
          element: item.element ?? undefined,
          cooldown: abilityConfig.cooldown ?? 0,
          cost: abilityConfig.mpCost || 0,
        };
      });
    } else if (type === 'elixir') {
      const rows = await getExecutor()
        .select({
          item: consumables,
          owner: cultivators,
        })
        .from(consumables)
        .leftJoin(cultivators, eq(consumables.cultivatorId, cultivators.id))
        .where(
          and(
            isNotNull(consumables.cultivatorId),
            eq(consumables.type, '丹药'),
            inArray(consumables.quality, validQualities as string[]),
          ),
        )
        .orderBy(desc(consumables.score))
        .limit(LIMIT);

      items = rows.map(({ item, owner }, index) => ({
        id: item.id,
        rank: index + 1,
        name: item.name,
        itemType: 'elixir',
        type: '丹药',
        quality: item.quality ?? undefined,
        ownerName: owner?.name || '未知',
        score: item.score || 0,
        description: item.description || '',
        title: item.quality ?? undefined,
        quantity: item.quantity,
      }));
    } else if (type === 'technique') {
      const rows = await getExecutor()
        .select({
          item: creationProducts,
          owner: cultivators,
        })
        .from(creationProducts)
        .leftJoin(
          cultivators,
          eq(creationProducts.cultivatorId, cultivators.id),
        )
        .where(
          and(
            isNotNull(creationProducts.cultivatorId),
            eq(creationProducts.productType, 'gongfa'),
            inArray(creationProducts.quality, validProductQualities as string[]),
          ),
        )
        .orderBy(desc(creationProducts.score))
        .limit(LIMIT);

      items = rows.map(({ item, owner }, index) => ({
        id: item.id,
        rank: index + 1,
        name: item.name,
        itemType: 'technique',
        type: '功法',
        quality: (item.quality as string | undefined) || undefined,
        ownerName: owner?.name || '未知',
        score: item.score || 0,
        description: item.description || '',
        title: item.quality || '未知品阶',
      }));
    }

    return NextResponse.json({
      success: true,
      data: items,
    });
  } catch (error) {
    console.error('获取排行榜失败:', error);
    return NextResponse.json({
      success: false,
      error: '获取排行榜失败',
    });
  }
}
