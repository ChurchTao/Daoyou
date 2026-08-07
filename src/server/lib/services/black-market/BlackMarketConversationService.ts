import { renderPrompt } from '@server/lib/prompts';
import { generateAiObject } from '@server/utils/aiClient';
import { stableCompactStringify, truncateText } from '@server/utils/llmPayload';
import { z } from 'zod';
import type { BlackMarketNpcConfig } from './BlackMarketNpcConfig';
import type {
  BlackMarketConversationJudgment,
  BlackMarketSafeClue,
} from './types';

const judgmentSchema = z.object({
  intent: z.enum(['inspect', 'question', 'haggle', 'chat', 'buy', 'leave']),
  strategy: z.enum([
    'reason',
    'relationship',
    'pressure',
    'bluff',
    'direct_offer',
    'unknown',
  ]),
  argumentQuality: z.union([z.literal(0), z.literal(1), z.literal(2)]),
  referencedClueIds: z.array(z.string().min(1).max(64)).max(3),
  reply: z.string().trim().min(1).max(220),
});

export class BlackMarketConversationService {
  async judge(input: {
    action: 'inspect' | 'question' | 'haggle';
    message?: string;
    offeredPrice?: number;
    npc: BlackMarketNpcConfig;
    allowedClue?: BlackMarketSafeClue;
    knownClues: Array<{ id: string; text: string }>;
    currentPrice: number;
    abortSignal?: AbortSignal;
  }): Promise<{
    judgment: BlackMarketConversationJudgment;
    degraded: boolean;
  }> {
    if (input.action === 'haggle' && !input.message?.trim()) {
      return {
        degraded: false,
        judgment: {
          intent: 'haggle',
          strategy: 'direct_offer',
          argumentQuality: 0,
          referencedClueIds: [],
          reply: '摊主掂量着你的价钱，神色没有立刻松动。',
        },
      };
    }
    const payload = stableCompactStringify({
      action: input.action,
      playerMessage: truncateText(input.message ?? '', 240),
      offeredPrice: input.offeredPrice ?? null,
      currentPrice: input.currentPrice,
      npc: {
        name: input.npc.name,
        voice: input.npc.voice,
      },
      allowedClue: input.allowedClue
        ? {
            id: input.allowedClue.id,
            kind: input.allowedClue.kind,
            fact: input.allowedClue.fact,
          }
        : null,
      knownClues: input.knownClues,
    });
    const { system, user } = renderPrompt('black-market-conversation', {
      payloadJson: payload,
    });

    try {
      const response = await generateAiObject({
        system,
        prompt: user,
        schema: judgmentSchema,
        name: 'BlackMarketConversationJudgment',
        sceneId: 'black-market-conversation',
        abortSignal: input.abortSignal,
        maxOutputTokens: 600,
      });
      return { judgment: response.output, degraded: false };
    } catch (error) {
      if (input.abortSignal?.aborted) throw error;
      console.warn('[black-market] conversation LLM fallback', {
        action: input.action,
        npcId: input.npc.id,
        error,
      });
      return {
        degraded: true,
        judgment: {
          intent: input.action,
          strategy: 'unknown',
          argumentQuality: 0,
          referencedClueIds: [],
          reply:
            input.allowedClue?.fallbackText ??
            '摊主盯着你看了片刻，没有接下这轮讨价还价。',
        },
      };
    }
  }
}

export const blackMarketConversationService =
  new BlackMarketConversationService();
