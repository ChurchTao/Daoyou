import { renderPrompt } from '@server/lib/prompts';
import { object } from '@server/utils/aiClient';
import { stableCompactStringify, truncateText } from '@server/utils/llmPayload';
import type {
  EnemyCopyPayload,
  EnemyCopyProvider,
} from '@shared/engine/enemy-generation/EnemyCopyProvider';
import type { EnemyGenerationDraft } from '@shared/engine/enemy-generation/types';
import { z } from 'zod';

const enemyCopySchema = z.object({
  character: z.object({
    name: z.string().min(2).max(12),
    title: z.string().min(2).max(16),
    background: z.string().min(10).max(240),
    description: z.string().min(8).max(120),
  }),
  products: z.array(
    z.object({
      id: z.string(),
      name: z.string().min(2).max(18),
      description: z.string().min(8).max(120),
    }),
  ),
});

const DEFAULT_TIMEOUT_MS = 30_000;

export class ServerEnemyCopyProvider implements EnemyCopyProvider {
  private readonly enabled: boolean;
  private readonly timeoutMs: number;

  constructor(options: { enabled?: boolean; timeoutMs?: number } = {}) {
    this.enabled =
      options.enabled ?? ServerEnemyCopyProvider.resolveDefaultEnabled();
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  private static resolveDefaultEnabled(): boolean {
    if (process.env.DISABLE_LLM_NARRATIVE === 'true') return false;
    if (process.env.ENABLE_LLM_NARRATIVE === 'false') return false;
    return true;
  }

  async enrich(
    draft: EnemyGenerationDraft,
  ): Promise<EnemyCopyPayload | null> {
    if (!this.enabled) {
      return null;
    }

    try {
      const factsJson = stableCompactStringify({
        race: draft.copyFacts.race,
        realm: draft.copyFacts.realm,
        realmStage: draft.copyFacts.realmStage,
        difficulty: draft.copyFacts.difficulty,
        difficultyFactor: draft.copyFacts.difficultyFactor,
        primaryElement: draft.copyFacts.primaryElement,
        secondaryElement: draft.copyFacts.secondaryElement,
        profileTags: draft.copyFacts.profileTags,
        personaTags: draft.copyFacts.personaTags,
        character: draft.copyFacts.character,
        products: draft.copyFacts.products.map((product) => ({
          id: product.id,
          productType: product.productType,
          role: product.role,
          quality: product.quality,
          element: product.element,
          slot: product.slot,
          narrativeTags: product.narrativeTags,
          affixNames: product.affixNames.slice(0, 4),
          fallbackName: product.fallbackName,
          fallbackDescriptionSummary: truncateText(
            product.fallbackDescription,
            56,
          ),
        })),
      });
      const { system, user } = renderPrompt('enemy-narrative', {
        factsJson,
      });
      const response = await this.withTimeout(
        object(
          system,
          user,
          {
            schema: enemyCopySchema,
            schemaName: 'EnemyCopyPayload',
            sceneId: 'enemy-narrative',
          },
          true,
        ),
      );
      return response.object;
    } catch (error) {
      console.error('[ServerEnemyCopyProvider] copy generation failed:', error);
      return null;
    }
  }

  private async withTimeout<T>(promise: Promise<T>): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        setTimeout(
          () => reject(new Error('Enemy copy generation timeout')),
          this.timeoutMs,
        );
      }),
    ]);
  }
}
