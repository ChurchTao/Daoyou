import { renderPrompt } from '@server/lib/prompts';
import { redis } from '@server/lib/redis';
import { parseRedisJson } from '@server/lib/redis/json';
import { generateAiObject } from '@server/utils/aiClient';
import { stableCompactStringify, truncateText } from '@server/utils/llmPayload';
import { sanitizeBlackMarketObservationText } from '@shared/lib/blackMarketObservations';
import type { Material } from '@shared/types/cultivator';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { BlackMarketInternalObservation } from './types';

const CACHE_TTL_SECONDS = 24 * 60 * 60;

const observationTextSchema = z.object({
  text: z.string().trim().min(8).max(180),
  safeFact: z.string().trim().min(8).max(180),
  truthExplanation: z.string().trim().min(8).max(180),
});

const observationSetSchema = z
  .object({
    surface: z
      .array(
        observationTextSchema.extend({
          topic: z.enum(['appearance', 'damage']),
        }),
      )
      .length(2),
    inspection: z
      .array(
        observationTextSchema.extend({
          topic: z.enum(['appearance', 'aura', 'damage', 'origin']),
          reliability: z.enum(['direct', 'inferred']),
        }),
      )
      .min(3)
      .max(5),
  })
  .superRefine((value, context) => {
    const surfaceTopics = new Set(value.surface.map((item) => item.topic));
    if (!surfaceTopics.has('appearance') || !surfaceTopics.has('damage')) {
      context.addIssue({
        code: 'custom',
        message: 'surface 必须各包含一条 appearance 与 damage',
      });
    }
    const inspectionTopics = value.inspection.map((item) => item.topic);
    if (new Set(inspectionTopics).size !== inspectionTopics.length) {
      context.addIssue({
        code: 'custom',
        message: 'inspection topic 不得重复',
      });
    }
  });

function cacheKey(input: {
  item: Material;
  itemLibraryItemId: string;
  disguisedName: string;
  disguisedDescription: string;
  regionTags: readonly string[];
}): string {
  const variant = createHash('sha256')
    .update(
      stableCompactStringify({
        itemLibraryItemId: input.itemLibraryItemId,
        itemDescription: input.item.description ?? '',
        disguisedName: input.disguisedName,
        disguisedDescription: input.disguisedDescription,
        regionTags: input.regionTags,
      }),
    )
    .digest('hex');
  return `black-market:observations:v1:${variant}`;
}

function publicSafeText(text: string, item: Material): string {
  return sanitizeBlackMarketObservationText(text, item.name);
}

function materialize(
  generated: z.infer<typeof observationSetSchema>,
  item: Material,
): BlackMarketInternalObservation[] {
  return [
    ...generated.surface.map((observation, index) => ({
      id: `observation-surface-${index}`,
      topic: observation.topic,
      source: 'surface' as const,
      text: publicSafeText(observation.text, item),
      safeFact: publicSafeText(observation.safeFact, item),
      truthExplanation: observation.truthExplanation,
      reliability: 'direct' as const,
      revealedAtTurn: 0,
    })),
    ...generated.inspection.map((observation, index) => ({
      id: `observation-inspection-${index}`,
      topic: observation.topic,
      source: 'inspection' as const,
      text: publicSafeText(observation.text, item),
      safeFact: publicSafeText(observation.safeFact, item),
      truthExplanation: observation.truthExplanation,
      reliability: observation.reliability,
    })),
  ];
}

export class BlackMarketObservationService {
  async build(input: {
    item: Material;
    itemLibraryItemId: string;
    disguisedName: string;
    disguisedDescription: string;
    regionTags: readonly string[];
    abortSignal?: AbortSignal;
  }): Promise<BlackMarketInternalObservation[]> {
    const key = cacheKey(input);
    try {
      const cached = parseRedisJson<BlackMarketInternalObservation[]>(
        await redis.get(key),
        'black market observations',
      );
      if (
        cached &&
        cached.filter((item) => item.source === 'surface').length === 2 &&
        cached.filter((item) => item.source === 'inspection').length >= 3
      ) {
        return cached;
      }
    } catch (error) {
      console.warn('[black-market] observation cache read failed', { error });
    }

    const { system, user } = renderPrompt('black-market-observations', {
      payloadJson: stableCompactStringify({
        truth: {
          name: input.item.name,
          type: input.item.type,
          rank: input.item.rank,
          element: input.item.element ?? null,
          description: truncateText(input.item.description ?? '', 800),
        },
        disguise: {
          name: input.disguisedName,
          description: input.disguisedDescription,
        },
        regionTags: input.regionTags.filter(Boolean).slice(0, 3),
      }),
    });
    const response = await generateAiObject({
      system,
      prompt: user,
      schema: observationSetSchema,
      name: 'BlackMarketObservationSet',
      sceneId: 'black-market-observations',
      abortSignal: input.abortSignal,
      maxOutputTokens: 1_500,
    });
    const observations = materialize(response.output, input.item);
    try {
      await redis.set(
        key,
        JSON.stringify(observations),
        'EX',
        CACHE_TTL_SECONDS,
      );
    } catch (error) {
      console.warn('[black-market] observation cache write failed', { error });
    }
    return observations;
  }
}

export const blackMarketObservationService =
  new BlackMarketObservationService();
