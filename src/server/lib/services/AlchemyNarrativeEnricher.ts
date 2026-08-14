import { renderPrompt } from '@server/lib/prompts';
import { generateAiObject } from '@server/utils/aiClient';
import { formatAlchemyPropertyVector } from '@shared/lib/alchemyProperties';
import type { ElementType, Quality } from '@shared/types/constants';
import type {
  AlchemyFocusMode,
  PillFamily,
  WeightedAlchemyProperty,
} from '@shared/types/consumable';
import { z } from 'zod';

function getPillFamilyLabel(family: PillFamily): string {
  switch (family) {
    case 'healing':
      return '疗伤丹';
    case 'mana':
      return '回元丹';
    case 'detox':
      return '解毒丹';
    case 'cultivation':
      return '养元丹';
    case 'insight':
      return '悟心丹';
    case 'breakthrough':
      return '破境丹';
    case 'tempering':
      return '炼体丹';
    case 'marrow_wash':
      return '洗髓丹';
    case 'longevity':
      return '延寿丹';
    case 'hybrid':
      return '和元丹';
  }
}

function formatMaterialList(materialNames: string[]): string {
  if (materialNames.length === 0) return '无';
  return Array.from(new Set(materialNames)).join('、');
}

const improvisedPillCopySchema = z.object({
  name: z.string().min(2).max(24).describe('符合凡人流仙侠气质的丹药名称'),
  description: z
    .string()
    .min(24)
    .max(120)
    .describe('成丹评述，强调炉意与药性，不重复 UI 的效果说明'),
  styleInsight: z.string().max(80).optional(),
});

export type ImprovisedPillCopy = z.infer<typeof improvisedPillCopySchema>;

export interface ImprovisedPillCopyFacts {
  family: PillFamily;
  dominantElement?: ElementType;
  quality: Quality;
  materialNames: string[];
  propertyVector: WeightedAlchemyProperty[];
  stability: number;
  toxicityRating: number;
  userPrompt: string;
  focusMode: AlchemyFocusMode;
}

const DEFAULT_NARRATIVE_TIMEOUT_MS = 30_000;

export class AlchemyNarrativeEnricher {
  private readonly enabled: boolean;
  private readonly timeoutMs: number;

  constructor(options: { enabled?: boolean; timeoutMs?: number } = {}) {
    this.enabled =
      options.enabled ?? AlchemyNarrativeEnricher.resolveDefaultEnabled();
    this.timeoutMs = options.timeoutMs ?? DEFAULT_NARRATIVE_TIMEOUT_MS;
  }

  private static resolveDefaultEnabled(): boolean {
    if (process.env.DISABLE_LLM_NAMING === 'true') return false;
    if (process.env.ENABLE_LLM_NAMING === 'false') return false;
    return true;
  }

  async generateImprovisedPillCopy(
    facts: ImprovisedPillCopyFacts,
  ): Promise<ImprovisedPillCopy | null> {
    if (!this.enabled) return null;

    try {
      const variables = this.buildImprovisedPillVariables(facts);
      const { system, user } = renderPrompt(
        'alchemy-improvised-copy',
        variables,
      );
      const response = await this.withTimeout(
        generateAiObject({
          system,
          prompt: user,
          schema: improvisedPillCopySchema,
          name: 'ImprovisedPillCopy',
          sceneId: 'alchemy-improvised-copy',
        }),
      );
      return response.output;
    } catch (error) {
      console.error(
        '[AlchemyNarrativeEnricher] improvised copy failed:',
        error,
      );
      return null;
    }
  }

  private async withTimeout<T>(promise: Promise<T>): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        setTimeout(
          () => reject(new Error('LLM alchemy narrative timeout')),
          this.timeoutMs,
        );
      }),
    ]);
  }

  private buildImprovisedPillVariables(facts: ImprovisedPillCopyFacts) {
    return {
      familyText: getPillFamilyLabel(facts.family),
      qualityText: facts.quality,
      elementText: facts.dominantElement ?? '未显主元素',
      materialsText: formatMaterialList(facts.materialNames),
      propertyVectorText: formatAlchemyPropertyVector(facts.propertyVector),
      stabilityText: String(facts.stability),
      toxicityText: String(facts.toxicityRating),
      userPromptText: facts.userPrompt.trim(),
      focusModeText: this.getFocusModeText(facts.focusMode),
    };
  }

  private getFocusModeText(
    focusMode: ImprovisedPillCopyFacts['focusMode'],
  ): string {
    switch (focusMode) {
      case 'focused':
        return '专精凝意';
      case 'balanced':
        return '调和并济';
      case 'risky':
        return '险进催化';
    }
  }
}
