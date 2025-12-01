import { createClient } from '@/lib/supabase/server';
import { createSkill, getSkills, replaceSkill } from '@/lib/repositories/cultivatorRepository';
import { generateCharacter } from '@/utils/aiClient';
import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/create-skill
 * 生成技能
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
    const { cultivatorId, prompt, oldSkillId } = body;

    // 输入验证
    if (
      !cultivatorId ||
      typeof cultivatorId !== 'string' ||
      !prompt ||
      typeof prompt !== 'string' ||
      prompt.trim().length < 5
    ) {
      return NextResponse.json(
        { error: '请提供有效的角色ID和技能描述' },
        { status: 400 }
      );
    }

    // 生成技能提示词
    const skillPrompt = `
请根据用户提示生成一个修仙技能，返回格式为JSON，包含以下字段：
- name: 技能名称
- type: 技能类型，只能是attack、heal、control或buff
- power: 技能威力，范围50-100
- element: 技能元素，只能是金、木、水、火、土、雷或无
- effects: 技能效果描述数组

用户提示：${prompt}

示例输出：
{
  "name": "藤蔓缚",
  "type": "control",
  "power": 70,
  "element": "木",
  "effects": ["束缚敌人", "持续伤害"]
}
`;

    // 调用AI生成技能
    const aiResponse = await generateCharacter(skillPrompt, prompt);
    const skillData = JSON.parse(aiResponse);

    // 验证AI生成的技能数据
    if (
      !skillData.name ||
      !['attack', 'heal', 'control', 'buff'].includes(skillData.type) ||
      typeof skillData.power !== 'number' ||
      skillData.power < 50 ||
      skillData.power > 100 ||
      !['金', '木', '水', '火', '土', '雷', '无'].includes(skillData.element)
    ) {
      return NextResponse.json(
        { error: '生成技能失败，AI返回格式不正确' },
        { status: 500 }
      );
    }

    let result;

    if (oldSkillId) {
      // 替换技能
      result = await replaceSkill(user.id, cultivatorId, oldSkillId, skillData);
    } else {
      // 创建新技能
      result = await createSkill(user.id, cultivatorId, skillData);
    }

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('生成技能 API 错误:', error);

    // 安全处理错误信息，避免泄露敏感信息
    const errorMessage =
      process.env.NODE_ENV === 'development'
        ? error instanceof Error
          ? error.message
          : '生成技能失败，请稍后重试'
        : '生成技能失败，请稍后重试';

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

/**
 * GET /api/create-skill
 * 获取角色技能
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

    // 获取角色ID参数
    const searchParams = request.nextUrl.searchParams;
    const cultivatorId = searchParams.get('cultivatorId');

    if (!cultivatorId) {
      return NextResponse.json({ error: '请提供角色ID' }, { status: 400 });
    }

    // 获取角色技能
    const skills = await getSkills(user.id, cultivatorId);

    return NextResponse.json({
      success: true,
      data: skills,
    });
  } catch (error) {
    console.error('获取技能 API 错误:', error);

    // 安全处理错误信息，避免泄露敏感信息
    const errorMessage =
      process.env.NODE_ENV === 'development'
        ? error instanceof Error
          ? error.message
          : '获取技能失败，请稍后重试'
        : '获取技能失败，请稍后重试';

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
