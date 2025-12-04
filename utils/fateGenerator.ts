import type { FateQuality } from '../types/constants';
import { FATE_QUALITY_VALUES } from '../types/constants';
import type { PreHeavenFate } from '../types/cultivator';
import { generateCharacter } from './aiClient';

/**
 * 先天气运生成器 —— 完全由 LLM 生成
 * 规则：前两条贴合用户输入，其余随机但遵循品质概率与天道平衡
 */

const QUALITY_PROBABILITIES: Record<FateQuality, number> = {
  凡品: 0.5,
  灵品: 0.3,
  玄品: 0.15,
  真品: 0.05,
  地品: 0,
  天品: 0,
  仙品: 0,
  神品: 0
};

const ATTRIBUTE_KEYS = ['vitality', 'spirit', 'wisdom', 'speed', 'willpower'];

interface FatePromptOptions {
  count: number;
}

export async function generatePreHeavenFates(
  userInput: string,
): Promise<PreHeavenFate[]> {
  let fates: PreHeavenFate[] = [];

  const prompt = buildFatePrompt({
    count: 10,
  });

  try {
    const aiResponse = await generateCharacter(prompt, userInput);
    const parsed = parseFateResponse(aiResponse);
    fates = [...fates, ...parsed];
  } catch (error) {
    console.error('生成气运失败:', error);
  }

  if (fates.length === 0) {
    throw new Error('气运生成失败，请稍后重试');
  }

  return fates.slice(0, 10);
}

function buildFatePrompt({ count }: FatePromptOptions): string {
  return `你是精通修仙设定的大能，请一次性生成 ${count} 条先天气运，并严格输出 JSON 数组（不可添加额外文字）。

重要约束与说明：
- 输出必须是一个长度恰为 ${count} 的 JSON 数组，条目不得多也不得少。
- 如果发现数量不足，请自动补齐后再输出最终 JSON。
- 前 2 条必须与用户描述密切相关，说明其如何呼应用户愿景
- 其他可完全自由发挥，与用户描述无直接关联
- 每条气运字段必须符合以下结构：
  {
    "name": "2~4字，富有意象",
    "type": "吉 或 凶（若好坏参半仍需择其一）",
    "quality": "凡品 | 灵品 | 玄品 | 真品",
    "attribute_mod": {
      "vitality": 可选整数，可为负,
      "spirit": 可选整数，可为负,
      "wisdom": 可选整数，可为负,
      "speed": 可选整数，可为负,
      "willpower": 可选整数，可为负
    },
    "description": "古风描述，指出来源、代价或触发条件"
  }
- 属性加成可以体现体质特征（如天魔之体=体魄+10 灵力-3、天煞之人=灵力+10 体魄-8）。
- 品质概率须接近：凡品50%、灵品30%、玄品15%、真品5%。
- 至少生成一条好坏参半（正负并存）的气运。
- 字段必须完整，输出合法 JSON 数组。`;
}

function parseFateResponse(response: string): PreHeavenFate[] {
  let raw: unknown;
  try {
    raw = JSON.parse(response);
  } catch {
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    raw = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
  }

  if (!Array.isArray(raw)) {
    if (raw && typeof raw === 'object') {
      const single = normaliseFate(raw);
      return single ? [single] : [];
    }
    return [];
  }

  return raw
    .map((item) => normaliseFate(item))
    .filter((fate): fate is PreHeavenFate => Boolean(fate));
}

function normaliseFate(item: unknown): PreHeavenFate | null {
  if (!item || typeof item !== 'object') return null;
  const record = item as Record<string, unknown>;
  const name =
    typeof record.name === 'string' && record.name.trim().length > 0
      ? record.name.trim()
      : null;
  if (!name) return null;

  const type = record.type === '凶' ? '凶' : '吉';
  const quality = normaliseQuality(record.quality);
  const attribute_mod = normaliseAttributeMod(record.attribute_mod);
  const description =
    typeof record.description === 'string' && record.description.trim().length
      ? record.description.trim()
      : '此运来历成谜，需谨慎调息。';

  return {
    name,
    type,
    quality,
    attribute_mod,
    description,
  };
}

function normaliseQuality(value: unknown): FateQuality {
  if (
    typeof value === 'string' &&
    FATE_QUALITY_VALUES.includes(value as FateQuality)
  ) {
    return value as FateQuality;
  }
  return randomQuality();
}

function normaliseAttributeMod(value: unknown): PreHeavenFate['attribute_mod'] {
  const result: PreHeavenFate['attribute_mod'] = {};
  if (!value || typeof value !== 'object') return result;
  const record = value as Record<string, unknown>;

  ATTRIBUTE_KEYS.forEach((key) => {
    const val = record[key];
    if (typeof val === 'number' && Number.isFinite(val)) {
      result[key as keyof PreHeavenFate['attribute_mod']] = Math.round(val);
    }
  });

  return result;
}

function randomQuality(): FateQuality {
  const rand = Math.random();
  let cumulative = 0;
  for (const [quality, probability] of Object.entries(QUALITY_PROBABILITIES)) {
    cumulative += probability;
    if (rand <= cumulative) {
      return quality as FateQuality;
    }
  }
  return '凡品';
}
