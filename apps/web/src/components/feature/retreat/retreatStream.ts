import type {
  RetreatResultData,
  RetreatStreamEvent,
} from '@daoyou/contracts/retreat';
import type { PlayerResourceMutationMeta } from '@daoyou/contracts/player';

export interface RetreatCultivatorSnapshot {
  name: string;
  realm: string;
  realm_stage: string;
}

export interface ReincarnateContextData {
  story?: string;
  name: string;
  realm: string;
  realm_stage: string;
}

interface ConsumeRetreatStreamHandlers {
  cultivatorSnapshot?: RetreatCultivatorSnapshot | null;
  onResult: (result: RetreatResultData) => void;
  onState?: (state: PlayerResourceMutationMeta) => void;
  onStoryUpdate?: (result: RetreatResultData) => void;
  onReincarnateContext?: (context: ReincarnateContextData | null) => void;
  onError?: (message: string) => void;
}

export function buildReincarnateContext(
  cultivatorSnapshot: RetreatCultivatorSnapshot | null | undefined,
  retreatResult: RetreatResultData | null,
): ReincarnateContextData | null {
  if (!cultivatorSnapshot || !retreatResult?.depleted) {
    return null;
  }

  return {
    story: retreatResult.story,
    name: cultivatorSnapshot.name,
    realm: cultivatorSnapshot.realm,
    realm_stage: cultivatorSnapshot.realm_stage,
  };
}

export function appendRetreatStory(
  retreatResult: RetreatResultData,
  chunk: string,
): RetreatResultData {
  return {
    ...retreatResult,
    story: `${retreatResult.story ?? ''}${chunk}`,
  };
}

export function isSuccessfulBreakthrough(
  retreatResult: RetreatResultData | null,
): boolean {
  return Boolean(
    retreatResult?.action === 'breakthrough' &&
    'success' in retreatResult.summary &&
    retreatResult.summary.success,
  );
}

export async function consumeRetreatEvents(
  events: AsyncIterable<RetreatStreamEvent>,
  handlers: ConsumeRetreatStreamHandlers,
): Promise<{
  latestResult: RetreatResultData | null;
  reincarnateContext: ReincarnateContextData | null;
}> {
  let latestResult: RetreatResultData | null = null;
  let reincarnateContext: ReincarnateContextData | null = null;
  let receivedResult = false;

  const syncReincarnateContext = () => {
    reincarnateContext = buildReincarnateContext(
      handlers.cultivatorSnapshot,
      latestResult,
    );
    handlers.onReincarnateContext?.(reincarnateContext);
  };

  for await (const event of events) {
    if (event.type === 'result') {
      receivedResult = true;
      latestResult = event.data;
      syncReincarnateContext();
      handlers.onResult(event.data);
      continue;
    }
    if (event.type === 'state') {
      handlers.onState?.(event.state);
      continue;
    }
    if (event.type === 'chunk') {
      if (!latestResult) continue;
      latestResult = appendRetreatStory(latestResult, event.text);
      syncReincarnateContext();
      handlers.onStoryUpdate?.(latestResult);
      continue;
    }
    handlers.onError?.(event.error);
  }

  if (!receivedResult) throw new Error('闭关结果解析失败');

  return {
    latestResult,
    reincarnateContext,
  };
}
