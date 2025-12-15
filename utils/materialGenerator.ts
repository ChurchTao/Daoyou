import { z } from 'zod';
import {
  ELEMENT_VALUES,
  MATERIAL_TYPE_VALUES,
  Quality,
  QUALITY_VALUES,
} from '../types/constants';
import { object } from './aiClient';

// Schema used by the AI generation result
const MaterialSchema = z.object({
  name: z.string().min(2).describe('材料名称'),
  type: z.enum(MATERIAL_TYPE_VALUES).describe('材料类型'),
  rank: z.enum(QUALITY_VALUES).describe('材料品质'),
  element: z.enum(ELEMENT_VALUES).describe('材料属性'),
  description: z.string().min(10).max(100).describe('材料描述'),
  price: z.number().int().positive().describe('材料价格'),
  quantity: z.number().int().min(1).max(10).describe('材料数量'),
});

export type GeneratedMaterial = z.infer<typeof MaterialSchema>;

const MaterialsBatchSchema = z.object({
  items: z.array(MaterialSchema).describe('一批生成的材料列表'),
});

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

/**
 * Randomly determine the distribution of qualities for a given count.
 * This ensures the generation strictly follows probabilities via code logic,
 * rather than relying on the LLM to understand percentages.
 */
function getRandomQualityDistribution(count: number): Record<Quality, number> {
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

    // Iterate in defined order
    for (const quality of QUALITY_VALUES) {
      const chance = QUALITY_CHANCE_MAP[quality];
      accumulatedChance += chance;
      if (random <= accumulatedChance) {
        distribution[quality]++;
        selected = true;
        break;
      }
    }

    // Floating-point safety fallback
    if (!selected) {
      distribution['凡品']++;
    }
  }

  return distribution;
}

/**
 * Generate a batch of random materials using AI (Structured Output).
 * Useful for market listings, loot drops, etc.
 *
 * @param count - Number of items to generate (default 10)
 */
export async function generateRandomMaterials(
  count: number = 10,
): Promise<GeneratedMaterial[]> {
  // 1. Determine quality distribution via code
  const distribution = getRandomQualityDistribution(count);

  const distributionDesc = Object.entries(distribution)
    .filter(([, num]) => num > 0)
    .map(([quality, num]) => `${quality}: ${num}个`)
    .join('，');

  console.log(`[MaterialGenerator] Target Distribution: ${distributionDesc}`);

  const systemPrompt = `
  你是一个修仙世界的「天道」系统。负责生成符合世界观的修仙材料。
  
  【生成规则】
  1. **基本属性**：
     - 名称(name)：2-8字，古风修仙感。
     - 类型(type)：药材(herb)、矿石(ore)、妖兽材料(monster)、天材地宝(tcdb)、特殊辅料(aux)。
        * 注意：天材地宝(tcdb)和特殊辅料(aux)通常对应【玄品】及以上品质。凡品、灵品尽量生成 herb, ore, monster。
     - 五行(element)：金、木、水、火、土、风、雷、冰 随机分配。
     
  2. **定价(price)**：根据品质参考如下灵石价格范围，可浮动：
     - 凡品: 10-100
     - 灵品: 100-500
     - 玄品: 500-2000
     - 真品: 2000-5000
     - 地品: 5000-20000
     - 天品: 20000-100000
     - 仙品/神品: 100000+
     
  3. **数量(quantity)**：每个项目的堆叠数量，默认 1~5 随机，稀有物品倾向于 1。
  
  4. **描述(description)**：60-100字。描述其外形、产地、用途或传说。风格沧桑古朴，符合修仙世界观。
`;

  const userPrompt = `
  请生成恰好 ${count} 个材料(items数量)。
  
  **必须严格按照以下品质分布生成：**
  ${distributionDesc}
  
  请直接输出符合规则和 Schema 的 JSON。
`;

  try {
    const aiResponse = await object(
      systemPrompt,
      userPrompt,
      {
        schema: MaterialsBatchSchema,
        schemaName: '修仙界的材料列表',
      },
      true, // use fast model
    );

    return aiResponse.object.items;
  } catch (error) {
    console.error('Material Generation Failed:', error);
    throw new Error('天道暂隐，材料生成失败');
  }
}
