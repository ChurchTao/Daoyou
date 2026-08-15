import { renderPrompt } from '@server/lib/prompts';
import { generateAiObject } from '@server/utils/aiClient';
import { truncateText } from '@server/utils/llmPayload';
import type { BlackMarketPricingState } from '@shared/lib/blackMarketPricing';
import { z } from 'zod';
import type { BlackMarketNpcConfig } from './BlackMarketNpcConfig';
import type {
  BlackMarketInternalObservation,
  BlackMarketNpcBeliefState,
} from './types';

const beliefSchema = z.object({
  suspectedTypes: z.array(z.string().trim().min(1).max(24)).min(1).max(3),
  suspectedQualityLabel: z.string().trim().min(1).max(40),
  confidence: z.enum(['low', 'medium', 'high']),
  clueInterpretations: z.array(z.object({
    observationId: z.string().trim().min(1).max(64),
    interpretation: z.string().trim().min(1).max(120),
  })).max(7),
  mistakenAssumptions: z.array(z.string().trim().min(1).max(100)).max(3),
  guardedTopics: z.array(z.string().trim().min(1).max(40)).max(3),
  beliefSummary: z.string().trim().min(1).max(180),
  opening: z.string().trim().min(1).max(160),
});

const DECEPTION = {
  'smiling-keeper': { deceptionStyle: 'bluffing', bluffBudget: 2 },
  'silent-elder': { deceptionStyle: 'withholding', bluffBudget: 0 },
  'urgent-cultivator': { deceptionStyle: 'evasive', bluffBudget: 1 },
} as const;

function valuationPosture(multiplier: number): string {
  if (multiplier < 0.55) return '明显低估';
  if (multiplier < 0.85) return '略有低估';
  if (multiplier <= 1.15) return '自认公允';
  if (multiplier <= 1.55) return '略有高估';
  return '明显高估';
}

function perceivedValueBand(pricing: BlackMarketPricingState) {
  return {
    low: Math.max(1, Math.round(pricing.initialPrice * 0.82)),
    high: Math.max(1, Math.round(pricing.initialPrice * 1.18)),
  };
}

function fallbackBelief(input: {
  npc: BlackMarketNpcConfig;
  pricing: BlackMarketPricingState;
  observations: BlackMarketInternalObservation[];
}): { belief: BlackMarketNpcBeliefState; opening: string; degraded: boolean } {
  const deception = DECEPTION[input.npc.id];
  return {
    belief: {
      suspectedTypes: ['来历不明的旧物'],
      suspectedQualityLabel: '品阶难辨',
      confidence: input.pricing.cognitionMultiplier > 1.3 ? 'high' : 'medium',
      perceivedValueBand: perceivedValueBand(input.pricing),
      clueInterpretations: input.observations.slice(0, 5).map((item) => ({
        observationId: item.id,
        interpretation: item.safeFact,
      })),
      mistakenAssumptions: ['外层伪装足以影响对核心状态的判断'],
      guardedTopics: ['来历', '真实用途'],
      beliefSummary: `货主依据有限迹象自行估价，对这件货的判断${valuationPosture(input.pricing.cognitionMultiplier)}。`,
      ...deception,
      bluffsUsed: 0,
    },
    opening: input.npc.opening,
    degraded: true,
  };
}

export class BlackMarketPerceptionService {
  async build(input: {
    npc: BlackMarketNpcConfig;
    pricing: BlackMarketPricingState;
    observations: BlackMarketInternalObservation[];
    abortSignal?: AbortSignal;
  }): Promise<{ belief: BlackMarketNpcBeliefState; opening: string; degraded: boolean }> {
    const fallback = fallbackBelief(input);
    const visibleObservations = input.observations.map((item) => ({
      id: item.id,
      topic: item.topic,
      fact: truncateText(item.safeFact, 140),
    }));
    const { system, user } = renderPrompt('black-market-perception', {
      payloadJson: JSON.stringify({
        npc: {
          name: input.npc.name,
          identity: input.npc.identity,
          voice: input.npc.voice,
          disposition: input.pricing.disposition,
          valuationPosture: valuationPosture(input.pricing.cognitionMultiplier),
          currentAsk: input.pricing.initialPrice,
          perceivedValueBand: perceivedValueBand(input.pricing),
        },
        observations: visibleObservations,
      }),
    });
    const timeoutSignal = AbortSignal.timeout(10_000);
    const abortSignal = input.abortSignal
      ? AbortSignal.any([input.abortSignal, timeoutSignal])
      : timeoutSignal;
    try {
      const response = await generateAiObject({
        system,
        prompt: user,
        schema: beliefSchema,
        name: 'BlackMarketNpcBelief',
        sceneId: 'black-market-perception',
        abortSignal,
        maxOutputTokens: 900,
      });
      const allowedIds = new Set(input.observations.map((item) => item.id));
      const deception = DECEPTION[input.npc.id];
      return {
        belief: {
          ...response.output,
          clueInterpretations: response.output.clueInterpretations.filter(
            (item) => allowedIds.has(item.observationId),
          ),
          perceivedValueBand: perceivedValueBand(input.pricing),
          ...deception,
          bluffsUsed: 0,
        },
        opening: response.output.opening,
        degraded: false,
      };
    } catch (error) {
      if (input.abortSignal?.aborted) throw error;
      console.warn('[black-market] perception LLM fallback', { error });
      return fallback;
    }
  }
}

export const blackMarketPerceptionService = new BlackMarketPerceptionService();
