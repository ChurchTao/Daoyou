import { withAuth } from '@/lib/api/withAuth';
import {
  deleteCultivator,
  getCultivatorById,
  getCultivatorsByUserId,
  hasDeadCultivator,
} from '@/lib/repositories/cultivatorRepository';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/cultivators
 * 获取用户的所有角色
 */
export const GET = withAuth(async (request: NextRequest, { user }) => {
  // 获取角色ID参数（可选）
  const searchParams = request.nextUrl.searchParams;
  const cultivatorId = searchParams.get('id');

  if (cultivatorId) {
    // 获取单个角色
    const cultivator = await getCultivatorById(user.id, cultivatorId);

    if (!cultivator) {
      return NextResponse.json({ error: '角色不存在' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: cultivator,
    });
  } else {
    // 当前设计下仅允许单活跃角色；保持数组结构兼容前端
    const cultivators = await getCultivatorsByUserId(user.id);
    const deadExists = await hasDeadCultivator(user.id);

    return NextResponse.json({
      success: true,
      data: cultivators,
      meta: {
        hasActive: cultivators.length > 0,
        hasDead: deadExists,
      },
    });
  }
});

/**
 * DELETE /api/cultivators
 * 删除角色
 */
export const DELETE = withAuth(async (request: NextRequest, { user }) => {
  // 获取角色ID参数
  const searchParams = request.nextUrl.searchParams;
  const cultivatorId = searchParams.get('id');

  if (!cultivatorId) {
    return NextResponse.json({ error: '请提供角色ID' }, { status: 400 });
  }

  // 删除角色
  const success = await deleteCultivator(user.id, cultivatorId);

  if (!success) {
    return NextResponse.json(
      { error: '删除角色失败或角色不存在' },
      { status: 404 },
    );
  }

  return NextResponse.json({
    success: true,
    message: '角色删除成功',
  });
});
