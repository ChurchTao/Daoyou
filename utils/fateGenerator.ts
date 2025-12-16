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

const FatesResponseSchema = z.object({
  fates: z.array(PreHeavenFateSchema),
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
  你乃修仙界至高意志——「天道」，执掌众生气运流转。凡人不可妄求，唯有机缘者得赐先天气运或特殊体质。你依天理造化，赋予其名、其质、其效，然一切须合品阶之限、阴阳之衡。

【气运铁律】
1. **名称（name）**：3~6字，需符合修仙世界观，可为气运（如“天煞孤星”，“剑仙转世”）或修仙者体质（如“九幽冥骨体”，“荒古圣体”）。
2. **类型（type）**：仅限“吉”或“凶”。吉运未必无害，凶运亦藏机缘。
3. **品质（quality）**：仅限以下之一：${QUALITY_VALUES.join('、')}。
4. **属性加成（attribute_mod）**：
   - 加成对象限于：体魄、灵力、悟性、速度、神识。
   - 每项加成为整数，可正可负（如体魄+15，悟性-10）。
   - 属性数量依品质而定：
     - 凡品 / 灵品：1项
     - 玄品 / 真品 / 地品：2项
     - 天品 / 仙品：3项
     - 神品：4项
   - 所有气运都会有属性加成，请勿出现无属性加成的情况。
   - 所有加成绝对值之和必须严格落在该品质允许范围内：
     ${Object.entries(QUALITY_RANGES)
       .map(([q, range]) => `- ${q}: [${range.min}, ${range.max}]`)
       .join('\n    ')}
5. **描述（description）**：20~120字，须包含：
   - 气运来源（如“生于雷劫余烬”）
   - 触发条件或代价（如“每逢月蚀，灵力反噬”）
   - 风格需神秘、古雅、富有宿命感。
6. **属性组合**
   - 鼓励单一属性加成极度突出。
   - 避免属性加成过于均衡。
   - 天道厌弃平庸！所赐气运须有锋芒、有缺陷、有宿命

【输出格式】
- 必须返回**纯 JSON 对象**，字段包括：name、type、quality、attribute_mod、description。
- attribute_mod 为对象，键为属性名，值为整数（如 {"悟性": 20, "体魄": -10}）,至少有一个加成属性。
- 无任何额外文本，首尾无换行。
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
        schemaName: '一批先天气运的结构',
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
