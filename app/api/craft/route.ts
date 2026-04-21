import {
  CreationServiceError,
  estimateCost,
  processCreation,
} from '@/lib/services/creationServiceV2';
import { withActiveCultivator } from '@/lib/api/withAuth';
import { CREATION_INPUT_CONSTRAINTS } from '@/engine/creation-v2/config/CreationBalance';
import { getExecutor } from '@/lib/drizzle/db';
import { materials } from '@/lib/drizzle/schema';
import { EQUIPMENT_SLOT_VALUES, Quality } from '@/types/constants';
import { inArray } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

/** craftType 值由 v2 引擎处理（炼器/神通/功法） */
const SUPPORTED_CRAFT_TYPES = new Set([
  'refine',
  'create_skill',
  'create_gongfa',
]);

const { minQuantityPerMaterial, maxQuantityPerMaterial } =
  CREATION_INPUT_CONSTRAINTS;

const CraftSchema = z.object({
  materialIds: z.array(z.string()).optional(),
  craftType: z.string(),
  /** materialId -> 本次实际投入数量（1..maxQuantityPerMaterial）。 */
  materialQuantities: z
    .record(
      z.string(),
      z
        .number()
        .int()
        .min(minQuantityPerMaterial)
        .max(maxQuantityPerMaterial),
    )
    .optional(),
  /** 玩家提示词，用于驱动 LLM 命名。 */
  userPrompt: z.string().trim().max(300).optional(),
  /** 仅炼器有效的目标槽位。 */
  requestedSlot: z.enum(EQUIPMENT_SLOT_VALUES).optional(),
});

/**
 * GET /api/craft?craftType=refine&materialIds=id1,id2,id3
 * 查询造物消耗预估
 */
export const GET = withActiveCultivator(
  async (request: NextRequest, { cultivator }) => {
    const { searchParams } = new URL(request.url);
    const materialIdsParam = searchParams.get('materialIds');
    const craftType = searchParams.get('craftType');

    if (!craftType) {
      return NextResponse.json({ error: '请指定造物类型' }, { status: 400 });
    }

    if (!SUPPORTED_CRAFT_TYPES.has(craftType)) {
      return NextResponse.json({ error: '无效的造物类型' }, { status: 400 });
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

    if (materialIdsParam && materialIdsParam.length > 0) {
      const materialIds = materialIdsParam.split(',');
      const materialsData = await getExecutor()
        .select()
        .from(materials)
        .where(inArray(materials.id, materialIds));

      if (materialsData.length === 0) {
        return NextResponse.json({ error: '未找到有效材料' }, { status: 400 });
      }

      cost = estimateCost(materialsData as Array<{ rank: Quality }>, craftType);
    } else {
      // 神通/功法在无选材预览时，回退到凡品基础消耗。
      cost = estimateCost([{ rank: '凡品' }], craftType);
    }

    if (cost.spiritStones !== undefined) {
      canAfford = (cultivator.spirit_stones || 0) >= cost.spiritStones;
    } else if (cost.comprehension !== undefined) {
      const progress = cultivator.cultivation_progress as {
        comprehension_insight?: number;
      } | null;
      canAfford = (progress?.comprehension_insight || 0) >= cost.comprehension;
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
 * 炼制物品/创建技能（仅 v2：refine / create_skill / create_gongfa）
 */
export const POST = withActiveCultivator(
  async (request: NextRequest, { cultivator }) => {
    try {
      const body = await request.json();
      const parsed = CraftSchema.safeParse(body);

      if (!parsed.success) {
        return NextResponse.json(
          { error: parsed.error.issues[0]?.message || '请求参数格式错误' },
          { status: 400 },
        );
      }

      const {
        materialIds,
        craftType,
        materialQuantities,
        userPrompt,
        requestedSlot,
      } = parsed.data;

      if (!SUPPORTED_CRAFT_TYPES.has(craftType)) {
        return NextResponse.json({ error: '无效的造物类型' }, { status: 400 });
      }

      if (
        !materialIds ||
        !Array.isArray(materialIds) ||
        materialIds.length === 0
      ) {
        return NextResponse.json(
          { error: '参数缺失，请选择材料' },
          { status: 400 },
        );
      }

      const result = await processCreation(
        cultivator.id,
        materialIds,
        craftType,
        {
          materialQuantities,
          userPrompt,
          requestedSlot,
        },
      );
      return NextResponse.json({ success: true, data: result });
    } catch (error) {
      if (error instanceof CreationServiceError) {
        return NextResponse.json(
          { error: error.message },
          { status: error.status },
        );
      }
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          { error: error.issues[0]?.message || '请求参数格式错误' },
          { status: 400 },
        );
      }

      return NextResponse.json(
        { error: '造物失败，请稍后再试。' },
        { status: 500 },
      );
    }
  },
);
