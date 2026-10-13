import { createHash } from 'node:crypto';

export class ChatError extends Error {
  constructor(
    message: string,
    public readonly status: number = 400,
    public readonly remainingSeconds?: number,
  ) {
    super(message);
  }
}

export function chatRequestFingerprint(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}
