import { Inject, Injectable } from '@nestjs/common';
import { REDIS_CLIENT } from '@server/redis/redis.module.js';
import type { Redis } from 'ioredis';
import { PresenceService } from './presence.service.js';

const MINUTE_MS = 60_000;
const DAY_MINUTES = 24 * 60;
const RETENTION_SECONDS = 7 * DAY_MINUTES * 60;
const sampleKey = (minute: number) => `admin:online:sample:v1:${minute}`;

function readCount(value: string | null): number | null {
  if (value === null || !/^\d+$/.test(value)) return null;
  const count = Number(value);
  return Number.isSafeInteger(count) ? count : null;
}

@Injectable()
export class PresenceHistoryService {
  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    @Inject(PresenceService) private readonly presence: PresenceService,
  ) {}

  async sample(): Promise<void> {
    const now = Date.now();
    const minute = Math.floor(now / MINUTE_MS);
    const snapshot = await this.presence.getOnlineCultivatorsSnapshot(now);
    if (snapshot.source !== 'redis') return;
    await this.redis.set(
      sampleKey(minute),
      String(snapshot.cultivatorIds.size),
      'EXAT',
      minute * 60 + RETENTION_SECONDS,
      'NX',
    );
  }

  async getTrend(duration: number) {
    const end = Math.floor(Date.now() / MINUTE_MS);
    const start = end - duration;
    const minutes = Array.from(
      { length: duration + 1 },
      (_, index) => start + index,
    );
    const [current, yesterday] = await Promise.all([
      this.redis.mget(...minutes.map(sampleKey)),
      this.redis.mget(
        ...minutes.map((minute) => sampleKey(minute - DAY_MINUTES)),
      ),
    ]);

    const points = minutes.flatMap((minute, index) => {
      const currentCount = readCount(current[index]);
      const yesterdayCount = readCount(yesterday[index]);
      return currentCount === null && yesterdayCount === null
        ? []
        : [
            {
              at: minute * MINUTE_MS,
              current: currentCount,
              yesterday: yesterdayCount,
            },
          ];
    });

    return { from: start * MINUTE_MS, to: end * MINUTE_MS, points };
  }
}
