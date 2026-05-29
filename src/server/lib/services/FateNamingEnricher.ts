import { renderPrompt } from '@server/lib/prompts';
import { object } from '@server/utils/aiClient';
import { stableCompactStringify, truncateText } from '@server/utils/llmPayload';
import type { Quality } from '@shared/types/constants';
import z from 'zod';

export interface FateNamingFacts {
  quality: Quality;
  primaryEffectLabel: string;
  burdenEffectLabel?: string;
  isDualSided: boolean;
  fallbackDescription: string;
}

const fateNamingSchema = z.object({
  fates: z.array(
    z.object({
      name: z
        .string()
        .describe('符合修仙气质的命格名称，严格为 4-5 个汉字'),
      description: z.string().describe('与效果相符的命格描述'),
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
    if (
      process.env.DISABLE_LLM_NAMING === 'true' ||
      process.env.NEXT_PUBLIC_DISABLE_LLM_NAMING === 'true'
    ) {
      return false;
    }
    if (process.env.ENABLE_LLM_NAMING === 'false') return false;
    return true;
  }

  async enrichBatch(
    facts: FateNamingFacts[],
  ): Promise<FateNamingResult[] | null> {
    const enabled =
      this.enabledOverride ?? FateNamingEnricher.resolveDefaultEnabled();
    if (!enabled || facts.length === 0) return null;

    try {
      const candidatesJson = stableCompactStringify({
        candidates: facts.map((fact) => ({
          quality: fact.quality,
          primaryEffectLabel: fact.primaryEffectLabel,
          burdenEffectLabel: fact.burdenEffectLabel,
          isDualSided: fact.isDualSided,
          fallbackDescription: truncateText(fact.fallbackDescription, 40),
        })),
      });
      const { system, user } = renderPrompt('fate-naming', { candidatesJson });
      const response = await this.withTimeout(
        object(
          system,
          user,
          {
            schema: fateNamingSchema,
            schemaName: 'FateNamingBatch',
            sceneId: 'fate-naming',
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
}
