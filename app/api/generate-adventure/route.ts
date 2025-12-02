import { createClient } from '@/lib/supabase/server';
import { getCultivatorById, createEquipment, createSkill } from '@/lib/repositories/cultivatorRepository';
import { generateCharacter } from '@/utils/aiClient';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/drizzle/db';
import * as schema from '@/lib/drizzle/schema';

/**
 * POST /api/generate-adventure
 * 生成奇遇
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
    const { cultivatorId } = body;

    // 输入验证
    if (!cultivatorId || typeof cultivatorId !== 'string') {
      return NextResponse.json(
        { error: '请提供有效的角色ID' },
        { status: 400 }
      );
    }

    // 获取角色信息
    const cultivator = await getCultivatorById(user.id, cultivatorId);
    if (!cultivator) {
      return NextResponse.json({ error: '角色不存在' }, { status: 404 });
    }

    // 生成奇遇提示词
    const adventurePrompt = `
请根据角色信息生成一个修仙奇遇，返回格式为JSON，包含以下字段：
- type: 奇遇类型，只能是equipment、consumable或skill
- name: 奇遇名称
- description: 奇遇描述
- result: 奇遇结果
- reward: 奖励内容，根据类型不同返回不同格式
  - 如果是equipment，返回装备对象
  - 如果是consumable，返回消耗品对象
  - 如果是skill，返回技能对象

角色信息：
- 名称：${cultivator.name}
- 境界：${cultivator.realm}${cultivator.realm_stage}
- 灵根：${cultivator.spiritual_roots[0]?.element || '无'}（强度：${cultivator.spiritual_roots[0]?.strength || 0}）
- 元素：${cultivator.spiritual_roots[0]?.element || '无'}
- 现有技能：${cultivator.skills?.map(skill => skill.name).join(', ') || '无'}

示例输出（装备）：
{
  "type": "equipment",
  "name": "古墓探险",
  "description": "你在一座古老的古墓中发现了一件神秘的武器",
  "result": "成功获得一件强大的武器",
  "reward": {
    "name": "玄铁剑",
    "type": "weapon",
    "element": "金",
    "bonus": {
      "vitality": 5,
      "spirit": 8
    },
    "specialEffect": "攻击时有几率造成额外伤害"
  }
}

示例输出（消耗品）：
{
  "type": "consumable",
  "name": "药田偶遇",
  "description": "你在药田中遇到一位药农，他送给你一些丹药",
  "result": "获得了一些回春丹",
  "reward": {
    "name": "回春丹",
    "effect": "恢复50点生命值",
    "description": "一枚普通的回春丹，可以恢复少量生命值"
  }
}

示例输出（技能）：
{
  "type": "skill",
  "name": "雷劫顿悟",
  "description": "你在雷劫中顿悟了一门新的技能",
  "result": "成功领悟雷系技能",
  "reward": {
    "name": "九天应雷诀",
    "type": "attack",
    "power": 90,
    "element": "雷",
    "effects": ["造成大量雷系伤害", "有几率麻痹敌人"]
  }
}
`;

    // 调用AI生成奇遇
    const aiResponse = await generateCharacter(adventurePrompt, cultivator.name);
    const adventureData = JSON.parse(aiResponse);

    // 验证AI生成的奇遇数据
    if (
      !adventureData.type ||
      !['equipment', 'consumable', 'skill'].includes(adventureData.type) ||
      !adventureData.name ||
      !adventureData.description ||
      !adventureData.result ||
      !adventureData.reward
    ) {
      return NextResponse.json(
        { error: '生成奇遇失败，AI返回格式不正确' },
        { status: 500 }
      );
    }

    // 处理奖励
    let rewardResult;
    if (adventureData.type === 'equipment') {
      // 创建装备
      rewardResult = await createEquipment(user.id, cultivatorId, adventureData.reward);
    } else if (adventureData.type === 'consumable') {
      // 创建消耗品
      rewardResult = await db
        .insert(schema.consumables)
        .values({
          cultivatorId,
          name: adventureData.reward.name,
          type: adventureData.reward.type || 'heal',
          effect: adventureData.reward.effect || null,
        })
        .returning()
        .then((result) => result[0]);
    } else if (adventureData.type === 'skill') {
      // 创建技能
      rewardResult = await createSkill(user.id, cultivatorId, adventureData.reward);
    }

    // 获取更新后的角色信息
    const updatedCultivator = await getCultivatorById(user.id, cultivatorId);

    return NextResponse.json({
      success: true,
      data: {
        adventure: adventureData,
        reward: rewardResult,
        cultivator: updatedCultivator,
      },
    });
  } catch (error) {
    console.error('生成奇遇 API 错误:', error);

    // 安全处理错误信息，避免泄露敏感信息
    const errorMessage =
      process.env.NODE_ENV === 'development'
        ? error instanceof Error
          ? error.message
          : '生成奇遇失败，请稍后重试'
        : '生成奇遇失败，请稍后重试';

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
