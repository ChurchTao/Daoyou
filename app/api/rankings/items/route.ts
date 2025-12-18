import { db } from '@/lib/drizzle/db';
import {
  artifacts,
  consumables,
  cultivators,
  skills,
} from '@/lib/drizzle/schema';
import { EquipmentSlot, SkillType } from '@/types/constants';
import { getEquipmentSlotLabel, getSkillTypeLabel } from '@/types/dictionaries';
import { ItemRankingEntry } from '@/types/rankings';
import { desc, eq, isNotNull } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type');

    if (!type || !['artifact', 'skill', 'elixir'].includes(type)) {
      return NextResponse.json({ success: false, error: '无效的榜单类型' });
    }

    let items: ItemRankingEntry[] = [];
    const LIMIT = 100;

    if (type === 'artifact') {
      const rows = await db
        .select({
          item: artifacts,
          owner: cultivators,
        })
        .from(artifacts)
        .leftJoin(cultivators, eq(artifacts.cultivatorId, cultivators.id))
        .where(isNotNull(artifacts.cultivatorId)) // ensure has owner
        .orderBy(desc(artifacts.score))
        .limit(LIMIT);

      items = rows.map(({ item, owner }, index) => ({
        id: item.id,
        rank: index + 1,
        name: item.name,
        type: getEquipmentSlotLabel(item.slot as EquipmentSlot),
        quality: item.quality,
        ownerName: owner?.name || '未知',
        score: item.score || 0,
        description: item.description || '',
        title: item.quality, // Use quality as subtitle/title
      }));
    } else if (type === 'skill') {
      const rows = await db
        .select({
          item: skills,
          owner: cultivators,
        })
        .from(skills)
        .leftJoin(cultivators, eq(skills.cultivatorId, cultivators.id))
        .where(isNotNull(skills.cultivatorId))
        .orderBy(desc(skills.score))
        .limit(LIMIT);

      items = rows.map(({ item, owner }, index) => ({
        id: item.id,
        rank: index + 1,
        name: item.name,
        type: `${getSkillTypeLabel(item.type as SkillType)}神通`,
        grade: item.grade || undefined,
        ownerName: owner?.name || '未知',
        score: item.score || 0,
        description: item.description || '',
        title: item.grade || '未知品阶',
      }));
    } else if (type === 'elixir') {
      const rows = await db
        .select({
          item: consumables,
          owner: cultivators,
        })
        .from(consumables)
        .leftJoin(cultivators, eq(consumables.cultivatorId, cultivators.id))
        .where(isNotNull(consumables.cultivatorId))
        .orderBy(desc(consumables.score))
        .limit(LIMIT);

      items = rows.map(({ item, owner }, index) => ({
        id: item.id,
        rank: index + 1,
        name: item.name,
        type: '丹药',
        quality: item.quality,
        ownerName: owner?.name || '未知',
        score: item.score || 0,
        description: item.description || '',
        title: item.quality,
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
