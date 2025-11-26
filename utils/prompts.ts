import type { Cultivator } from '../types/cultivator';

/**
 * 角色生成 Prompt 模板
 * 用于调用 AI 生成修仙者角色
 */
export function getCharacterGenerationPrompt(userInput: string): string {
  const prompt = `你是一个修仙世界造化玉碟，根据用户描述生成一位修仙者。请严格按以下JSON格式输出，不要添加任何其他文字说明：

{
  "name": "角色名（2-4个字，符合修仙风格）",
  "cultivationLevel": "境界（如：炼气三层、筑基初期、金丹中期、元婴后期等）",
  "spiritRoot": "灵根类型（如：火灵根、水灵根、雷灵根、混沌灵根、变异灵根等）",
  "talents": ["天赋1（2-4个字）", "天赋2（2-4个字）", "天赋3（可选）"],
  "appearance": "外观描述（20-40字，描述发色、服饰、气质、武器等）",
  "backstory": "背景故事（30-60字，一句话概括角色的出身和经历）"
}

要求：
1. 角色名要符合修仙风格，不要使用现代名字
2. 境界从以下选择：炼气、筑基、金丹、元婴、化神、炼虚、合体、大乘、渡劫，并加上具体层数（如"三层"、"初期"、"中期"、"后期"、"巅峰"）
3. 天赋数量为2-3个，每个天赋2-4个字，要有修仙特色（如：剑心通明、百毒不侵、雷法亲和、夺舍转生、九转金丹等）
4. 外观描述要生动，突出修仙者的气质
5. 背景故事要简洁有力，能体现角色的独特性

用户描述：${userInput}

请直接输出JSON，不要有任何前缀或后缀说明。`;
  return prompt;
}

/**
 * 战斗播报 Prompt 模板
 * 用于生成小说式的战斗场景描述
 */
export function getBattleReportPrompt(
  cultivatorA: Cultivator,
  cultivatorB: Cultivator,
  winner: Cultivator
): string {
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

  const prompt = `你是一位修仙小说作家，请根据两位修仙者的设定，写一段50-150字的激烈对决描写。

要求：
- 有动作、有台词、有转折
- ${battleType}
- 若一方战力远高于另一方，描写碾压；若接近，描写苦战；若低者胜，描写"顿悟/底牌/天劫"等奇迹
- 结尾明确写出谁胜谁负
- 语言要符合修仙小说的风格，有武侠和仙侠的韵味

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
  return prompt;
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
