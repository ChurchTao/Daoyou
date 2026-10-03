import { randomUUID } from 'crypto';

const instanceId = randomUUID();

export type PubSubEnvelope<T> = {
  sourceInstanceId: string;
  payload: T;
};

export function getPubSubInstanceId() {
  return instanceId;
}

export function createPubSubEnvelope<T>(payload: T): PubSubEnvelope<T> {
  return {
    sourceInstanceId: instanceId,
    payload,
  };
}

export function parsePubSubEnvelope<T>(
  raw: string,
  isPayload: (value: unknown) => value is T,
): T | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (isPayload(parsed)) {
      return parsed;
    }

    if (
      parsed &&
      typeof parsed === 'object' &&
      'sourceInstanceId' in parsed &&
      'payload' in parsed
    ) {
      const envelope = parsed as Partial<PubSubEnvelope<unknown>>;
      if (envelope.sourceInstanceId === instanceId) {
        return null;
      }
      return isPayload(envelope.payload) ? envelope.payload : null;
    }
  } catch {
    return null;
  }

  return null;
}
