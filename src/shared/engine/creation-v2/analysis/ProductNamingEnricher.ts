import { renderPrompt } from '@server/lib/prompts';
import type { TemplateVariableMap } from '@server/lib/template/render';
import { object } from '@server/utils/aiClient';
import { ElementType, EquipmentSlot, Quality } from '@shared/types/constants';
import z from 'zod';
import { CreationProductType, RolledAffix } from '../types';

export interface ProductNamingFacts {
  productType: CreationProductType;
  projectionQuality: Quality;
  elementBias?: ElementType;
  slotBias?: EquipmentSlot;
  dominantTags: string[];
  rolledAffixes: RolledAffix[];
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

interface ProductNamingPromptVariables extends TemplateVariableMap {
  productTypeLabel: string;
  projectionQuality: Quality;
  elementText: string;
  slotText: string;
  intentTagsText: string;
  affixesText: string;
  materialsText: string;
  playerIntentText: string;
}

/** 单次 LLM 命名调用超时（毫秒）。失败后走 fallback 保留基础名。 */
const DEFAULT_NAMING_TIMEOUT_MS = 30_000;

/**
 * DeepSeek 命名增强器。
 *
 * 默认开启：只要具备 OPENAI_API_KEY，就会尝试调用 LLM 命名。
 * 如需显式关闭（例如离线环境），设置 `DISABLE_LLM_NAMING=true`。
 * 遗留变量 `ENABLE_LLM_NAMING=false` 也会被当作显式关闭。
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
    if (process.env.DISABLE_LLM_NAMING === 'true') return false;
    // 遗留兼容：早期仅在显式 'true' 时启用；一旦显式设为 'false' 视为关闭，
    // 其余情况（未设置 / 其他值）一律默认开启。
    if (process.env.ENABLE_LLM_NAMING === 'false') return false;
    return true;
  }

  async enrich(facts: ProductNamingFacts): Promise<ProductNamingResult | null> {
    if (!this.enabled) return null;

    try {
      const response = await this.withTimeout(this.callAI(facts));
      return response.object;
    } catch (error) {
      console.error(
        '[DeepSeekProductNamingEnricher] LLM naming failed:',
        error,
      );
      return null;
    }
  }

  protected async callAI(facts: ProductNamingFacts) {
    const variables = this.buildPromptVariables(facts);
    const { system, user } = renderPrompt('product-naming', variables);

    console.log('炼器命名调用参数：', user);
    return await object(
      system,
      user,
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

  private buildPromptVariables(
    facts: ProductNamingFacts,
  ): ProductNamingPromptVariables {
    return {
      productTypeLabel: PRODUCT_TYPE_LABELS[facts.productType],
      projectionQuality: facts.projectionQuality,
      elementText: facts.elementBias ?? '未显主属性',
      slotText: facts.slotBias ? SLOT_LABELS[facts.slotBias] : '未指定',
      intentTagsText:
        facts.dominantTags.length > 0
          ? facts.dominantTags.join('、')
          : '无明显意图偏向',
      affixesText:
        facts.rolledAffixes.length > 0
          ? facts.rolledAffixes
              .map((affix) =>
                affix.description
                  ? `- ${affix.name}：${affix.description}`
                  : `- ${affix.name}`,
              )
              .join('\n')
          : '- 无显著词缀',
      materialsText:
        facts.materialNames.length > 0
          ? Array.from(new Set(facts.materialNames)).join('、')
          : '无',
      playerIntentText: facts.userPrompt?.trim() || '无',
    };
  }
}

const PRODUCT_TYPE_LABELS: Record<CreationProductType, string> = {
  artifact: '法宝灵器',
  gongfa: '功法典籍',
  skill: '神通招式',
};

const SLOT_LABELS: Record<EquipmentSlot, string> = {
  accessory: '饰物',
  armor: '护具',
  weapon: '兵刃',
};
