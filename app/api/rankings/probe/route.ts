import { CultivatorUnit } from '@/engine/cultivator';
import { withActiveCultivator } from '@/lib/api/withAuth';
import { getCultivatorByIdUnsafe } from '@/lib/services/cultivatorService';
import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/rankings/probe
 * 神识查探目标角色
 */
export const POST = withActiveCultivator(
  async (request: NextRequest, { cultivator: selfCultivator }) => {
    try {
      // selfCultivator 保留供将来神识对比使用
      void selfCultivator;
      const body = await request.json();
      const { targetId } = body;

      if (!targetId || typeof targetId !== 'string') {
        return NextResponse.json(
          { error: '请提供有效的目标角色ID' },
          { status: 400 },
        );
      }

      // 获取目标角色（跨用户，系统级回表）
      const targetRecord = await getCultivatorByIdUnsafe(targetId);
      if (!targetRecord) {
        return NextResponse.json(
          { error: '目标角色不存在或不可查探' },
          { status: 404 },
        );
      }
      const targetCultivator = targetRecord.cultivator;

      // 神识对比（使用最终属性中的意志/神识）
      const targetUnit = new CultivatorUnit(targetCultivator);
      const targetFinal = targetUnit.getFinalAttributes();

      // const selfUnit = new CultivatorUnit(selfCultivator);
      // const _selfFinal = selfUnit.getFinalAttributes(); // 保留供将来神识对比使用

      // todo 神识查探先关闭
      // if (_selfFinal.willpower <= targetFinal.willpower) {
      //   return NextResponse.json(
      //     { error: '你的神识不足，未能窥破对方底细' },
      //     { status: 403 },
      //   );
      // }

      return NextResponse.json({
        success: true,
        data: {
          cultivator: targetCultivator,
          finalAttributes: targetFinal,
        },
      });
    } catch (error) {
      console.error('神识查探错误:', error);
      const errorMessage =
        process.env.NODE_ENV === 'development'
          ? error instanceof Error
            ? error.message
            : '神识查探失败'
          : '神识查探失败，请稍后重试';

      return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
  },
);
