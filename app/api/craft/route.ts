import { CreationEngine } from '@/engine/creation/CreationEngine';
import { withActiveCultivator } from '@/lib/api/withAuth';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const creationEngine = new CreationEngine();

const CraftSchema = z.object({
  materialIds: z.array(z.string()).optional(),
  prompt: z.string().optional(),
  craftType: z.string(),
});

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
