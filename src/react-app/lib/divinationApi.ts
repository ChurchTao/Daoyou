import type {
  DivinationRecord,
  DivinationStreamEvent,
  DivinationView,
} from '@shared/contracts/divination';
import type { DivinationDirection } from '@shared/lib/divination';

async function readJson<T>(response: Response): Promise<T> {
  const body = await response.json();
  if (!response.ok)
    throw new Error(body.error || '每日占卜暂不可用，请稍后再试。');
  return body;
}
export async function getDivination(signal?: AbortSignal) {
  return readJson<DivinationView>(
    await fetch('/api/divination', { cache: 'no-store', signal }),
  );
}
export async function drawDivination(
  direction: DivinationDirection,
  signal: AbortSignal,
) {
  return readJson<DivinationRecord>(
    await fetch('/api/divination/draw', {
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
  const response = await fetch('/api/divination/interpret', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ drawId }),
    signal,
  });
  if (!response.ok) {
    await readJson(response);
    return;
  }
  if (!response.body) throw new Error('签文未能传回，请重新查看。');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let completed = false;
  const flush = () => {
    let end: number;
    while ((end = buffer.indexOf('\n\n')) >= 0) {
      const packet = buffer.slice(0, end);
      buffer = buffer.slice(end + 2);
      const data = packet
        .split('\n')
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5).trimStart())
        .join('\n');
      if (!data) continue;
      const event = JSON.parse(data) as DivinationStreamEvent;
      if (event.type === 'error') throw new Error(event.message);
      if (event.type === 'complete') completed = true;
      onEvent(event);
    }
  };
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      flush();
    }
    buffer += decoder.decode();
    flush();
    if (!completed) throw new Error('签文传送中断。结果已保留，可重新查看。');
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
