import { getCultivatorById } from '@/lib/repositories/cultivatorRepository';
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/enemies/[id]
 * 获取敌人数据（简化版，仅包含基础信息）
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // 获取实际的参数值
  const { id } = await params;
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

    // 输入验证
    if (!id || typeof id !== 'string') {
      return NextResponse.json(
        { error: '请提供有效的敌人ID' },
        { status: 400 },
      );
    }

    const enemy = await getCultivatorById(user.id, id);

    if (!enemy) {
      return NextResponse.json({ error: '敌人角色不存在' }, { status: 404 });
    }

    // 返回简化版的敌人数据，仅包含基础信息
    const { vitality, spirit, wisdom, speed, willpower } = enemy.attributes;
    const simplifiedEnemy = {
      id: enemy.id,
      name: enemy.name,
      realm: enemy.realm,
      realm_stage: enemy.realm_stage,
      spiritual_roots: enemy.spiritual_roots,
      background: enemy.background,
      // 计算战力（基于属性）
      combatRating: Math.round(
        (vitality + spirit + wisdom + speed + willpower) / 5,
      ),
      // 不返回详细的战斗属性、技能和装备信息
    };

    return NextResponse.json({
      success: true,
      data: simplifiedEnemy,
    });
  } catch (error) {
    console.error('获取敌人数据 API 错误:', error);

    // 安全处理错误信息，避免泄露敏感信息
    const errorMessage =
      process.env.NODE_ENV === 'development'
        ? error instanceof Error
          ? error.message
          : '获取敌人数据失败，请稍后重试'
        : '获取敌人数据失败，请稍后重试';

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
