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

    // 生成技能提示词（基于新的 Skill 结构）
    const skillPrompt = `
请根据用户提示生成一个修仙技能，返回格式为JSON，包含以下字段：
- name: 技能名称
- type: 技能类型，只能是 attack、heal、control、debuff 或 buff
- element: 技能元素，只能是 金、木、水、火、土、风、雷、冰、无
- power: 技能威力，范围 30-150
- cost: 灵力消耗，范围 0-100（可选）
- cooldown: 冷却回合数，范围 0-5
- effect: 状态效果（可选），只能是 burn、bleed、poison、stun、silence、root、armor_up、speed_up、crit_rate_up、armor_down
- duration: 持续回合数（可选），范围 1-4
- target_self: 是否对自己使用（可选布尔值）

用户提示：${prompt}

示例输出：
{
  "name": "藤蔓缚",
  "type": "control",
  "element": "木",
  "power": 70,
  "cost": 20,
  "cooldown": 2,
  "effect": "root",
  "duration": 2
}
`;

    // 调用AI生成技能
    const aiResponse = await generateCharacter(skillPrompt, prompt);
    const skillData = JSON.parse(aiResponse);

    // 验证AI生成的技能数据
    const validTypes = ['attack', 'heal', 'control', 'debuff', 'buff'];
    const validElements = ['金', '木', '水', '火', '土', '风', '雷', '冰', '无'];
    const validEffects = ['burn', 'bleed', 'poison', 'stun', 'silence', 'root', 'armor_up', 'speed_up', 'crit_rate_up', 'armor_down'];

    if (
      !skillData.name ||
      !validTypes.includes(skillData.type) ||
      typeof skillData.power !== 'number' ||
      skillData.power < 30 ||
      skillData.power > 150 ||
      !validElements.includes(skillData.element)
    ) {
      return NextResponse.json(
        { error: '生成技能失败，AI返回格式不正确' },
        { status: 500 }
      );
    }

    // 规范化技能数据
    const normalizedSkill = {
      name: skillData.name,
      type: skillData.type,
      element: skillData.element,
      power: Math.max(30, Math.min(150, Math.round(skillData.power))),
      cost: skillData.cost !== undefined ? Math.max(0, Math.min(100, Math.round(skillData.cost))) : undefined,
      cooldown: skillData.cooldown !== undefined ? Math.max(0, Math.min(5, Math.round(skillData.cooldown))) : 0,
      effect: skillData.effect && validEffects.includes(skillData.effect) ? skillData.effect : undefined,
      duration: skillData.duration !== undefined ? Math.max(1, Math.min(4, Math.round(skillData.duration))) : undefined,
      target_self: skillData.target_self === true ? true : undefined,
    };

    let result;

    if (oldSkillId) {
      // 替换技能
      result = await replaceSkill(user.id, cultivatorId, oldSkillId, normalizedSkill);
    } else {
      // 创建新技能
      result = await createSkill(user.id, cultivatorId, normalizedSkill);
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
