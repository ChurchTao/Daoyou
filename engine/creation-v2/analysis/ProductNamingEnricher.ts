import z from 'zod';
import {
  CreationProductType,
  RolledAffix,
  MaterialQualityProfile,
} from '../types';
import { ElementType, EquipmentSlot } from '@/types/constants';
import { object } from '@/utils/aiClient';

export interface ProductNamingFacts {
  productType: CreationProductType;
  elementBias?: ElementType;
  slotBias?: EquipmentSlot;
  dominantTags: string[];
  rolledAffixes: RolledAffix[];
  qualityProfile: MaterialQualityProfile;
  materialNames: string[];
  /** 玩家在前端填写的命名/意图提示（可选） */
  userPrompt?: string;
}

const namingResultSchema = z.object({
  name: z.string().describe('符合规范的产物名称'),
  description: z.string().describe('富有仙侠意境的产物描述'),
  styleInsight: z.string().optional().describe('LLM对命名的风格洞察'),
});

export type ProductNamingResult = z.infer<typeof namingResultSchema>;

/** 单次 LLM 命名调用超时（毫秒）。失败后走 fallback 保留基础名。 */
const DEFAULT_NAMING_TIMEOUT_MS = 30_000;

/**
 * DeepSeek 命名增强器。
 *
 * 默认开启：只要具备 OPENAI_API_KEY，就会尝试调用 LLM 命名。
 * 如需显式关闭（例如离线环境），设置 `NEXT_PUBLIC_DISABLE_LLM_NAMING=true`。
 * 遗留变量 `NEXT_PUBLIC_ENABLE_LLM_NAMING=false` 也会被当作显式关闭。
 */
export class DeepSeekProductNamingEnricher {
  private readonly enabled: boolean;
  private readonly timeoutMs: number;

  constructor(options: { enabled?: boolean; timeoutMs?: number } = {}) {
    this.enabled =
      options.enabled ?? DeepSeekProductNamingEnricher.resolveDefaultEnabled();
    this.timeoutMs = options.timeoutMs ?? DEFAULT_NAMING_TIMEOUT_MS;
  }

  private static resolveDefaultEnabled(): boolean {
    if (process.env.NEXT_PUBLIC_DISABLE_LLM_NAMING === 'true') return false;
    // 遗留兼容：早期仅在显式 'true' 时启用；一旦显式设为 'false' 视为关闭，
    // 其余情况（未设置 / 其他值）一律默认开启。
    if (process.env.NEXT_PUBLIC_ENABLE_LLM_NAMING === 'false') return false;
    return true;
  }

  async enrich(
    facts: ProductNamingFacts,
  ): Promise<ProductNamingResult | null> {
    if (!this.enabled) return null;

    try {
      const response = await this.withTimeout(this.callAI(facts));
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
        slot: facts.slotBias,
        intentTags: facts.dominantTags,
        affixes: facts.rolledAffixes.map((a) => ({
          name: a.name,
          desc: a.description,
        })),
        quality: facts.qualityProfile.weightedAverageQuality,
        materials: facts.materialNames,
        ...(facts.userPrompt ? { playerIntent: facts.userPrompt } : {}),
      }),
      {
        schema: namingResultSchema,
        schemaName: 'ProductNamingResult',
      },
      true,
    );
  }

  private async withTimeout<T>(promise: Promise<T>): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        setTimeout(
          () => reject(new Error('LLM product naming timeout')),
          this.timeoutMs,
        );
      }),
    ]);
  }

  private buildSystemPrompt(productType: CreationProductType): string {
    const basePrompt = `你是修仙世界观下的“天道意志”。你的任务是根据炼制信息，为产物赋予一个符合【正统凡人流仙侠】风格的名称。

【命名核心审美】
1. **大道至简**：不要花哨的修饰词，不要试图显得文绉绉。用词要平实、凝重。
2. **名实相符**：名字应体现其核心属性（金木水火土、风雷、煞气、神魂）与形态。
3. **禁止生僻字**：严禁出现任何在现代汉语常用字表之外的字（如：觿、镝、瑬、氤 等一律禁止）。
4. **字数约束**：名称严格限制在 3-5 字。
5. **构词逻辑**：[属性/核心意象] + [功能/形态描述] + [载体/后缀]。
6. **尊重玩家意图**：如 playerIntent 字段存在，请优先契合其语气与意象，但仍需遵守以上所有命名约束。

【严禁行为】
- 严禁直接罗列材料名（如：赤炎精铁剑）。
- 严禁使用网游术语（如：防御、双刃、暴击、倍率）。
- 严禁使用“极、超、强、无敌”等缺乏底蕴的字眼。`;

    let specificRules = '';

    if (productType === 'gongfa') {
      specificRules = `
针对【功法典籍】：
- 应当像是一门传承久远的法门，透露出“功法运行逻辑”或“肉身/神魂修炼方向”。
- 常用后缀：诀、功、经、录、真解。
- 风格示例：青元剑诀、托天魔功、大衍决、明王诀、煞丹术。`;
    } else if (productType === 'skill') {
      specificRules = `
针对【神通招式】：
- 应当体现瞬时的破坏力、变化或某种规则的运用。
- 常用后缀：术、咒、雷、斩、指、闪、域、禁。
- 风格示例：辟邪神雷、血箭术、罗烟步、幻影闪、乾坤五行手。`;
    } else if (productType === 'artifact') {
      specificRules = `
针对【法宝灵器】：
- 应当体现器物的实体感与厚重感。
- **严禁**直接描述功能（如：禁止“玄金盾”）。
- 后缀必须是明确的法宝类型：鼎、珠、镜、钟、旗、印、梭、剑、佩、甲、衣、裙、扇，等。
- 风格示例：虚天鼎、灭仙珠、六翼霜蚣、风雷翅、混元钵、定神镜。`;
    }

    return basePrompt + specificRules;
  }
}
