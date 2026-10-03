import { Inject, Injectable } from '@nestjs/common';
import type { ActiveCultivatorRef } from '@server/lib/auth/types.js';
import { BlackMarketConversationService } from '@server/black-market/application/BlackMarketConversationService.js';
import {
  commitBlackMarketPurchase,
  completeBlackMarketReply,
  getBlackMarketOverview,
  leaveBlackMarketSession,
  openBlackMarketSession,
  prepareBlackMarketInteraction,
} from '@server/black-market/application/BlackMarketService.js';
import { toPlayerStateMutationResponse } from '@server/player/application/state/ResourceMutationResponse.js';
import type { BlackMarketInteractStreamEvent } from '@daoyou/shared/types/blackMarket';
import type { z } from 'zod';
import type {
  CommitSchema,
  InteractSchema,
  LeaveSchema,
  OpenSessionSchema,
} from './black-market-input.js';

@Injectable()
export class BlackMarketService {
  constructor(
    @Inject(BlackMarketConversationService)
    private readonly conversation: BlackMarketConversationService,
  ) {}
  read(actor: ActiveCultivatorRef, nodeId: string) {
    return getBlackMarketOverview({ actor, nodeId });
  }

  async open(
    actor: ActiveCultivatorRef,
    nodeId: string,
    input: z.infer<typeof OpenSessionSchema>,
  ) {
    return toPlayerStateMutationResponse(
      await openBlackMarketSession({ actor, nodeId, ...input }),
    );
  }

  prepare(
    actor: ActiveCultivatorRef,
    nodeId: string,
    sessionId: string,
    command: z.infer<typeof InteractSchema>,
    abortSignal: AbortSignal,
  ) {
    return prepareBlackMarketInteraction({
      actor,
      nodeId,
      sessionId,
      command,
      abortSignal,
    });
  }

  async reply(
    prepared: Awaited<ReturnType<typeof prepareBlackMarketInteraction>>,
    signal: AbortSignal,
    emit: (event: BlackMarketInteractStreamEvent) => Promise<void>,
  ) {
    await emit({
      type: 'resolved',
      result: prepared.result,
      messageId: prepared.messageId,
      gesture: prepared.gesture,
      fallbackBody: prepared.fallbackBody,
    });
    if (signal.aborted) return;
    let body = '';
    try {
      const reply = this.conversation.streamTurnReply({
        context: prepared.replyContext,
        proposal: prepared.proposal,
        negotiationOutcome: prepared.negotiationOutcome,
        abortSignal: signal,
      });
      for await (const chunk of reply.textStream) {
        signal.throwIfAborted();
        body += chunk;
        await emit({
          type: 'reply-chunk',
          messageId: prepared.messageId,
          text: chunk,
        });
      }
      body = body.trim();
      if (!body) throw new Error('empty black market reply');
      signal.throwIfAborted();
      await completeBlackMarketReply({
        sessionId: prepared.sessionId,
        messageId: prepared.messageId,
        body,
      });
      await emit({
        type: 'reply-complete',
        messageId: prepared.messageId,
        body,
      });
    } catch (error) {
      console.warn('[black-market] reply stream fallback', { error });
      if (!signal.aborted)
        await emit({
          type: 'reply-error',
          messageId: prepared.messageId,
          fallbackBody: prepared.fallbackBody,
        });
    }
  }

  async commit(
    actor: ActiveCultivatorRef,
    nodeId: string,
    sessionId: string,
    input: z.infer<typeof CommitSchema>,
  ) {
    return toPlayerStateMutationResponse(
      await commitBlackMarketPurchase({ actor, nodeId, sessionId, ...input }),
    );
  }

  leave(
    actor: ActiveCultivatorRef,
    nodeId: string,
    sessionId: string,
    input: z.infer<typeof LeaveSchema>,
  ) {
    return leaveBlackMarketSession({ actor, nodeId, sessionId, ...input });
  }
}
