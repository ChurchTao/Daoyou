import type { BattleEngineResult } from '@/engine/battleEngine';
import type { Cultivator } from '../types/cultivator';
import { mapSpiritRootToElement } from './battleProfile';

/**
 * 角色生成 Prompt 模板（系统提示词）
 */
export function getCharacterGenerationPrompt(): string {
  return `你是“造化玉碟”，精通修仙设定。你会收到凡人的心念描述，请基于描述创造一个结构化的修仙者。

请严格输出 JSON（不要任何额外文字），字段与约束如下：
{
  "name": "角色名，2-4字",
  "gender": "性别",
  "origin": "出身",
  "personality": "性格概述",
  "level": "境界，例如：筑基中期",
  "spirit_root": "灵根，例如：雷灵根 / 变异·混沌灵根",
  "appearance": "20~40字外观描写",
  "background": "30~60字背景故事",
  "pre_heaven_fates": [
    {
      "name": "气运名称，2-4字",
      "type": "吉 或 凶",
      "effect": "简要说明对属性或战斗的影响",
      "description": "一句古风描述"
    }
  ],
  "battle_profile": {
    "attributes": {
      "vitality": 70-110,
      "spirit": 65-85,
      "wisdom": 65-85,
      "speed": 60-85
    },
    "max_hp": 150 + (attributes.vitality * 0.8) （四舍五入为整数）,
    "skills": [
      {
        "name": "技能名",
        "type": "attack|heal|control|buff",
        "power": 50-85,
        "element": "金|木|水|火|土|雷|无",
        "effects": ["可选效果列表，如 stun/burn/heal"]
      }
    ],
    "equipment": [
      {
        "name": "法器或符箓名称",
        "bonus": {
          "vitality": 可选加成（建议 5-10）,
          "spirit": 可选加成（建议 5-10）,
          "elementBoost": { "雷": 0.1 } // 可选，建议 0.05-0.15
        }
      }
    ]
  }
}

要求：
1. 角色必须包含 EXACT 3 个「pre_heaven_fates」。
2. 数值统一为整数，不得超出范围。
3. 技能至少 2 个，必须符合角色设定；若描述与元素有关，请对应元素。
4. 战斗属性需与气运描述一致，例如“紫府通明”应提高 spirit。
5. 输出必须为合法 JSON。`;
}

interface BattlePromptPayload {
  player: Cultivator;
  opponent: Cultivator;
  battleResult: Pick<
    BattleEngineResult,
    'log' | 'turns' | 'playerHp' | 'opponentHp' | 'triggeredMiracle'
  > & { winnerId: string };
}

export function getBattleReportPrompt({
  player,
  opponent,
  battleResult,
}: BattlePromptPayload): [string, string] {
  const winner = battleResult.winnerId === opponent.id ? opponent : player;

  const summarizeCultivator = (cultivator: Cultivator) => {
    const profile = cultivator.battleProfile;
    const element =
      profile?.element ?? mapSpiritRootToElement(cultivator.spiritRoot);
    const attributes = profile
      ? `体魄${profile.attributes.vitality} 灵力${profile.attributes.spirit} 悟性${profile.attributes.wisdom} 速度${profile.attributes.speed}`
      : '属性：未知';
    const skills =
      profile?.skills
        ?.map((skill) => `${skill.name}(${skill.element}/${skill.type})`)
        .join('，') ?? '无';
    const fates =
      cultivator.preHeavenFates
        ?.map((fate) => `${fate.name}(${fate.type})`)
        .join('，') ?? '无';
    return `姓名：${cultivator.name}
境界：${cultivator.cultivationLevel}
灵根/属性：${cultivator.spiritRoot} · ${element}
属性：${attributes}
技能：${skills}
先天气运：${fates}`;
  };

  const battleLog = (battleResult.log || []).join('\n');

  const systemPrompt = `你是一位修仙题材连载小说作者，擅长写具有画面感的战斗场景。请根据设定与战斗日志，创作分回合的战斗播报，每回合描述控制在30-50字左右。

要求：
- 语言热血、古风、有镜头感
- 每回合战斗描述独立成行，以"【第X回合】"开头
- 双方招式须与技能、气运相符
- 明确写出每回合的攻击者、技能名称和伤害/治疗效果
- 若触发顿悟或底牌，需要重点描写
- 结尾单独一行，点明胜负与双方状态（可引用血量信息）
- 请为关键信息添加HTML标记，具体规则如下：
  - 回合数：<turn>【第X回合】</turn>
  - 人名：<name>人名</name>
  - 技能名称：<skill>技能名</skill>
  - 伤害数值：<damage>数字</damage>
  - 治疗数值：<heal>数字</heal>
  - 效果描述：<effect>效果描述</effect>
  - 胜负结果：<result>胜负描述</result>
- 禁止输出 JSON 或列表，仅写正文`;

  const userPrompt = `【对战双方设定】
${summarizeCultivator(player)}

---
${summarizeCultivator(opponent)}

【战斗日志】
${battleLog}

【战斗结论】
胜者：${winner.name}
回合数：${battleResult.turns ?? battleResult.log.length}
双方剩余气血：${player.name} ${battleResult.playerHp ?? '未知'} / ${
    opponent.name
  } ${battleResult.opponentHp ?? '未知'}
是否出现奇迹逆转：${battleResult.triggeredMiracle ? '是' : '否'}

请写一段完整的战斗描写。`;

  return [systemPrompt, userPrompt];
}

/**
 * 预设 Boss 角色（用于测试和初期对战）
 */
export function getDefaultBoss(): Cultivator {
  return {
    id: 'boss-001',
    name: '血手人屠',
    prompt: '魔道巨擘，嗜血成性',
    cultivationLevel: '元婴后期',
    spiritRoot: '血魔灵根',
    appearance: '黑袍遮身，双目赤红，血雾缭绕，手持血色长刀',
    backstory: '昔年正道第一，如今坠入魔渊，以血养道，屠戮无数。',
    maxEquipments: 3,
    maxSkills: 4,
    preHeavenFates: [
      {
        name: '血煞命格',
        type: '凶',
        effect: 'vitality +15, wisdom -5',
        description: '煞气入骨，杀孽滔天。',
      },
      {
        name: '魔心不灭',
        type: '吉',
        effect: 'max_hp +30',
        description: '魔念护身，百劫不磨。',
      },
      {
        name: '尸山血海',
        type: '凶',
        effect: '火系技能威力 +15%',
        description: '血海为源，冥焰滔天。',
      },
    ],
    battleProfile: {
      maxHp: 350,
      hp: 350,
      element: '火',
      attributes: {
        vitality: 110,
        spirit: 80,
        wisdom: 65,
        speed: 60,
      },
      skills: [
        {
          name: '血海滔天',
          type: 'attack',
          power: 85,
          element: '火',
          effects: ['burn'],
        },
        {
          name: '魔焰护身',
          type: 'buff',
          power: 55,
          element: '火',
          effects: ['speed_up'],
        },
        {
          name: '血元回潮',
          type: 'heal',
          power: 65,
          element: '土',
          effects: ['heal'],
        },
      ],
      equipment: [
        {
          name: '血炼魔刀',
          type: 'weapon',
          element: '火',
          bonus: { vitality: 8, elementBoost: { 火: 0.15 } },
        },
      ],
    },
  };
}
