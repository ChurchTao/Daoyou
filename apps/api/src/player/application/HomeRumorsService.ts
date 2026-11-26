import type { RealmType } from '@daoyou/constants/realms';
import {
  HomeRumorsSchema,
  type HomeActivityRumor,
  type HomeRumors,
  type HomeRumorsResponse,
} from '@daoyou/contracts/player/home-rumors';
import { contestWeek } from '@daoyou/game-rules/alchemy/contest';
import { baixiaoWeek } from '@daoyou/game-rules/baixiao/meet';
import {
  huntEventsAt,
  huntMapHref,
  huntTargetLabel,
} from '@daoyou/game-rules/hunts';
import { invasionWeek } from '@daoyou/game-rules/invasion';
import {
  wandererLocationAt,
  wandererLocationLabel,
} from '@daoyou/game-rules/wanderer';
import { Inject, Injectable } from '@nestjs/common';
import { BaixiaoQuestionBank } from '@server/baixiao/application/BaixiaoQuestionBank.js';
import { DRIZZLE_DATABASE } from '@server/database/database.service.js';
import type { DbClient } from '@server/lib/drizzle/db.js';
import {
  alchemyContestRounds,
  baixiaoRounds,
} from '@server/lib/drizzle/schema.js';
import { isRedisConfigured, redis } from '@server/lib/redis/index.js';
import { parseRedisJson } from '@server/lib/redis/json.js';
import { eq } from 'drizzle-orm';

const CACHE_KEY = 'player-home-rumors:v2';
const READINESS_REFRESH_MS = 60_000;
type ActivityKind = HomeActivityRumor['kind'];
type ActivityWindow = { week: string; closesAt: number };
type ActivityView = { nextRefreshAt: number; entry?: HomeActivityRumor };

@Injectable()
export class HomeRumorsService {
  private current?: HomeRumors;
  private loading?: Promise<void>;

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly db: DbClient,
    @Inject(BaixiaoQuestionBank)
    private readonly questionBank: BaixiaoQuestionBank,
  ) {}

  async read(realm?: RealmType): Promise<HomeRumorsResponse> {
    for (;;) {
      const serverNow = Date.now();
      if (this.current && this.current.nextRefreshAt > serverNow) {
        const { hunts, ...summary } = this.current;
        const hunt = realm
          ? (hunts.find((entry) => entry.realm === realm) ?? hunts[0] ?? null)
          : null;
        return { ...summary, hunt, serverNow };
      }
      this.loading ??= this.load()
        .then((summary) => {
          this.current = summary;
        })
        .finally(() => {
          this.loading = undefined;
        });
      await this.loading;
    }
  }

  private async load(): Promise<HomeRumors> {
    let sharedCache = isRedisConfigured();
    if (sharedCache) {
      try {
        const raw = await redis.get(CACHE_KEY);
        const cached = HomeRumorsSchema.safeParse(
          parseRedisJson<unknown>(raw, CACHE_KEY),
        );
        if (cached.success && cached.data.nextRefreshAt > Date.now()) {
          return cached.data;
        }
      } catch (error) {
        sharedCache = false;
        console.warn('[home-rumors] cache read failed', error);
      }
    }

    const summary = await this.build(Date.now());
    if (sharedCache && summary.nextRefreshAt > Date.now()) {
      try {
        await redis.set(
          CACHE_KEY,
          JSON.stringify(summary),
          'PXAT',
          summary.nextRefreshAt,
          'NX',
        );
      } catch (error) {
        console.warn('[home-rumors] cache write failed', error);
      }
    }
    return summary;
  }

  private async build(now: number): Promise<HomeRumors> {
    const wanderer = wandererLocationAt(now);
    const hunts = huntEventsAt(now);
    const invasion = invasionWeek(now);
    const contest = contestWeek(now);
    const baixiao = baixiaoWeek(now);

    const activities = await Promise.all([
      this.activity('invasion', invasion, now),
      this.activity('alchemy-contest', contest, now),
      this.activity('baixiao', baixiao, now),
    ]);

    return {
      activities: activities.flatMap(({ entry }) => (entry ? [entry] : [])),
      wandererLocation: wandererLocationLabel(wanderer),
      hunts: hunts.map((event) => ({
        realm: event.realm,
        label: huntTargetLabel(event),
        locationName: event.locationName,
        href: huntMapHref(event),
      })),
      nextRefreshAt: Math.min(
        wanderer.expiresAt,
        ...hunts.map(({ expiresAt }) => expiresAt),
        ...activities.map(({ nextRefreshAt }) => nextRefreshAt),
      ),
    };
  }

  private async activity(
    kind: ActivityKind,
    window: ActivityWindow,
    now: number,
  ): Promise<ActivityView> {
    const { week, closesAt } = window;
    if (kind === 'invasion') {
      return {
        nextRefreshAt: closesAt,
        entry: { kind, phase: 'open', time: closesAt },
      };
    }

    const phase = await this.readAdmission(kind, week);
    if (phase === 'settled') return { nextRefreshAt: closesAt };
    // The question bank may change during admission. A round still being
    // prepared also needs a short retry so the next request can show it opening.
    const nextRefreshAt =
      kind === 'baixiao' || phase !== 'open'
        ? Math.min(closesAt, now + READINESS_REFRESH_MS)
        : closesAt;
    const entry: HomeActivityRumor =
      phase === 'open' ? { kind, phase, time: closesAt } : { kind, phase };
    return { nextRefreshAt, entry };
  }

  private async readAdmission(
    kind: Exclude<ActivityKind, 'invasion'>,
    week: string,
  ): Promise<'open' | 'settled' | 'unavailable' | 'unknown'> {
    try {
      if (kind === 'alchemy-contest') {
        const [round] = await this.db
          .select({ settledAt: alchemyContestRounds.settledAt })
          .from(alchemyContestRounds)
          .where(eq(alchemyContestRounds.week, week));
        if (!round) return 'unavailable';
        return round.settledAt ? 'settled' : 'open';
      }
      const [round] = await this.db
        .select({ week: baixiaoRounds.week })
        .from(baixiaoRounds)
        .where(eq(baixiaoRounds.week, week));
      return round && (await this.questionBank.isReady())
        ? 'open'
        : 'unavailable';
    } catch (error) {
      console.warn('[home-rumors] admission read failed', {
        kind,
        week,
        error,
      });
      return 'unknown';
    }
  }
}
