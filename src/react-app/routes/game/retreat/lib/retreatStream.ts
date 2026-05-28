import type {
  RetreatResultData,
  RetreatStreamEvent,
} from '@shared/contracts/retreat';

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

interface RetreatStreamHandlers {
  onResult: (result: RetreatResultData) => void;
  onChunk?: (text: string) => void;
  onError?: (message: string) => void;
}

interface ConsumeRetreatStreamHandlers {
  cultivatorSnapshot?: RetreatCultivatorSnapshot | null;
  onResult: (result: RetreatResultData) => void;
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

export async function consumeRetreatStream(
  response: Response,
  handlers: ConsumeRetreatStreamHandlers,
): Promise<{
  latestResult: RetreatResultData | null;
  reincarnateContext: ReincarnateContextData | null;
}> {
  let latestResult: RetreatResultData | null = null;
  let reincarnateContext: ReincarnateContextData | null = null;

  const syncReincarnateContext = () => {
    reincarnateContext = buildReincarnateContext(
      handlers.cultivatorSnapshot,
      latestResult,
    );
    handlers.onReincarnateContext?.(reincarnateContext);
  };

  await readRetreatStream(response, {
    onResult: (result) => {
      latestResult = result;
      syncReincarnateContext();
      handlers.onResult(result);
    },
    onChunk: (chunk) => {
      if (!latestResult) {
        return;
      }

      latestResult = appendRetreatStory(latestResult, chunk);
      syncReincarnateContext();
      handlers.onStoryUpdate?.(latestResult);
    },
    onError: handlers.onError,
  });

  return {
    latestResult,
    reincarnateContext,
  };
}

export async function readRetreatStream(
  response: Response,
  handlers: RetreatStreamHandlers,
): Promise<void> {
  if (!response.body) {
    throw new Error('No response body');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let receivedResult = false;

  const flushBuffer = () => {
    const segments = buffer.split('\n\n');
    buffer = segments.pop() ?? '';

    for (const segment of segments) {
      const event = parseRetreatStreamEvent(segment);
      if (!event) continue;

      if (event.type === 'result') {
        receivedResult = true;
        handlers.onResult(event.data);
        continue;
      }

      if (event.type === 'chunk') {
        handlers.onChunk?.(event.text);
        continue;
      }

      handlers.onError?.(event.error);
    }
  };

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    flushBuffer();
  }

  buffer += decoder.decode();
  flushBuffer();

  if (!receivedResult) {
    throw new Error('闭关结果解析失败');
  }
}

function parseRetreatStreamEvent(chunk: string): RetreatStreamEvent | null {
  const data = chunk
    .split('\n')
    .filter((line) => line.startsWith('data: '))
    .map((line) => line.slice(6))
    .join('\n')
    .trim();

  if (!data || data === '[DONE]') {
    return null;
  }

  return JSON.parse(data) as RetreatStreamEvent;
}
