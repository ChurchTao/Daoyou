import type { BattleEngineResult } from '@/engine/battleEngine';
import type { Cultivator } from '../types/cultivator';

/**
 * 角色生成 Prompt 模板（系统提示词）
 * 基于 basic.md 中的新 Cultivator JSON 结构。
 */
export function getCharacterGenerationPrompt(): string {
  return `你是“造化玉碟”，精通修仙设定。你会收到凡人的心念描述，请基于描述创造一个结构化的修仙者。

请严格输出 JSON（不要任何额外文字），遵循以下结构和取值范围：
{
  "name": "2~4 字中文姓名",
  "gender": "男 | 女 | 无",
  "origin": "出身势力或地域，10~20字",
  "personality": "性格概述，15~30字",

  "realm": "炼气 | 筑基 | 金丹 | 元婴 | 化神 | 炼虚 | 合体 | 大乘 | 渡劫",
  "realm_stage": "初期 | 中期 | 后期 | 圆满",
  "age": 整数，>= 10,
  "lifespan": 整数，不同境界合理范围（例如 炼气 80~120，金丹 300~600，渡劫 800~1200），不得小于 age,

  "attributes": {
    "vitality": 10~300,
    "spirit": 10~300,
    "wisdom": 10~300,
    "speed": 10~300,
    "willpower": 10~300
  },

  "spiritual_roots": [
    {
      "element": "金 | 木 | 水 | 火 | 土 | 风 | 雷 | 冰 | 无",
      "strength": 0~100
    }
  ],

  "pre_heaven_fates": [
    {
      "name": "气运名称，2~4字",
      "type": "吉 | 凶",
      "attribute_mod": {
        "vitality": 可选整数加成,
        "spirit": 可选整数加成,
        "wisdom": 可选整数加成,
        "speed": 可选整数加成,
        "willpower": 可选整数加成
      },
      "description": "一句古风描述"
    }
  ],

  "cultivations": [
    {
      "name": "功法名称",
      "bonus": {
        "vitality": 可选整数加成,
        "spirit": 可选整数加成,
        "wisdom": 可选整数加成,
        "speed": 可选整数加成,
        "willpower": 可选整数加成
      },
      "required_realm": "与上文 realm 相同或更低的境界名"
    }
  ],

  "skills": [
    {
      "name": "技能名",
      "type": "attack | heal | control | debuff | buff",
      "element": "金 | 木 | 水 | 火 | 土 | 风 | 雷 | 冰 | 无",
      "power": 30~150,
      "cost": 0~100,
      "cooldown": 0~5,
      "effect": "可选：burn | bleed | poison | stun | silence | root | armor_up | speed_up | crit_rate_up | armor_down",
      "duration": 可选整数（持续回合数，1~4）,
      "target_self": 可选布尔值
    }
  ],

  "inventory": {
    "artifacts": [],
    "consumables": []
  },

  "equipped": {
    "weapon": null,
    "armor": null,
    "accessory": null
  },

  "max_skills": 2~6 的整数,
  "background": "30~80字背景故事"
}

重要约束与说明：
- 元素必须从固定列表中选择：金、木、水、火、土、风、雷、冰、无。
- 技能类型必须是：attack, heal, control, debuff, buff 之一。
- 状态效果必须是：burn, bleed, poison, stun, silence, root, armor_up, speed_up, crit_rate_up, armor_down 之一。
- 所有数值字段必须是整数，且在给定范围之内。
- 至少 1 个灵根，最多 3 个。
- pre_heaven_fates 建议 2~3 条，务必与属性加成相呼应。
- 技能至少 2 个，且应与角色设定和元素相符。
- 装备（inventory.artifacts 和 equipped）不需要生成，创建角色时为空，由用户后续手动装备。
- 输出必须是**合法 JSON**，不要添加任何注释或多余文字。`;
}

interface BattlePromptPayload {
  player: Cultivator;
  opponent: Cultivator;
  battleResult: Pick<
    BattleEngineResult,
    'log' | 'turns' | 'playerHp' | 'opponentHp'
  > & { winnerId: string };
}

export function getBattleReportPrompt({
  player,
  opponent,
  battleResult,
}: BattlePromptPayload): [string, string] {
  const winner = battleResult.winnerId === opponent.id ? opponent : player;

  const summarizeCultivator = (cultivator: Cultivator) => {
    const attrs = cultivator.attributes;
    const mainRoot = cultivator.spiritual_roots[0];
    const skills =
      cultivator.skills
        ?.map((skill) => `${skill.name}(${skill.element}/${skill.type})`)
        .join('，') ?? '无';
    const fates =
      cultivator.pre_heaven_fates
        ?.map((fate) => `${fate.name}(${fate.type})`)
        .join('，') ?? '无';
    return `姓名：${cultivator.name}
境界：${cultivator.realm}${cultivator.realm_stage}
灵根/属性：${mainRoot?.element ?? '无'} 灵根·${mainRoot?.strength ?? 0}
属性：体魄${attrs.vitality} 灵力${attrs.spirit} 悟性${attrs.wisdom} 速度${attrs.speed} 神识${attrs.willpower}
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
双方剩余气血：${player.name} ${
    battleResult.playerHp ?? '未知'
  } / ${opponent.name} ${battleResult.opponentHp ?? '未知'}

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
    gender: '男',
    origin: '魔渊深处',
    personality: '嗜血成性，杀意滔天',
    realm: '元婴',
    realm_stage: '后期',
    age: 350,
    lifespan: 600,
    attributes: {
      vitality: 110,
      spirit: 80,
      wisdom: 65,
      speed: 60,
      willpower: 70,
    },
    spiritual_roots: [
      { element: '火', strength: 80 },
      { element: '土', strength: 40 },
    ],
    pre_heaven_fates: [
      {
        name: '血煞命格',
        type: '凶',
        description: '煞气入骨，杀孽滔天。',
        attribute_mod: { vitality: 15, wisdom: -5 },
      },
      {
        name: '魔心不灭',
        type: '吉',
        description: '魔念护身，百劫不磨。',
        attribute_mod: { willpower: 10 },
      },
      {
        name: '尸山血海',
        type: '凶',
        description: '血海为源，冥焰滔天。',
        attribute_mod: { spirit: 10 },
      },
    ],
    cultivations: [],
    skills: [
      {
        id: 'sk_boss_blood_sea',
        name: '血海滔天',
        type: 'attack',
        power: 120,
        element: '火',
        cooldown: 1,
        cost: 30,
        effect: 'burn',
        duration: 2,
      },
      {
        id: 'sk_boss_flame_shield',
        name: '魔焰护身',
        type: 'buff',
        power: 60,
        element: '火',
        cooldown: 2,
        cost: 20,
        effect: 'speed_up',
        duration: 2,
      },
      {
        id: 'sk_boss_blood_heal',
        name: '血元回潮',
        type: 'heal',
        power: 90,
        element: '土',
        cooldown: 2,
        cost: 25,
        effect: undefined,
      },
    ],
    inventory: {
      artifacts: [
        {
          id: 'eq_boss_blade',
          name: '血炼魔刀',
          slot: 'weapon',
          element: '火',
          bonus: { vitality: 8, spirit: 10 },
          special_effects: [],
          curses: [],
        },
      ],
      consumables: [],
    },
    equipped: {
      weapon: 'eq_boss_blade',
      armor: null,
      accessory: null,
    },
    max_skills: 4,
    background:
      '昔年正道第一，如今坠入魔渊，以血养道，屠戮无数，被世人称为血手人屠。',
    prompt: '魔道巨擘，嗜血成性',
  };
}
