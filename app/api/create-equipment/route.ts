import { createEquipment } from '@/lib/repositories/cultivatorRepository';
import { createClient } from '@/lib/supabase/server';
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
        { status: 400 },
      );
    }

    // 生成装备提示词（基于新的 Artifact 结构）
    const equipmentPrompt = `
请根据用户提示生成一件修仙装备（法宝），返回格式为JSON，包含以下字段：
- name: 装备名称
- slot: 装备槽位，只能是 weapon、armor 或 accessory
- element: 装备元素，只能是 金、木、水、火、土、风、雷、冰、无
- bonus: 装备属性加成对象，可包含 vitality、spirit、wisdom、speed、willpower（都是整数）
- special_effects: 特殊效果数组（可选），每个效果格式：{ "type": "on_hit_add_effect", "effect": "burn", "chance": 30 }
- curses: 负面效果数组（可选），格式同上

用户提示：${prompt}

示例输出：
{
  "name": "青木灵杖",
  "slot": "weapon",
  "element": "木",
  "bonus": {
    "spirit": 15,
    "wisdom": 10
  },
  "special_effects": [
    {
      "type": "on_hit_add_effect",
      "effect": "root",
      "chance": 25
    }
  ],
  "curses": []
}
`;

    // 调用AI生成装备
    const aiResponse = await generateCharacter(equipmentPrompt, prompt);
    const equipmentData = JSON.parse(aiResponse);

    // 验证AI生成的装备数据
    const validSlots = ['weapon', 'armor', 'accessory'];
    const validElements = [
      '金',
      '木',
      '水',
      '火',
      '土',
      '风',
      '雷',
      '冰',
      '无',
    ];

    if (
      !equipmentData.name ||
      !validSlots.includes(equipmentData.slot) ||
      !validElements.includes(equipmentData.element) ||
      !equipmentData.bonus ||
      typeof equipmentData.bonus !== 'object'
    ) {
      return NextResponse.json(
        { error: '生成装备失败，AI返回格式不正确' },
        { status: 500 },
      );
    }

    // 规范化装备数据
    const normalizedEquipment = {
      name: equipmentData.name,
      slot: equipmentData.slot,
      element: equipmentData.element,
      bonus: equipmentData.bonus || {},
      special_effects: Array.isArray(equipmentData.special_effects)
        ? equipmentData.special_effects
        : [],
      curses: Array.isArray(equipmentData.curses) ? equipmentData.curses : [],
    };

    // 创建装备
    const createdEquipment = await createEquipment(
      user.id,
      cultivatorId,
      normalizedEquipment,
    );

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
