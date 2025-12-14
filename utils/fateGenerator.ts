import { z } from 'zod';
import { Quality, QUALITY_VALUES } from '../types/constants';
import { PreHeavenFate } from '../types/cultivator';
import { object } from './aiClient';

const QUALITY_RANGES: Record<Quality, { min: number; max: number }> = {
  凡品: { min: -5, max: 5 },
  灵品: { min: 4, max: 10 },
  玄品: { min: 8, max: 15 },
  真品: { min: 12, max: 20 },
  地品: { min: 18, max: 30 },
  天品: { min: 28, max: 45 },
  仙品: { min: 40, max: 70 },
  神品: { min: 60, max: 100 },
};

/**
 * 每个品质出现的概率
 */
const QUALITY_CHANCE_MAP: Record<Quality, number> = {
  凡品: 0.3,
  灵品: 0.3,
  玄品: 0.2,
  真品: 0.1,
  地品: 0.04,
  天品: 0.03,
  仙品: 0.02,
  神品: 0.01,
};

const PreHeavenFateSchema = z.object({
  name: z.string().min(2).max(6).describe('气运名称，2-6字'),
  type: z.enum(['吉', '凶']).describe('气运类型'),
  quality: z.enum(QUALITY_VALUES).describe('气运品质'),
  attribute_mod: z
    .object({
      vitality: z.number().optional().describe('体魄加成'),
      spirit: z.number().optional().describe('灵力加成'),
      wisdom: z.number().optional().describe('悟性加成'),
      speed: z.number().optional().describe('速度加成'),
      willpower: z.number().optional().describe('神识加成'),
    })
    .describe('属性加成对象'),
  description: z
    .string()
    .min(20)
    .max(150)
    .describe('气运描述，包含来源、代价或触发条件'),
});

const FatesResponseSchema = z.object({
  fates: z.array(PreHeavenFateSchema).length(10),
});

/**
 * 随机生成指定数量的气运品质分布
 */
function getRandomFatesDistribution(count: number): Record<Quality, number> {
  const distribution: Record<Quality, number> = {
    凡品: 0,
    灵品: 0,
    玄品: 0,
    真品: 0,
    地品: 0,
    天品: 0,
    仙品: 0,
    神品: 0,
  };

  for (let i = 0; i < count; i++) {
    const random = Math.random();
    let accumulatedChance = 0;
    let selected = false;

    // 按照低到高(或者定义好的常数顺序)遍历
    for (const quality of QUALITY_VALUES) {
      const chance = QUALITY_CHANCE_MAP[quality];
      accumulatedChance += chance;
      if (random <= accumulatedChance) {
        distribution[quality]++;
        selected = true;
        break;
      }
    }

    // 防止浮点数误差导致未选中
    if (!selected) {
      distribution['凡品']++;
    }
  }

  return distribution;
}

/**
 * 先天气运生成器 —— 通过 Structured Output 生成
 */
export async function generatePreHeavenFates(): Promise<PreHeavenFate[]> {
  const count = 10;

  // 1. 在代码中随机生成品质分布
  const distribution = getRandomFatesDistribution(count);

  // 2. 构建 Prompt 描述
  const distributionDesc = Object.entries(distribution)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    .filter(([_, num]) => num > 0)
    .map(([quality, num]) => `${quality} ${num} 个`)
    .join('，');

  console.log(`[FateGenerator] Target Distribution: ${distributionDesc}`);

  const systemPrompt = `
    你是修仙世界的天道掌管者，擅长创造多种多样的修仙界先天气运、修仙体质。
    你的输出必须是**严格符合指定 JSON Schema 的纯 JSON 对象**，不得包含任何额外文本、解释、注释或 Markdown。

    ### 核心规则：
    1. 气运名称(name)必须富有意象，3-6个字，也可以为某种修仙者体质
    2. 气运类型(type)必须是"吉"或"凶"。
    3. 气运品质(quality)必须是：${QUALITY_VALUES.join('、')}。
    4. 每个气运都会对基础属性有一定的加成，加成可能有正有负
    5. 每个气运的描述(description)必须富有想象力，包含来源、代价或触发条件,长度在20~120字之间。
    6. 不同品质的气运加成的属性数量如下：
    - 凡品/灵品：1个属性
    - 玄品/真品/地品：2～3个属性
    - 天品/仙品：3～4个属性
    - 神品：4～5个属性
    7. 每个气运严格遵守其品质对应的加成属性总值范围，所有属性加成之和不能超过品质范围。
    ${Object.entries(QUALITY_RANGES)
      .map(([q, range]) => `- ${q}: [${range.min}, ${range.max}]`)
      .join('\n    ')}
  `;

  const userPrompt = `
  请生成fates恰好等于${count}条数据。
  
  **必须严格按照以下品质分布生成：**
  ${distributionDesc}
  
  请直接输出符合规则和 Schema 的 JSON。
  `;

  try {
    const result = await object(
      systemPrompt,
      userPrompt,
      {
        schema: FatesResponseSchema,
        schemaName: 'GenerateFates',
      },
      true, // use fast model
    );

    return result.object.fates;
  } catch (error) {
    console.error('AI生成气运失败:', error);
    // Fallback: return empty or handle error upstream
    throw new Error('天道紊乱，本次凝聚失败，请重试');
  }
}
