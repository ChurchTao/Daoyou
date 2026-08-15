import { renderPrompt } from '@server/lib/prompts';
import { generateAiObject, streamAiText } from '@server/utils/aiClient';
import { truncateText } from '@server/utils/llmPayload';
import type { BlackMarketNegotiationOutcome } from '@shared/lib/blackMarketNegotiation';
import { z } from 'zod';
import type { BlackMarketTurnContext, BlackMarketTurnProposal } from './types';

const turnProposalSchema = z.object({
  intent: z.enum([
    'chat',
    'observe',
    'question',
    'challenge',
    'haggle',
    'buy',
    'leave',
  ]),
  referencedObservationIds: z.array(z.string().min(1).max(64)).max(5),
  revealObservationId: z.string().min(1).max(64).optional(),
  reasoning: z.object({
    evidenceStrength: z.enum(['none', 'weak', 'credible']),
    conflictsWithBelief: z.boolean(),
    feelsManipulated: z.boolean(),
    dominantMotive: z.enum(['profit', 'urgency', 'pride', 'caution']),
  }),
  beliefPressure: z.union([
    z.literal(-2),
    z.literal(-1),
    z.literal(0),
    z.literal(1),
  ]),
  beliefPatch: z.object({
    confidenceDelta: z.union([
      z.literal(-1),
      z.literal(0),
      z.literal(1),
    ]),
    beliefSummary: z.string().trim().min(1).max(180).optional(),
    interpretationUpdates: z
      .array(
        z.object({
          observationId: z.string().trim().min(1).max(64),
          interpretation: z.string().trim().min(1).max(120),
        }),
      )
      .max(2),
  }),
  claimPlan: z
    .object({
      topic: z.string().trim().min(1).max(40),
      mode: z.enum(['belief', 'bluff', 'evasion']),
      summary: z.string().trim().min(1).max(120),
    })
    .optional(),
  negotiation: z
    .object({
      decision: z.enum(['accept', 'counter', 'reject', 'end']),
      concession: z.number().min(0).max(1),
      patienceDelta: z.union([z.literal(-2), z.literal(-1)]),
    })
    .optional(),
  gesture: z.string().trim().min(1).max(100),
  memoryPatch: z.object({
    promises: z.array(z.string().trim().min(1).max(80)).max(2),
    activeBluffs: z.array(z.string().trim().min(1).max(80)).max(2),
    turnSummary: z.string().trim().min(1).max(160),
  }),
});

function degradedProposal(
  context: BlackMarketTurnContext,
): BlackMarketTurnProposal {
  const hasOffer = context.offeredPrice != null;
  return {
    intent: hasOffer ? 'haggle' : 'chat',
    referencedObservationIds: [],
    reasoning: {
      evidenceStrength: 'none',
      conflictsWithBelief: false,
      feelsManipulated: false,
      dominantMotive: context.npc.identity.includes('亡命')
        ? 'urgency'
        : 'profit',
    },
    beliefPressure: 0,
    beliefPatch: {
      confidenceDelta: 0,
      interpretationUpdates: [],
    },
    claimPlan: { topic: '态度', mode: 'evasion', summary: '暂不表露更多判断' },
    negotiation: hasOffer
      ? { decision: 'counter', concession: 0.25, patienceDelta: -1 }
      : undefined,
    gesture: hasOffer
      ? '他用指节轻敲摊沿，重新掂量这份报价。'
      : '他没有立刻接话，只把货物往阴影里挪了半寸。',
    memoryPatch: {
      promises: [],
      activeBluffs: [],
      turnSummary: '货主暂时保持原有判断。',
    },
  };
}

export function fallbackTurnReply(input: {
  context: BlackMarketTurnContext;
  proposal: BlackMarketTurnProposal;
  negotiationOutcome?: BlackMarketNegotiationOutcome;
}): string {
  const withClaim = (body: string) =>
    input.proposal.claimPlan?.summary
      ? `${input.proposal.claimPlan.summary} ${body}`
      : body;
  if (!input.negotiationOutcome) {
    if (input.proposal.intent === 'buy')
      return withClaim(
        `既然你认这个价，便按${input.context.currentPrice}灵石成交。`,
      );
    if (input.proposal.intent === 'leave')
      return withClaim('买卖不成也无妨，暗巷里没人拦你的路。');
    return (
      input.proposal.claimPlan?.summary ||
      '你看你的，我卖我的；没有把握的话，便再想清楚。'
    );
  }
  const { outcome, nextPrice } = input.negotiationOutcome;
  if (outcome === 'accepted')
    return withClaim(`行，就按你说的，${nextPrice}灵石。`);
  if (outcome === 'countered')
    return withClaim(`你说得有几分道理，但最多让到${nextPrice}灵石。`);
  if (outcome === 'locked')
    return withClaim(`价就定在${nextPrice}灵石，再谈便不卖了。`);
  return withClaim(`这个价不成，仍是${nextPrice}灵石。`);
}

