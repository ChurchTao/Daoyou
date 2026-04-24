import {
  CreationServiceError,
  estimateCost,
  previewCreationSelection,
  processCreation,
} from '../../../lib/services/creationServiceV2';
import { withActiveCultivator } from '@/lib/api/withAuth';
import { CREATION_INPUT_CONSTRAINTS } from '@/engine/creation-v2/config/CreationBalance';
import { CREATION_CRAFT_TYPES, isCreationCraftType } from '@/engine/creation-v2/config/CreationCraftPolicy';
import { EQUIPMENT_SLOT_VALUES, Quality } from '@/types/constants';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const { minQuantityPerMaterial, maxQuantityPerMaterial } =
  CREATION_INPUT_CONSTRAINTS;

const CraftSchema = z.object({
  materialIds: z.array(z.string()).optional(),
  craftType: z.enum(CREATION_CRAFT_TYPES),
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
  /** 仅神通有效：目标策略。 */
  requestedTargetPolicy: z.object({
    team: z.enum(['enemy', 'ally', 'self', 'any']),
    scope: z.enum(['single', 'aoe', 'random']),
    maxTargets: z.number().int().min(1).optional(),
  }).optional(),
});

/**
 * GET /api/craft?craftType=refine&materialIds=id1,id2,id3
 * 查询造物消耗预估
 */
export const GET = withActiveCultivator(
  async (request: NextRequest, { cultivator }) => {
    try {
      const { searchParams } = new URL(request.url);
      const materialIdsParam = searchParams.get('materialIds');
      const craftType = searchParams.get('craftType');

      if (!craftType) {
        return NextResponse.json({ error: '请指定造物类型' }, { status: 400 });
      }

      if (!isCreationCraftType(craftType)) {
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
      let validation: Awaited<
        ReturnType<typeof previewCreationSelection>
      >['validation'] | null = null;

      if (materialIdsParam && materialIdsParam.length > 0) {
        const materialIds = materialIdsParam.split(',');
        const preview = await previewCreationSelection(
          cultivator.id,
          materialIds,
          craftType,
        );

        cost = estimateCost(
          preview.materials as Array<{ rank: Quality }>,
          craftType,
        );
        validation = preview.validation;
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
          validation,
        },
      });
    } catch (error) {
      if (error instanceof CreationServiceError) {
        return NextResponse.json(
          { error: error.message },
          { status: error.status },
        );
      }

      return NextResponse.json(
        { error: '消耗预估失败，请稍后再试。' },
        { status: 500 },
      );
    }
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
        requestedTargetPolicy,
      } = parsed.data;

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
          requestedTargetPolicy,
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
