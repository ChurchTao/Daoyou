import { apiFetch } from '@app/lib/api/fetch';
import { postEvents } from '@app/lib/api/postEvents';
import type {
  DivinationRecord,
  DivinationStreamEvent,
  DivinationView,
} from '@daoyou/contracts/divination';
import type { DivinationDirection } from '@daoyou/game-domain/divination';

async function readJson<T>(response: Response): Promise<T> {
  const body = await response.json();
  if (!response.ok)
    throw new Error(body.error || '每日占卜暂不可用，请稍后再试。');
  return body;
}
export async function getDivination(signal?: AbortSignal) {
  return readJson<DivinationView>(
    await apiFetch('/api/divination', { cache: 'no-store', signal }),
  );
}
export async function drawDivination(
  direction: DivinationDirection,
  signal: AbortSignal,
) {
  return readJson<DivinationRecord>(
    await apiFetch('/api/divination/draw', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ direction }),
      signal,
    }),
  );
}
export async function interpretDivination(
  drawId: string,
  signal: AbortSignal,
  onEvent: (event: DivinationStreamEvent) => void,
) {
  let completed = false;
  for await (const event of postEvents<DivinationStreamEvent>(
    '/api/stream/divination/interpret',
    { drawId },
    signal,
  )) {
    if (event.type === 'error') throw new Error(event.message);
    if (event.type === 'complete') completed = true;
    onEvent(event);
  }
  if (!completed) throw new Error('签文传送中断。结果已保留，可重新查看。');
}