function turnPayload(context: BlackMarketTurnContext): string {
  return JSON.stringify({
    scene: context.scene,
    listing: context.listing,
    npc: {
      voice: context.npc.voice,
      identity: context.npc.identity,
      flexibilityLevel: context.npc.flexibilityLevel,
      mood: context.npc.mood,
    },
    belief: context.belief,
    memory: {
      ...context.memory,
      claims: context.memory.claims.slice(-8),
    },
    currentPrice: context.currentPrice,
    knownObservations: context.knownObservations,
    availableObservations: context.availableObservations,
    dealReady: context.dealReady,
    canInspect: context.canInspect,
    canHaggle: context.canHaggle,
    turnsRemaining: context.turnsRemaining,
    offerAssessment: context.offerAssessment ?? null,
    offeredPrice: context.offeredPrice ?? null,
    playerMessage: truncateText(context.playerMessage, 240),
    conversation: context.conversation.slice(-6).map((message) => ({
      role: message.role,
      body: truncateText(message.body, 140),
    })),
  });
}

function replyPayload(input: {
  context: BlackMarketTurnContext;
  proposal: BlackMarketTurnProposal;
  negotiationOutcome?: BlackMarketNegotiationOutcome;
}): string {
  const finalPrice = input.negotiationOutcome
    ? input.negotiationOutcome.nextPrice
    : input.proposal.intent === 'buy'
      ? input.context.currentPrice
      : undefined;
  const narrativeBelief = {
    ...input.context.belief,
    perceivedValueBand: undefined,
  };
  const narrativeMemory = {
    ...input.context.memory,
    playerOffers: undefined,
  };
  return JSON.stringify({
    npc: {
      name: input.context.npc.name,
      voice: input.context.npc.voice,
      identity: input.context.npc.identity,
      mood: input.context.npc.mood,
    },
    belief: narrativeBelief,
    memory: narrativeMemory,
    playerMessage: truncateText(input.context.playerMessage, 240),
    gesture: input.proposal.gesture,
    intent: input.proposal.intent,
    reasoning: input.proposal.reasoning,
    claimPlan: input.proposal.claimPlan ?? null,
    negotiationResult: input.negotiationOutcome
      ? {
          outcome: input.negotiationOutcome.outcome,
          finalPrice,
        }
      : input.proposal.intent === 'buy'
        ? { outcome: 'accepted', finalPrice }
        : null,
    turnsRemaining: input.context.turnsRemaining,
  });
}

export class BlackMarketConversationService {
  async proposeTurn(input: {
    context: BlackMarketTurnContext;
    abortSignal?: AbortSignal;
  }) {
    const { system, user } = renderPrompt('black-market-turn', {
      payloadJson: turnPayload(input.context),
    });
    const timeoutSignal = AbortSignal.timeout(10_000);
    const abortSignal = input.abortSignal
      ? AbortSignal.any([input.abortSignal, timeoutSignal])
      : timeoutSignal;
    try {
      const response = await generateAiObject({
        system,
        prompt: user,
        schema: turnProposalSchema,
        name: 'BlackMarketTurnProposal',
        sceneId: 'black-market-turn',
        abortSignal,
        maxOutputTokens: 800,
      });
      return { proposal: response.output, degraded: false };
    } catch (error) {
      if (input.abortSignal?.aborted) throw error;
      console.warn('[black-market] turn proposal LLM fallback', { error });
      return { proposal: degradedProposal(input.context), degraded: true };
    }
  }

  streamTurnReply(input: {
    context: BlackMarketTurnContext;
    proposal: BlackMarketTurnProposal;
    negotiationOutcome?: BlackMarketNegotiationOutcome;
    abortSignal?: AbortSignal;
  }) {
    const { system, user } = renderPrompt('black-market-reply', {
      payloadJson: replyPayload(input),
    });
    const timeoutSignal = AbortSignal.timeout(15_000);
    const abortSignal = input.abortSignal
      ? AbortSignal.any([input.abortSignal, timeoutSignal])
      : timeoutSignal;
    return streamAiText({
      system,
      prompt: user,
      sceneId: 'black-market-reply',
      abortSignal,
      maxOutputTokens: 220,
    });
  }
}

export const blackMarketConversationService =
  new BlackMarketConversationService();
