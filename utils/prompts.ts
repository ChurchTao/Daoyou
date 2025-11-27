import type { Cultivator } from '../types/cultivator';

/**
 * 角色生成 Prompt 模板
 * 用于调用 AI 生成修仙者角色
 */
export function getCharacterGenerationPrompt(): string {
  const prompt = `你是一位精通修仙之道的“造化玉碟”，能根据凡人一句心念，为其凝练命格、塑就道躯。请根据用户描述，生成一位独一无二的修仙者。请严格按以下JSON格式输出，不要添加任何其他文字说明：

{
  "name": "角色名（2-4个字，符合修仙风格）",
  "cultivationLevel": "境界（如：炼气三层、筑基初期、金丹中期、元婴后期等）",
  "spiritRoot": "灵根类型（如：火灵根、水灵根、雷灵根、混沌灵根、变异灵根等）",
  "talents": ["天赋1（2-4个字）", "天赋2（2-4个字）", "天赋3（可选）"],
  "appearance": "外观描述（20-40字，描述发色、服饰、气质、武器等）",
  "backstory": "背景故事（30-60字，一句话概括角色的出身和经历）"
}

要求：
1. 严格按以下 JSON 格式输出，不要任何额外文字或解释
2. 所有字段必须填写，不可为空
3. 角色名要符合修仙风格，不要使用现代名字
4. 境界从低到高：炼气、筑基、金丹、元婴、化神、炼虚、合体、大乘、渡劫，并加上具体层数（如"三层"、"初期"、"中期"、"后期"、"巅峰"）
5. 灵根类型：金、木、水、火、土、风、雷、冰、暗、光，或“变异·XXX”（如“变异·混沌灵根”）
6. 天赋数量为2-3个，每个天赋2-4个字，要有修仙特色（如：剑心通明、百毒不侵、雷法亲和、夺舍转生、九转金丹等）
7. 外观描述需包含发色、服饰、气质、标志性特征
8. 背景故事要简洁有力，能体现角色的独特性
`;
  return prompt;
}

/**
 * 战斗播报 Prompt 模板
 * 用于生成小说式的战斗场景描述
 * 
 * @param cultivatorA 角色A
 * @param cultivatorB 角色B
 * @param winner 获胜者
 * @returns [战斗播报系统提示词,角色设定描述] [string, string]
 */
export function getBattleReportPrompt(
  cultivatorA: Cultivator,
  cultivatorB: Cultivator,
  winner: Cultivator
): [string, string] {
  const powerDiff = Math.abs(cultivatorA.totalPower - cultivatorB.totalPower);
  const powerRatio = Math.min(cultivatorA.totalPower, cultivatorB.totalPower) / 
                     Math.max(cultivatorA.totalPower, cultivatorB.totalPower);

  let battleType = '';
  if (powerRatio > 0.9) {
    battleType = '这是一场势均力敌的苦战，双方实力接近';
  } else if (powerRatio > 0.7) {
    battleType = '这是一场激烈的对决，双方实力有一定差距';
  } else if (powerDiff > 200) {
    battleType = '这是一场实力悬殊的战斗，一方明显强于另一方';
  } else {
    battleType = '这是一场精彩的战斗';
  }

  const system_prompt = `你是一位畅销修仙小说作家，擅长描写惊天动地的对决。请根据两位修仙者的设定，创作一段 150~200 字的战斗场景。

要求：
- 必须包含动作、台词、转折或底牌
- ${battleType}
- 若一方战力远高于另一方，描写碾压；若接近，描写苦战；若低者胜，描写"顿悟/底牌/天劫"等奇迹
- 结尾明确写出谁胜谁负
- 语言风格：热血、简练、画面感强，像起点/番茄小说热门章节
- 战斗情节需要符合双方的角色设定，比如双方的功法神通，天赋，法宝等
- 不要使用“只见”“忽然”等老套词汇
`
const user_prompt = `
【角色A】
姓名：${cultivatorA.name}
境界：${cultivatorA.cultivationLevel}
灵根：${cultivatorA.spiritRoot}
天赋：${cultivatorA.talents.join('、')}
外观：${cultivatorA.appearance}
背景：${cultivatorA.backstory}
战力：${cultivatorA.totalPower}

【角色B】
姓名：${cultivatorB.name}
境界：${cultivatorB.cultivationLevel}
灵根：${cultivatorB.spiritRoot}
天赋：${cultivatorB.talents.join('、')}
外观：${cultivatorB.appearance}
背景：${cultivatorB.backstory}
战力：${cultivatorB.totalPower}

战斗结果：${winner.name} 获胜

请直接输出战斗描写，不要有任何前缀或后缀说明。`;
  return [system_prompt, user_prompt];
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
    talents: ['血海滔天', '魔心不灭', '夺魂摄魄'],
    appearance: '黑袍遮身，双目赤红，周身血雾缭绕，手持一柄血色长刀',
    backstory: '曾是正道天骄，因心魔入体堕入魔道，以吞噬修士精血为乐，凶名赫赫',
    basePower: 850,
    talentBonus: 250,
    totalPower: 1100,
  };
}
