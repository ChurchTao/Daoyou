import { CreationEngine } from '@/engine/creation/CreationEngine';
import {
  calculateMaxQuality,
  getCostDescription,
} from '@/engine/creation/CraftCostCalculator';
import { materials } from '@/lib/drizzle/schema';
import { withActiveCultivator } from '@/lib/api/withAuth';
import { db } from '@/lib/drizzle/db';
import { NextRequest, NextResponse } from 'next/server';
import { inArray } from 'drizzle-orm';
import { z } from 'zod';

const creationEngine = new CreationEngine();

const CraftSchema = z.object({
  materialIds: z.array(z.string()).optional(),
  prompt: z.string().optional(),
  craftType: z.string(),
});

/**
 * GET /api/craft?craftType=alchemy&materialIds=id1,id2,id3
 * 查询造物消耗预估
 */
export const GET = withActiveCultivator(
  async (request: NextRequest, { cultivator }) => {
    const { searchParams } = new URL(request.url);
    const materialIdsParam = searchParams.get('materialIds');
    const craftType = searchParams.get('craftType');

    if (!craftType) {
      return NextResponse.json(
        { error: '请指定造物类型' },
        { status: 400 },
      );
    }

    if (
      craftType !== 'create_skill' &&
      craftType !== 'create_gongfa' &&
      (!materialIdsParam || materialIdsParam.length === 0)
    ) {
      return NextResponse.json(
        { error: '请选择材料以查询消耗' },
        { status: 400 },
      );
    }

    let cost: { spiritStones?: number; comprehension?: number };
    let canAfford = true;

    if (craftType === 'create_skill' || craftType === 'create_gongfa') {
      // 神通/功法不依赖材料，使用最低品质计算基础消耗
      cost = { comprehension: 10 }; // 凡品基础消耗
      const progress = cultivator.cultivation_progress as {
        comprehension_insight?: number;
      } | null;
      canAfford = (progress?.comprehension_insight || 0) >= (cost.comprehension || 0);
    } else {
      // 炼丹/炼器需要根据材料计算
      const materialIds = materialIdsParam!.split(',');
      const materialsData = await db
        .select()
        .from(materials)
        .where(inArray(materials.id, materialIds));

      if (materialsData.length === 0) {
        return NextResponse.json(
          { error: '未找到有效材料' },
          { status: 400 },
        );
      }

      const maxQuality = calculateMaxQuality(
        materialsData as Array<{ rank: any }>,
      );
      cost = getCostDescription(maxQuality, craftType);

      // 检查是否负担得起
      if (cost.spiritStones !== undefined) {
        canAfford = (cultivator.spirit_stones || 0) >= cost.spiritStones;
      } else if (cost.comprehension !== undefined) {
        const progress = cultivator.cultivation_progress as {
          comprehension_insight?: number;
        } | null;
        canAfford = (progress?.comprehension_insight || 0) >= cost.comprehension;
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        cost,
        canAfford,
      },
    });
  },
);

/**
 * POST /api/craft
 * 炼制物品/创建技能
 */
export const POST = withActiveCultivator(
  async (request: NextRequest, { user, cultivator }) => {
    const body = await request.json();
    const { materialIds, prompt, craftType } = CraftSchema.parse(body);

    if (craftType === 'create_skill') {
      if (!prompt) {
        return NextResponse.json(
          { error: '请注入神念，描述神通法门。' },
          { status: 400 },
        );
      }
      if (prompt.trim().length < 5 || prompt.trim().length > 200) {
        return NextResponse.json(
          { error: '神念长度应在5-200字之间。' },
          { status: 400 },
        );
      }
    } else if (
      !materialIds ||
      !Array.isArray(materialIds) ||
      materialIds.length === 0
    ) {
      return NextResponse.json(
        { error: '参数缺失，无法开炉' },
        { status: 400 },
      );
    }

    const result = await creationEngine.processRequest(
      user.id,
      cultivator.id,
      materialIds || [],
      prompt || '',
      craftType,
    );

    return NextResponse.json({ success: true, data: result });
  },
);
