import { createClient } from '@/lib/supabase/server';
import { getCultivatorsByUserId, saveTempCultivatorToFormal } from '@/lib/repositories/cultivatorRepository';
import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/save-character
 * 将临时角色保存到正式表
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
    const { tempCultivatorId } = body;

    // 输入验证
    if (!tempCultivatorId || typeof tempCultivatorId !== 'string') {
      return NextResponse.json(
        { error: '请提供有效的临时角色ID' },
        { status: 400 }
      );
    }

    // 检查用户是否已有角色
    const existingCultivators = await getCultivatorsByUserId(user.id);
    if (existingCultivators.length > 0) {
      return NextResponse.json({ error: '您已经拥有一位道身，无法创建新的道身' }, { status: 400 });
    }

    // 将临时角色保存到正式表
    const cultivator = await saveTempCultivatorToFormal(user.id, tempCultivatorId);

    return NextResponse.json({
      success: true,
      data: cultivator,
    });
  } catch (error) {
    console.error('保存角色 API 错误:', error);

    // 安全处理错误信息，避免泄露敏感信息
    const errorMessage =
      process.env.NODE_ENV === 'development'
        ? error instanceof Error
          ? error.message
          : '保存角色失败，请稍后重试'
        : '保存角色失败，请稍后重试';

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
