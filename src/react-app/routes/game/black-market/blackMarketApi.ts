import type {
  BlackMarketInspectionKind,
  BlackMarketInteractionResult,
  BlackMarketNpcId,
  BlackMarketOverview,
  BlackMarketSessionView,
} from '@shared/types/blackMarket';

async function readJson<T>(response: Response): Promise<T> {
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.error || '暗巷里的交谈突然中断');
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
): Promise<BlackMarketSessionView> {
  return readJson(
    await fetch(`/api/black-market/${encodeURIComponent(nodeId)}/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ npcId }),
    }),
  );
}

export async function interactWithBlackMarket(
  nodeId: string,
  sessionId: string,
  input:
    | {
        action: 'inspect';
        inspectionKind: BlackMarketInspectionKind;
        version: number;
      }
    | { action: 'question'; message: string; version: number }
    | {
        action: 'haggle';
        message?: string;
        offeredPrice: number;
        version: number;
      },
): Promise<BlackMarketInteractionResult> {
  return readJson(
    await fetch(
      `/api/black-market/${encodeURIComponent(nodeId)}/sessions/${sessionId}/interact`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      },
    ),
  );
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
