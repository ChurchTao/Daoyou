import {
  abandonPending,
  confirmCreation,
  CreationServiceError,
} from '../../../../lib/services/creationServiceV2';
import { CREATION_CRAFT_TYPES } from '@/engine/creation-v2/config/CreationCraftPolicy';
import { withActiveCultivator } from '@/lib/api/withAuth';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const ConfirmSchema = z.object({
  craftType: z.enum(CREATION_CRAFT_TYPES),
  replaceId: z.uuid().nullable().optional(),
  abandon: z.boolean().optional(),
});

/**
 * POST /api/craft/confirm
 * 确认替换或放弃待确认的 v2 产物（神通/功法/法宝）
 *
 * Body:
 *   craftType: 'create_skill' | 'create_gongfa' | 'refine'
 *   replaceId?: string   // 要替换掉的 v2 产物 ID（不传则直接追加）
 *   abandon?: boolean    // true 表示放弃新产物
 */
export const POST = withActiveCultivator(
  async (request: NextRequest, { cultivator }) => {
    try {
      const body = await request.json();
      const { craftType, replaceId, abandon } = ConfirmSchema.parse(body);

      if (abandon) {
        await abandonPending(cultivator.id, craftType);
        return NextResponse.json({
          success: true,
          message: '已放弃新生成的感悟',
        });
      }

      const result = await confirmCreation(
        cultivator.id,
        craftType,
        replaceId ?? null,
      );

      return NextResponse.json({
        success: true,
        message: '领悟成功，已纳入道基',
        data: result,
      });
    } catch (e) {
      if (e instanceof z.ZodError) {
        return NextResponse.json(
          { error: e.issues[0]?.message || '请求参数格式错误' },
          { status: 400 },
        );
      }
      if (e instanceof CreationServiceError) {
        return NextResponse.json({ error: e.message }, { status: e.status });
      }
      console.error('确认替换失败:', e);
      return NextResponse.json(
        { error: '确认失败，请稍后重试' },
        { status: 500 },
      );
    }
  },
);
