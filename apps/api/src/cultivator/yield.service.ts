import { getGameConceptLabel } from '@daoyou/game-content/presentation/concepts';
import { AiService } from '@nestjs/ai';
import { Inject, Injectable } from '@nestjs/common';
import { executeYieldCommand } from '@server/cultivator/application/YieldApplicationService.js';
import type { ActiveCultivatorRef } from '@server/lib/auth/types.js';
import { renderPrompt } from '@server/lib/prompts/index.js';

type YieldExecution = Awaited<ReturnType<typeof executeYieldCommand>>;
type YieldStreamEvent =
  | { type: 'result'; data: YieldExecution['committed']['result'] }
  | { type: 'state'; state: YieldExecution['committed']['state'] }
  | { type: 'chunk'; text: string }
  | { type: 'error'; error: string };

@Injectable()
export class YieldService {
  constructor(@Inject(AiService) private readonly ai: AiService) {}

  execute(actor: ActiveCultivatorRef, requestId: string) {
    return executeYieldCommand({
      userId: actor.userId,
      cultivatorId: actor.cultivatorId,
      requestId,
    });
  }

  async stream(
    { committed, result }: YieldExecution,
    signal: AbortSignal,
    emit: (event: YieldStreamEvent) => Promise<void>,
  ) {
    await emit({ type: 'result', data: committed.result });
    if (committed.state.changes.length || committed.state.replayed) {
      await emit({ type: 'state', state: committed.state });
    }
    if (committed.state.replayed) return;

    const extra = [
      result.expGain ? `修为精进 ${result.expGain} 点` : '',
      result.insightGain
        ? `${getGameConceptLabel('comprehension_insight')} ${result.insightGain} 点`
        : '',
    ]
      .filter(Boolean)
      .join('；');
    const { system, user: prompt } = renderPrompt('yield-story', {
      cultivatorRealm: result.cultivatorRealm,
      cultivatorName: result.cultivatorName,
      amount: result.amount,
      extraYieldText: extra ? `；${extra}` : '',
    });
    try {
      const aiStreamResult = this.ai.streamText({
        model: 'alibaba.fast',
        instructions: system,
        prompt,
        abortSignal: signal,
        label: 'yield-story',
        providerOptions: {
          alibaba: { enableThinking: false },
          deepseek: { thinking: { type: 'disabled' } },
        },
      });
      try {
        for await (const chunk of aiStreamResult.textStream) {
          await emit({ type: 'chunk', text: chunk });
        }
      } finally {
        aiStreamResult.abort();
      }
    } catch (error) {
      console.error('Stream processing error:', error);
      if (!signal.aborted) {
        await emit({ type: 'error', error: '天机推演中断...' });
      }
    }
  }
}
