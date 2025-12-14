import {
  createCultivator,
  getCultivatorsByUserId,
} from '@/lib/repositories/cultivatorRepository';
import {
  deleteTempData,
  getTempCharacter,
  getTempFates,
} from '@/lib/repositories/redisCultivatorRepository';
import { createClient } from '@/lib/supabase/server';
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
    const { tempCultivatorId, selectedFateIndices } = body;

    // 输入验证
    if (!tempCultivatorId || typeof tempCultivatorId !== 'string') {
      return NextResponse.json(
        { error: '请提供有效的临时角色ID' },
        { status: 400 },
      );
    }

    // 验证选中的气运索引
    if (
      !selectedFateIndices ||
      !Array.isArray(selectedFateIndices) ||
      selectedFateIndices.length !== 3
    ) {
      return NextResponse.json({ error: '请选择3个先天气运' }, { status: 400 });
    }

    // 检查用户是否已有角色
    const existingCultivators = await getCultivatorsByUserId(user.id);
    if (existingCultivators.length > 0) {
      return NextResponse.json(
        { error: '您已经拥有一位道身，无法创建新的道身' },
        { status: 400 },
      );
    }

    // 从Redis获取临时数据
    const [cultivator, availableFates] = await Promise.all([
      getTempCharacter(tempCultivatorId),
      getTempFates(tempCultivatorId),
    ]);

    if (!cultivator) {
      return NextResponse.json(
        { error: '角色数据已过期，请重新生成' },
        { status: 400 },
      );
    }

    // 处理气运
    if (selectedFateIndices && selectedFateIndices.length === 3) {
      // 如果没有生成过气运（比如旧流程或者异常），则需要处理
      if (!availableFates) {
        return NextResponse.json(
          { error: '气运数据丢失，请重新生成' },
          { status: 400 },
        );
      }

      const selectedFates = selectedFateIndices
        .filter((idx: number) => idx >= 0 && idx < availableFates.length)
        .map((idx: number) => availableFates[idx]);

      if (selectedFates.length !== 3) {
        return NextResponse.json({ error: '气运选择有误' }, { status: 400 });
      }

      cultivator.pre_heaven_fates = selectedFates;
    }

    // 保存到正式表
    await createCultivator(user.id, cultivator);

    // 清理Redis临时数据
    await deleteTempData(tempCultivatorId);

    return NextResponse.json({
      success: true,
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
