/**
 * 天机推演文案生成工具
 */

export interface DivineFortune {
  fortune: string; // 天机格言
  hint: string; // 道家提示
}

/**
 * 获取天机推演 Prompt（用于 AIGC 生成）
 */
export function getDivineFortunePrompt(): [string, string] {
  const systemPrompt = `你是一位深谙修仙玄学的天机推演大师。你需要生成一条简短的"今日天机"格言，用于修仙游戏的开场欢迎页。

要求：
1. 格言部分：10-20字，古风、富有哲理，可引用或化用古诗词、道家典籍
2. 提示部分：8-15字，提供修行建议，使用"宜/忌"的格式
3. 风格：玄妙、优雅、有意境，符合修仙世界观
4. 禁止：不要使用现代词汇，不要太过直白

输出格式（纯 JSON，无其他文字）：
{
  "fortune": "格言内容",
  "hint": "提示内容"
}

示例：
{
  "fortune": "道法自然，顺势而为",
  "hint": "今日宜顿悟，忌强求"
}`;

  const userPrompt = `请生成一条新的"今日天机"格言，要有新意，避免重复常见格言。`;

  return [systemPrompt, userPrompt];
}

/**
 * 预定义的天机格言池（作为 AIGC 失败时的备用方案）
 */
export const FALLBACK_FORTUNES: DivineFortune[] = [
  {
    fortune: '道可道，非常道。名可名，非常名',
    hint: '今日宜悟道，忌执着',
  },
  {
    fortune: '天地不仁，以万物为刍狗',
    hint: '今日宜逆天改命',
  },
  {
    fortune: '上善若水，水善利万物而不争',
    hint: '今日宜柔顺，忌锋芒',
  },
  {
    fortune: '大道无形，生育天地',
    hint: '今日宜观想，忌躁进',
  },
  {
    fortune: '金风玉露一相逢，便胜却人间无数',
    hint: '今日宜修行，忌冒进',
  },
  {
    fortune: '道法自然，顺势而为',
    hint: '今日宜顿悟，忌强求',
  },
  {
    fortune: '一念成佛，一念入魔',
    hint: '今日宜守心，忌妄想',
  },
  {
    fortune: '万法唯心，心外无法',
    hint: '今日宜内视，忌外求',
  },
  {
    fortune: '逆则成仙，顺则成人',
    hint: '今日宜逆行，忌随波',
  },
  {
    fortune: '天行健，君子以自强不息',
    hint: '今日宜精进，忌懈怠',
  },
  {
    fortune: '大音希声，大象无形',
    hint: '今日宜静修，忌喧嚣',
  },
  {
    fortune: '知者不言，言者不知',
    hint: '今日宜闭关，忌多言',
  },
  {
    fortune: '天道酬勤，厚德载物',
    hint: '今日宜勤修，忌惰性',
  },
  {
    fortune: '心若冰清，天塌不惊',
    hint: '今日宜守心，忌慌乱',
  },
  {
    fortune: '返璞归真，大道至简',
    hint: '今日宜简化，忌繁复',
  },
  {
    fortune: '虚室生白，吉祥止止',
    hint: '今日宜虚静，忌杂念',
  },
  {
    fortune: '无为而无不为',
    hint: '今日宜顺应，忌强为',
  },
  {
    fortune: '祸兮福所倚，福兮祸所伏',
    hint: '今日宜平常心，忌患得患失',
  },
  {
    fortune: '天地与我并生，万物与我为一',
    hint: '今日宜合道，忌分别',
  },
  {
    fortune: '飘风不终朝，骤雨不终日',
    hint: '今日宜耐心，忌急躁',
  },
];

/**
 * 从备用格言池中随机选择一条
 */
export function getRandomFallbackFortune(): DivineFortune {
  const index = Math.floor(Math.random() * FALLBACK_FORTUNES.length);
  return FALLBACK_FORTUNES[index];
}
