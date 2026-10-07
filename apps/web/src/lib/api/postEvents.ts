import { apiFetch } from './fetch';

export class ApiFailure extends Error {
  readonly status: number;
  readonly payload: unknown;

  constructor(status: number, payload: unknown) {
    super(failureMessage(payload));
    this.name = 'ApiFailure';
    this.status = status;
    this.payload = payload;
  }
}

function failureMessage(payload: unknown) {
  if (!payload || typeof payload !== 'object') return '请求失败';
  const record = payload as Record<string, unknown>;
  if (typeof record.message === 'string' && record.message) return record.message;
  if (typeof record.error === 'string' && record.error) return record.error;
  return '请求失败';
}

function readFrame(frame: string): unknown | undefined {
  let eventName: string | undefined;
  const data: string[] = [];
  for (const line of frame.split('\n')) {
    if (line.startsWith('event:')) eventName = line.slice(6).trim();
    else if (line.startsWith('data:')) data.push(line.slice(5).trimStart());
  }
  if (data.length === 0) return undefined;
  const raw = data.join('\n');
  try {
    return JSON.parse(raw);
  } catch (error) {
    if (eventName === 'error') throw new Error(raw, { cause: error });
    throw error;
  }
}

/** POST a JSON command and yield official Nest SSE `data` events. */
export async function* postEvents<T>(
  path: string,
  body: unknown,
  signal?: AbortSignal,
): AsyncGenerator<T> {
  const response = await apiFetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });
  if (!response.ok) {
    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }
    throw new ApiFailure(response.status, payload);
  }
  if (!response.body) throw new Error('响应没有内容');

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  const emitReady = function* (final = false): Generator<T> {
    const frames = buffer.split('\n\n');
    buffer = final ? '' : (frames.pop() ?? '');
    for (const frame of frames) {
      const event = readFrame(frame);
      if (event !== undefined) yield event as T;
    }
  };

  try {
    while (true) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      yield* emitReady(done);
      if (done) break;
    }
  } finally {
    reader.releaseLock();
  }
}
