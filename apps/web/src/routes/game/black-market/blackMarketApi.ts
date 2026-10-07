import { apiFetch } from '@app/lib/api/fetch';
import { postEvents } from '@app/lib/api/postEvents';
import type {
  BlackMarketInteractCommand,
  BlackMarketInteractionResult,
  BlackMarketInteractStreamEvent,
  BlackMarketNpcId,
  BlackMarketOverview,
  BlackMarketSessionView,
} from '@daoyou/game-domain/black-market';

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
    await apiFetch(`/api/black-market/${encodeURIComponent(nodeId)}`, {
      cache: 'no-store',
      signal,
    }),
  );
}

export async function openBlackMarketSession(
  nodeId: string,
  npcId: BlackMarketNpcId,
): Promise<Response> {
  return apiFetch(`/api/black-market/${encodeURIComponent(nodeId)}/sessions`, {
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
  let result: BlackMarketInteractionResult | undefined;
  for await (const event of postEvents<BlackMarketInteractStreamEvent>(
    `/api/black-market/${encodeURIComponent(nodeId)}/sessions/${sessionId}/interact`,
    input,
    signal,
  )) {
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
  if (!result) throw new Error('摊前情形没有落定');
  return result;
}

export function commitBlackMarketPurchase(
  nodeId: string,
  sessionId: string,
  version: number,
  expectedPrice: number,
): Promise<Response> {
  return apiFetch(
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
    await apiFetch(
      `/api/black-market/${encodeURIComponent(nodeId)}/sessions/${sessionId}/leave`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version }),
      },
    ),
  );
}
