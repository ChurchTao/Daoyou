import { createClient } from '@/lib/supabase/server';
import { getCultivatorById } from '@/lib/repositories/cultivatorRepository';
import { simulateBattle } from '@/engine/battleEngine';
import { mockRankings } from '@/data/mockRankings';
import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/generate-battle
 * 生成战斗结果
 */
export async function POST(request: NextRequest) {
  try {
    // 创建Supabase客户端，用于验证用户身份
    const supabase = await createClient();

    // 获取当前用户，验证用户身份
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    const body = await request.json();
    const { cultivatorId, opponentId } = body;

    // 输入验证
    if (
      !cultivatorId ||
      typeof cultivatorId !== 'string' ||
      !opponentId ||
      typeof opponentId !== 'string'
    ) {
      return NextResponse.json(
        { error: '请提供有效的角色ID和对手ID' },
        { status: 400 }
      );
    }

    // 获取玩家角色信息
    const player = await getCultivatorById(user.id, cultivatorId);
    if (!player) {
      return NextResponse.json({ error: '玩家角色不存在' }, { status: 404 });
    }

    // 获取对手角色信息
    let opponent;
    // 检查是否为mock敌人（id以mock-开头）
    if (opponentId.startsWith('mock-')) {
      // 从mock数据中获取对手
      opponent = mockRankings.find(r => r.id === opponentId);
      if (!opponent) {
        return NextResponse.json({ error: '对手角色不存在' }, { status: 404 });
      }
    } else {
      // 从数据库中获取对手
      opponent = await getCultivatorById(user.id, opponentId);
      if (!opponent) {
        return NextResponse.json({ error: '对手角色不存在' }, { status: 404 });
      }
    }

    const battleResult = simulateBattle(player, opponent);

    return NextResponse.json({
      success: true,
      data: battleResult,
    });
  } catch (error) {
    console.error('生成战斗结果 API 错误:', error);

    // 安全处理错误信息，避免泄露敏感信息
    const errorMessage =
      process.env.NODE_ENV === 'development'
        ? error instanceof Error
          ? error.message
          : '生成战斗结果失败，请稍后重试'
        : '生成战斗结果失败，请稍后重试';

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
