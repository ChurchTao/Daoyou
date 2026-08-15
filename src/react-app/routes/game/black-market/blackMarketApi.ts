import type {
  BlackMarketInteractCommand,
  BlackMarketInteractionResult,
  BlackMarketInteractStreamEvent,
  BlackMarketNpcId,
  BlackMarketOverview,
  BlackMarketSessionView,
} from '@shared/types/blackMarket';

async function readJson<T>(response: Response): Promise<T> {
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.message || payload?.error || '暗巷里的交谈突然中断');
  }
  return payload as T;
}

export async function fetchBlackMarketOverview(
  nodeId: string,
  signal?: AbortSignal,
): Promise<BlackMarketOverview> {
  return readJson(
    await fetch(`/api/black-market/${encodeURIComponent(nodeId)}`, {
      cache: 'no-store',
      signal,
    }),
  );
}

export async function openBlackMarketSession(
  nodeId: string,
  npcId: BlackMarketNpcId,
): Promise<Response> {
  return fetch(`/api/black-market/${encodeURIComponent(nodeId)}/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ npcId }),
    });
}

export async function interactWithBlackMarket(
  nodeId: string,
  sessionId: string,
  input: BlackMarketInteractCommand,
  handlers: {
    onResolved?(event: Extract<BlackMarketInteractStreamEvent, { type: 'resolved' }>): void;
    onReplyChunk?(messageId: string, text: string): void;
    onReplyComplete?(messageId: string, body: string): void;
    onReplyError?(messageId: string, fallbackBody: string): void;
  } = {},
  signal?: AbortSignal,
): Promise<BlackMarketInteractionResult> {
  const response = await fetch(
    `/api/black-market/${encodeURIComponent(nodeId)}/sessions/${sessionId}/interact`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
      signal,
    },
  );
  if (!response.ok) return readJson(response);
  if (!response.body) throw new Error('摊主的回应没有传回来');

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let result: BlackMarketInteractionResult | undefined;

  const flush = () => {
    const segments = buffer.split('\n\n');
    buffer = segments.pop() ?? '';
    for (const segment of segments) {
      const data = segment
        .split('\n')
        .filter((line) => line.startsWith('data: '))
        .map((line) => line.slice(6))
        .join('\n')
        .trim();
      if (!data) continue;
      const event = JSON.parse(data) as BlackMarketInteractStreamEvent;
      if (event.type === 'resolved') {
        result = event.result;
        handlers.onResolved?.(event);
      } else if (event.type === 'reply-chunk') {
        handlers.onReplyChunk?.(event.messageId, event.text);
      } else if (event.type === 'reply-complete') {
        handlers.onReplyComplete?.(event.messageId, event.body);
      } else {
        handlers.onReplyError?.(event.messageId, event.fallbackBody);
      }
    }
  };

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    flush();
  }
  buffer += decoder.decode();
  flush();
  if (!result) throw new Error('摊前情形没有落定');
  return result;
}

export function commitBlackMarketPurchase(
  nodeId: string,
  sessionId: string,
  version: number,
  expectedPrice: number,
): Promise<Response> {
  return fetch(
    `/api/black-market/${encodeURIComponent(nodeId)}/sessions/${sessionId}/commit`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ version, expectedPrice }),
    },
  );
}

export async function leaveBlackMarketSession(
  nodeId: string,
  sessionId: string,
  version: number,
): Promise<BlackMarketSessionView> {
  return readJson(
    await fetch(
      `/api/black-market/${encodeURIComponent(nodeId)}/sessions/${sessionId}/leave`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version }),
      },
    ),
  );
}
