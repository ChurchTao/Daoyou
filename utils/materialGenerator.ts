import { z } from 'zod';
import {
  ELEMENT_VALUES,
  MATERIAL_TYPE_VALUES,
  Quality,
  QUALITY_VALUES,
} from '../types/constants';
import { objectArray } from './aiClient';

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
你是一个修仙世界的「天道」系统。负责生成符合世界观的修仙材料。请严格依下述规则生成：

### 一、生成规则

1. **名称（name）**
  - 长度：2–8 个汉字。
  - 风格：古朴玄奥，贴合《凡人修仙传》小说世界观（如“赤炎藤”、“玄冥骨砂”）。
  - 禁止：现代词、西幻词、重复常见模板（如“千年灵芝”“万年雪莲”需具体化）。

2. **类型（type）** —— 必须从以下值中选择其一：
  - 药材(herb)
  - 矿石(ore)
  - 妖兽材料(monster)
  - 天材地宝(tcdb)
  - 特殊辅料(aux)
  
  > 注：**天材地宝** 与 **特殊辅料** 仅可用于 **玄品及以上** 品质

3. **品质（rank）** —— 必须从以下值中选择其一：
  - 凡品
  - 灵品
  - 玄品
  - 真品
  - 地品
  - 天品
  - 仙品
  - 神品
  
  > 注：**品质** 影响材料的稀有度，不要直接把品质放到名称里。

4. **五行属性（element）** —— 必须从以下值中选择其一：
  - 金
  - 木
  - 水
  - 火
  - 土
  - 风
  - 雷
  - 冰

5. **描述（description）**
  - 字数：60–100 字。
  - 内容：说明外形、产地（如“生于极北冰渊裂缝”）、用途（如“可炼制筑基丹”）或风险（如“触之寒毒入髓”）。
  - 风格：沧桑、克制、略带危险感，符合“凡人流”现实修仙基调。

6. **价格（price）**
  - 凡品：10–100
  - 灵品：100–500
  - 玄品：500–2000
  - 真品：2000–5000
  - 地品：5000–20000
  - 天品：20000–100000
  - 仙品/神品：100000+

7. **数量（quantity）**
  - 凡品：2–5
  - 灵品：1–3
  - 玄品及以上：1（神品、仙品、天品、地品必须为 1）

### 二、禁止行为
  - 不得虚构未列出的 type / rank / element 值。
  - 不得使用英文、拼音或符号混杂名称。
  - 不得描述“无敌”“必成大道”等违背凡人流平衡性的效果。

### 三、输出格式
  - 请直接输出符合规则和 Schema 的 JSON。
`;

  const userPrompt = `
  现在，请生成恰好 ${count} 项修仙材料。
  
  **必须严格按照以下品质分布生成：**
  ${distributionDesc}
  
  请直接输出符合规则和 Schema 的 JSON。
`;

  try {
    const aiResponse = await objectArray(
      systemPrompt,
      userPrompt,
      {
        schema: MaterialSchema,
        schemaName: '修仙界的材料',
      },
      false, // use fast model
    );

    return aiResponse.object;
  } catch (error) {
    console.error('Material Generation Failed:', error);
    throw new Error('天道暂隐，材料生成失败');
  }
}
