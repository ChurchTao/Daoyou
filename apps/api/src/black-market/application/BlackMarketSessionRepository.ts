import { redis } from '@server/lib/redis/index.js';
import { parseRedisJson } from '@server/lib/redis/json.js';
import type { BlackMarketInternalSession } from '@server/black-market/application/types.js';

const SESSION_PREFIX = 'black-market:v9:session';

function sessionKey(sessionId: string): string {
  return `${SESSION_PREFIX}:${sessionId}`;
}

export class BlackMarketSessionRepository {
  async find(sessionId: string): Promise<BlackMarketInternalSession | null> {
    return parseRedisJson<BlackMarketInternalSession>(
      await redis.get(sessionKey(sessionId)),
      'black market session',
    );
  }

  async save(session: BlackMarketInternalSession): Promise<void> {
    const ttlSeconds = Math.max(
      60,
      Math.ceil((session.expiresAt - Date.now()) / 1000) + 3600,
    );
    await redis.set(
      sessionKey(session.id),
      JSON.stringify(session),
      'EX',
      ttlSeconds,
    );
  }
}

export const blackMarketSessionRepository = new BlackMarketSessionRepository();
