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
const QUALITY_CHANCE_MAP: Record<Quality, string> = {
  凡品: '30%',
  灵品: '30%',
  玄品: '20%',
  真品: '10%',
  地品: '4%',
  天品: '3%',
  仙品: '2%',
  神品: '1%',
};

const getQualityChancePrompt = () => {
  return Object.entries(QUALITY_CHANCE_MAP)
    .map(([quality, chance]) => `${quality}:${chance}`)
    .join('、');
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
 * 先天气运生成器 —— 通过 Structured Output 生成
 */
export async function generatePreHeavenFates(): Promise<PreHeavenFate[]> {
  const count = 10;

  const systemPrompt = `
    你是修仙世界的天道掌管者，擅长创造多种多样的修仙界先天气运、修仙体质。
    你的输出必须是**严格符合指定 JSON Schema 的纯 JSON 对象**，不得包含任何额外文本、解释、注释或 Markdown。

    ### 核心规则：
    1. 气运名称(name)必须富有意象，3-6个字，也可以为某体质的特征，如"天魔之体"、"通玉凤髓之身"等。
    2. 气运类型(type)必须是"吉"或"凶"。
    3. 气运品质(quality)必须是：${QUALITY_VALUES.join('、')}。
    4. 气运品质(quality)的出现概率必须符合以下概率要求：
    ${getQualityChancePrompt()}
    5. 每个气运都会对基础属性有一定的加成，加成可能有正有负
    6. 每个气运的描述(description)必须富有想象力，包含来源、代价或触发条件,长度在20~120字之间。
    7. 不同品质的气运加成的属性数量如下：
    - 凡品/灵品：1个属性
    - 玄品/真品/地品：2～3个属性
    - 天品/仙品：3～4个属性
    - 神品：4～5个属性
    8. 每个气运严格遵守以下品质对应的加成属性总值范围，所有加成之和不能超过品质范围。
    ${Object.entries(QUALITY_RANGES)
      .map(([q, range]) => `- ${q}: [${range.min}, ${range.max}]`)
      .join('\n    ')}
  `;

  const userPrompt = `
  请生成fates恰好等于${count}条数据，请直接输出符合规则和 Schema 的 JSON。
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
