import { createClient } from '@/lib/supabase/server';
import { getInventory } from '@/lib/repositories/cultivatorRepository';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/cultivators/:id/inventory
 * 获取角色物品栏
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id: cultivatorId } = await params;

    // 输入验证
    if (!cultivatorId || typeof cultivatorId !== 'string') {
      return NextResponse.json(
        { error: '请提供有效的角色ID' },
        { status: 400 }
      );
    }

    // 获取角色物品栏
    const inventory = await getInventory(user.id, cultivatorId);

    return NextResponse.json({
      success: true,
      data: inventory,
    });
  } catch (error) {
    console.error('获取角色物品栏 API 错误:', error);

    // 安全处理错误信息，避免泄露敏感信息
    const errorMessage =
      process.env.NODE_ENV === 'development'
        ? error instanceof Error
          ? error.message
          : '获取角色物品栏失败，请稍后重试'
        : '获取角色物品栏失败，请稍后重试';

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
