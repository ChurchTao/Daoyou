import z from 'zod';
import {
  CreationProductType,
  RolledAffix,
  MaterialQualityProfile,
} from '../types';
import { ElementType } from '@/types/constants';
import { object } from '@/utils/aiClient';

export interface ProductNamingFacts {
  productType: CreationProductType;
  elementBias?: ElementType;
  dominantTags: string[];
  rolledAffixes: RolledAffix[];
  qualityProfile: MaterialQualityProfile;
  materialNames: string[];
}

const namingResultSchema = z.object({
  name: z.string().describe('符合规范的产物名称'),
  description: z.string().describe('富有仙侠意境的产物描述'),
  styleInsight: z.string().optional().describe('LLM对命名的风格洞察'),
});

export type ProductNamingResult = z.infer<typeof namingResultSchema>;

export class DeepSeekProductNamingEnricher {
  private readonly enabled: boolean =
    process.env.NEXT_PUBLIC_ENABLE_LLM_NAMING === 'true';

  async enrich(
    facts: ProductNamingFacts,
  ): Promise<ProductNamingResult | null> {
    if (!this.enabled) return null;

    try {
      const response = await this.callAI(facts);
      return response.object;
    } catch (error) {
      console.error('[DeepSeekProductNamingEnricher] LLM naming failed:', error);
      return null;
    }
  }

  protected async callAI(facts: ProductNamingFacts) {
    return await object(
      this.buildSystemPrompt(facts.productType),
      JSON.stringify({
        productType: facts.productType,
        element: facts.elementBias,
        intentTags: facts.dominantTags,
        affixes: facts.rolledAffixes.map((a) => ({
          name: a.name,
          desc: a.description,
        })),
        quality: facts.qualityProfile.weightedAverageQuality,
        materials: facts.materialNames,
      }),
      {
        schema: namingResultSchema,
        schemaName: 'ProductNamingResult',
      },
      true, // 使用 fast model
    );
  }

  private buildSystemPrompt(productType: CreationProductType): string {
    const basePrompt = `你是修仙世界观下的“天道命名碑”。你的任务是根据给定的炼制信息，为产物赋予一个极具仙侠意境的名称和描述。
严禁出现任何现代、网游感词汇（如：暴击、防御、Buff、等级、属性点等）。
使用古典、文言化表达，语言应凝练且富有张力。
描述要求：侧重炼制时的“天地异象”或使用时的“身体感官”，字数控制在 40-80 字之间。`;

    let specificRules = '';

    if (productType === 'gongfa') {
      specificRules = `
针对【功法典籍 (gongfa)】，命名规范如下：
1. 采用 {意象}{属性}{后缀} 或 {器物}{动词}{后缀} 结构。
2. 可选后缀：诀、经、典、录、功、篇、真解、要、图、法、书。
3. 风格应体现出该功法的运行逻辑或道韵内涵。`;
    } else if (productType === 'skill') {
      specificRules = `
针对【神通秘术 (skill)】，命名规范如下：
1. 采用 {属性}{意象}{招式} 或 {动词}{意象}{术} 结构。
2. 可选后缀：术、法、印、斩、指、遁、禁、阵、化、影、劫、轮、域。
3. 风格应侧重威能释放或神秘玄奥的视觉感。`;
    } else if (productType === 'artifact') {
      specificRules = `
针对【法宝灵器 (artifact)】，命名规范如下：
1. 侧重材质、部位与功能的结合，体现“重器”感。
2. 命名应体现出器物的厚重或灵动，结合天地异象背景。
3. 避免过于直白的武器命名，多使用：玺、钟、鼎、旙、剑、梭、珠等仙家法物。`;
    }

    return basePrompt + specificRules;
  }
}
