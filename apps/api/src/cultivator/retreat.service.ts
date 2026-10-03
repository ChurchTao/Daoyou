import { Injectable } from '@nestjs/common';
import type { ActiveCultivatorRef } from '@server/lib/auth/types.js';
import { executeRetreatCommand } from '@server/cultivator/application/RetreatApplicationService.js';
import { streamAiText } from '@server/utils/aiClient.js';
import {
  getBreakthroughStoryPrompt,
  getLifespanExhaustedStoryPrompt,
} from '@server/utils/prompts.js';
import type {
  RetreatRequest,
  RetreatStreamEvent,
} from '@daoyou/shared/contracts/retreat';

@Injectable()
export class RetreatService {
  execute(actor: ActiveCultivatorRef, input: RetreatRequest) {
    return executeRetreatCommand({
      userId: actor.userId,
      cultivatorId: actor.cultivatorId,
      action: input.action,
      years: input.action === 'cultivate' ? input.years : 0,
      requestId: input.requestId,
    });
  }

  async stream(
    execution: Awaited<ReturnType<typeof executeRetreatCommand>>,
    signal: AbortSignal,
    emit: (event: RetreatStreamEvent) => Promise<void>,
  ) {
    const { committed, storySource, onStoryComplete } = execution;
    await emit({ type: 'result', data: committed.result });
    if (committed.state.changes.length || committed.state.replayed) {
      await emit({ type: 'state', state: committed.state });
    }
    if (!storySource) return;

    let accumulatedStory = '';
    try {
      const prompt =
        storySource.type === 'breakthrough'
          ? getBreakthroughStoryPrompt(storySource.payload)
          : getLifespanExhaustedStoryPrompt(storySource.payload);
      const result = streamAiText({
        system: prompt[0],
        prompt: prompt[1],
        abortSignal: signal,
        sceneId:
          storySource.type === 'breakthrough'
            ? 'breakthrough-story'
            : 'lifespan-exhausted',
      });
      for await (const chunk of result.textStream) {
        accumulatedStory += chunk;
        await emit({ type: 'chunk', text: chunk });
      }
    } catch (error) {
      console.error('Retreat story stream error:', error);
      if (!signal.aborted) {
        await emit({
          type: 'error',
          error: '天机推演中断，此番结果已然落定。',
        });
      }
    } finally {
      try {
        await onStoryComplete?.(accumulatedStory);
      } catch (error) {
        console.error('Retreat story persist error:', error);
      }
    }
  }
}
