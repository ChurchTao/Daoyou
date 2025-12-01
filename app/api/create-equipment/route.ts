import { createClient } from '@/lib/supabase/server';
import { createEquipment } from '@/lib/repositories/cultivatorRepository';
import { generateCharacter } from '@/utils/aiClient';
import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/create-equipment
 * 生成装备
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
    const { cultivatorId, prompt } = body;

    // 输入验证
    if (
      !cultivatorId ||
      typeof cultivatorId !== 'string' ||
      !prompt ||
      typeof prompt !== 'string' ||
      prompt.trim().length < 5
    ) {
      return NextResponse.json(
        { error: '请提供有效的角色ID和装备描述' },
        { status: 400 }
      );
    }

    // 生成装备提示词
    const equipmentPrompt = `
请根据用户提示生成一件修仙装备，返回格式为JSON，包含以下字段：
- name: 装备名称
- type: 装备类型，只能是weapon、armor或accessory
- element: 装备元素，只能是金、木、水、火、土、雷或无
- bonus: 装备属性加成，包含vitality、spirit、wisdom、speed等属性
- specialEffect: 装备特殊效果描述

用户提示：${prompt}

示例输出：
{
  "name": "青木灵杖",
  "type": "weapon",
  "element": "木",
  "bonus": {
    "spirit": 10,
    "elementBoost": { "木": 0.3 }
  },
  "specialEffect": "木系技能威力 +30%"
}
`;

    // 调用AI生成装备
    const aiResponse = await generateCharacter(equipmentPrompt, prompt);
    const equipmentData = JSON.parse(aiResponse);

    // 验证AI生成的装备数据
    if (
      !equipmentData.name ||
      !['weapon', 'armor', 'accessory'].includes(equipmentData.type) ||
      !['金', '木', '水', '火', '土', '雷', '无'].includes(equipmentData.element)
    ) {
      return NextResponse.json(
        { error: '生成装备失败，AI返回格式不正确' },
        { status: 500 }
      );
    }

    // 创建装备
    const createdEquipment = await createEquipment(user.id, cultivatorId, equipmentData);

    return NextResponse.json({
      success: true,
      data: createdEquipment,
    });
  } catch (error) {
    console.error('生成装备 API 错误:', error);

    // 安全处理错误信息，避免泄露敏感信息
    const errorMessage =
      process.env.NODE_ENV === 'development'
        ? error instanceof Error
          ? error.message
          : '生成装备失败，请稍后重试'
        : '生成装备失败，请稍后重试';

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
