import { z } from 'zod';
import { Quality, QUALITY_VALUES } from '../types/constants';
import { PreHeavenFate } from '../types/cultivator';
import { objectArray } from './aiClient';

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
      vitality: z.number().gte(-100).lte(100).optional().describe('体魄加成'),
      spirit: z.number().gte(-100).lte(100).optional().describe('灵力加成'),
      wisdom: z.number().gte(-100).lte(100).optional().describe('悟性加成'),
      speed: z.number().gte(-100).lte(100).optional().describe('速度加成'),
      willpower: z.number().gte(-100).lte(100).optional().describe('神识加成'),
    })
    .describe('属性加成对象'),
  description: z
    .string()
    .min(20)
    .max(150)
    .describe('气运描述，包含来源、代价或触发条件'),
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
export async function generatePreHeavenFates(
  count: number = 10,
): Promise<PreHeavenFate[]> {
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
  你是一位精通东方玄幻修真体系的大能，负责为踏入修仙之路的凡人弟子随机生成其「先天命格」——包括一种【先天气运】或【特殊体质】。

  请严格遵守以下规则：

1. **世界观背景**：
   - 世界等级：炼气 → 筑基 → 金丹 → 元婴 → 化神 → 炼虚 → 合体 → 大乘 → 渡劫
   - 风格参考《凡人修仙传》小说：现实残酷、机缘与风险并存、资质决定起点但非终点。
   - 气运/体质应体现“天道无常”、“福祸相依”的哲学。
2. **生成要求**：
   - 名称(name):3~6字需古风、有韵味（如“九阳圣体”、“厄运缠身”、“灵犀道骨”、“剑仙转世”）。
   - 类型(type):仅限“吉”或“凶”
   - 品质(quality):仅限以下之一：${QUALITY_VALUES.join(' → ')}
   - 属性加成(attribute_mod)：加成对象限于（体魄-vitality、灵力-spirit、悟性-wisdom、速度-speed、神识-willpower）。
   - 每项加成为整数，可正可负（如体魄+15，悟性-10）。
   - 属性数量依品质而定：
     - 凡品 / 灵品：1项
     - 玄品 / 真品 / 地品：2项
     - 天品 / 仙品 / 神品：3项
   - 属性组合：鼓励单一属性加成极度突出、避免属性加成过于均衡。
   - 所有气运都会有属性加成，请勿出现无属性加成的情况。
   - 所有加成绝对值之和必须严格落在该品质允许范围内：
     ${Object.entries(QUALITY_RANGES)
       .map(([q, range]) => `- ${q}: [${range.min}, ${range.max}]`)
       .join('\n    ')}
   - 描述(description):20~120字，风格需神秘、古雅、富有宿命感
3. **输出格式**
   - 必须返回**纯 JSON 对象**，无任何额外文本。
  `;

  const userPrompt = `
  现在，请为一位初入修仙界的凡人，随机生成其先天命格。请生成恰好等于${count}条数据。

  **必须严格按照以下品质分布生成：**
  ${distributionDesc}
  
  请直接输出符合规则和 Schema 的 JSON。
  `;

  try {
    const result = await objectArray(
      systemPrompt,
      userPrompt,
      {
        schema: PreHeavenFateSchema,
        schemaName: '先天气运的结构',
      },
      false, // use fast model
    );

    return result.object;
  } catch (error) {
    console.error('AI生成气运失败:', error);
    // Fallback: return empty or handle error upstream
    throw new Error('天道紊乱，本次凝聚失败，请重试');
  }
}
