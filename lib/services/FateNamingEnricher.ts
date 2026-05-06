import type { ElementType, Quality } from '@/types/constants';
import z from 'zod';
import { object } from '@/utils/aiClient';

export interface FateNamingFacts {
  quality: Quality;
  coreLabel: string;
  auraSummary: string;
  tags: string[];
  mainRoots: ElementType[];
  effectLines: string[];
  fallbackName: string;
  fallbackDescription: string;
}

const fateNamingSchema = z.object({
  fates: z.array(
    z.object({
      name: z.string().describe('符合修仙气质的命格名称'),
      description: z.string().describe('与词条效果相符的命格描述'),
      styleInsight: z.string().optional().describe('命名风格洞察'),
    }),
  ),
});

export interface FateNamingResult {
  name: string;
  description: string;
  styleInsight?: string;
}

const DEFAULT_NAMING_TIMEOUT_MS = 30_000;

export class FateNamingEnricher {
  private readonly enabledOverride?: boolean;
  private readonly timeoutMs: number;

  constructor(options: { enabled?: boolean; timeoutMs?: number } = {}) {
    this.enabledOverride = options.enabled;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_NAMING_TIMEOUT_MS;
  }

  private static resolveDefaultEnabled(): boolean {
    if (process.env.NEXT_PUBLIC_DISABLE_LLM_NAMING === 'true') return false;
    if (process.env.NEXT_PUBLIC_ENABLE_LLM_NAMING === 'false') return false;
    return true;
  }

  async enrichBatch(
    facts: FateNamingFacts[],
  ): Promise<FateNamingResult[] | null> {
    const enabled =
      this.enabledOverride ?? FateNamingEnricher.resolveDefaultEnabled();
    if (!enabled || facts.length === 0) return null;

    try {
      const response = await this.withTimeout(
        object(
          this.buildSystemPrompt(),
          JSON.stringify(
            {
              candidates: facts.map((fact) => ({
                quality: fact.quality,
                coreLabel: fact.coreLabel,
                auraSummary: fact.auraSummary,
                tags: fact.tags,
                mainRoots: fact.mainRoots,
                effectLines: fact.effectLines,
                fallbackName: fact.fallbackName,
                fallbackDescription: fact.fallbackDescription,
              })),
            },
            null,
            2,
          ),
          {
            schema: fateNamingSchema,
            schemaName: 'FateNamingBatch',
          },
          true,
        ),
      );

      if (response.object.fates.length !== facts.length) {
        return null;
      }

      return response.object.fates;
    } catch (error) {
      console.error('[FateNamingEnricher] LLM naming failed:', error);
      return null;
    }
  }

  private async withTimeout<T>(promise: Promise<T>): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        setTimeout(
          () => reject(new Error('LLM fate naming timeout')),
          this.timeoutMs,
        );
      }),
    ]);
  }

  private buildSystemPrompt(): string {
    return `你是修仙世界的“天机判词官”。你的任务是根据候选命格的词条效果，为每个命格起名并补全描述。

【输出目标】
1. 名称必须是 3-5 个常用汉字。
2. 名称必须像“命格 / 灵体 / 灵胎 / 灵台 / 灵骨”这类先天气数，不要像功法、法宝、神通。
3. 名称要和词条效果严格相符，不能只看意象。
4. 描述要点出“此人天生是什么样、会引来什么样的天机、又要付出什么代价”。
5. 禁止网游术语、数值词、夸张口号、冷僻字。

【风格约束】
- 语气凝练、沉静、偏凡人流仙侠。
- 不要使用“无敌、最强、至尊、神王”等浮夸词。
- 不要直接复述 fallbackName，除非它已经最贴切。

你必须返回与输入候选数量完全一致、顺序完全一致的结果。`;
  }
}
