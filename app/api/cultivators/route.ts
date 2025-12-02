import {
  deleteCultivator,
  getCultivatorById,
  getCultivatorsByUserId,
} from '@/lib/repositories/cultivatorRepository';
import { createClient } from '@/lib/supabase/server';
import { calculateFinalAttributes } from '@/utils/cultivatorUtils';
import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/cultivators
 * 获取用户的所有角色
 */
export async function GET(request: NextRequest) {
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

    // 获取角色ID参数（可选）
    const searchParams = request.nextUrl.searchParams;
    const cultivatorId = searchParams.get('id');

    if (cultivatorId) {
      // 获取单个角色
      const cultivator = await getCultivatorById(user.id, cultivatorId);

      if (!cultivator) {
        return NextResponse.json({ error: '角色不存在' }, { status: 404 });
      }

      // 计算最终属性
      const finalAttrs = calculateFinalAttributes(cultivator);

      return NextResponse.json({
        success: true,
        data: {
          ...cultivator,
          finalAttributes: finalAttrs.final,
          attributeBreakdown: finalAttrs.breakdown,
        },
      });
    } else {
      // 获取所有角色
      const cultivators = await getCultivatorsByUserId(user.id);

      // 为每个角色计算最终属性
      const cultivatorsWithFinalAttrs = cultivators.map((c) => {
        const finalAttrs = calculateFinalAttributes(c);
        return {
          ...c,
          finalAttributes: finalAttrs.final,
          attributeBreakdown: finalAttrs.breakdown,
        };
      });

      return NextResponse.json({
        success: true,
        data: cultivatorsWithFinalAttrs,
      });
    }
  } catch (error) {
    console.error('获取角色 API 错误:', error);

    // 安全处理错误信息，避免泄露敏感信息
    const errorMessage =
      process.env.NODE_ENV === 'development'
        ? error instanceof Error
          ? error.message
          : '获取角色失败，请稍后重试'
        : '获取角色失败，请稍后重试';

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

/**
 * DELETE /api/cultivators
 * 删除角色
 */
export async function DELETE(request: NextRequest) {
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
  } catch (error) {
    console.error('删除角色 API 错误:', error);

    // 安全处理错误信息，避免泄露敏感信息
    const errorMessage =
      process.env.NODE_ENV === 'development'
        ? error instanceof Error
          ? error.message
          : '删除角色失败，请稍后重试'
        : '删除角色失败，请稍后重试';

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
