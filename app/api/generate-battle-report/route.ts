import { NextRequest, NextResponse } from 'next/server';
import { generateBattleReport } from '../../../utils/aiClient';
import { getBattleReportPrompt } from '../../../utils/prompts';
import type { Cultivator } from '../../../types/cultivator';

/**
 * POST /api/generate-battle-report
 * 生成战斗播报
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { cultivatorA, cultivatorB, winner } = body;

    if (!cultivatorA || !cultivatorB || !winner) {
      return NextResponse.json(
        { error: '请提供完整的角色信息' },
        { status: 400 }
      );
    }

    // 验证角色数据
    const playerA = cultivatorA as Cultivator;
    const playerB = cultivatorB as Cultivator;
    const winnerCultivator = winner as Cultivator;

    // 生成战斗播报 prompt
    const prompt = getBattleReportPrompt(playerA, playerB, winnerCultivator);

    // 调用 AI 生成战斗播报
    const report = await generateBattleReport(prompt);

    return NextResponse.json({ 
      success: true,
      data: report 
    });
  } catch (error) {
    console.error('生成战斗播报 API 错误:', error);
    
    const errorMessage = error instanceof Error 
      ? error.message 
      : '生成战斗播报失败，请稍后重试';

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

