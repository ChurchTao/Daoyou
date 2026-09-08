import { db } from '@server/lib/drizzle/db';
import { cultivators } from '@server/lib/drizzle/schema';
import { redis } from '@server/lib/redis';
import {
  packTowerLeaderboardScore,
  unpackTowerLeaderboardScore,
  type TowerLeaderboardEntry,
  type TowerWeeklyRecord,
} from '@shared/lib/tower';
import type { RealmType } from '@shared/types/constants';
import { and, eq, inArray } from 'drizzle-orm';

function getTowerLeaderboardKey(seasonKey: string, realm: RealmType) {
  return `tower:v6:leaderboard:${seasonKey}:${realm}`;
}

export async function updateTowerWeeklyRecord(args: {
  seasonKey: string;
  seasonEndAt: string;
  cultivatorId: string;
  recordedRealm: RealmType;
  highestFloor: number;
  firstReachedAt: string;
}) {
  const key = getTowerLeaderboardKey(args.seasonKey, args.recordedRealm);
  const currentScoreRaw = await redis.zscore(key, args.cultivatorId);
  const seasonEndAtMs = Date.parse(args.seasonEndAt);
  const nextReachedAtMs = Date.parse(args.firstReachedAt);

  if (typeof currentScoreRaw === 'string') {
    const currentScore = Number(currentScoreRaw);
    const currentRecord = unpackTowerLeaderboardScore(
      currentScore,
      seasonEndAtMs,
    );

    if (currentRecord.highestFloor > args.highestFloor) {
      return;
    }
    if (currentRecord.highestFloor === args.highestFloor) {
      return;
    }
  }

  const nextScore = packTowerLeaderboardScore(
    args.highestFloor,
    nextReachedAtMs,
    seasonEndAtMs,
  );
  await redis.zadd(key, nextScore, args.cultivatorId);
  await redis.expireat(key, Math.ceil(seasonEndAtMs / 1000) + 86400);
}

export async function getTowerLeaderboard(args: {
  seasonKey: string;
  seasonEndAt: string;
  realm: RealmType;
  limit: number;
  selfCultivatorId?: string;
}): Promise<TowerLeaderboardEntry[]> {
  const key = getTowerLeaderboardKey(args.seasonKey, args.realm);
  const entries = await redis.zrevrange(
    key,
    0,
    Math.max(0, args.limit - 1),
    'WITHSCORES',
  );

  const records: TowerWeeklyRecord[] = [];
  for (let index = 0; index < entries.length; index += 2) {
    const cultivatorId = entries[index];
    const score = Number(entries[index + 1]);
    const unpacked = unpackTowerLeaderboardScore(
      score,
      Date.parse(args.seasonEndAt),
    );

    records.push({
      cultivatorId,
      recordedRealm: args.realm,
      highestFloor: unpacked.highestFloor,
      firstReachedAt: new Date(unpacked.firstReachedAtMs).toISOString(),
    });
  }

  const cultivatorIds = records.map((record) => record.cultivatorId);
  const basics =
    cultivatorIds.length === 0
      ? []
      : await db
          .select({
            id: cultivators.id,
            name: cultivators.name,
            title: cultivators.title,
            realm: cultivators.realm,
            realmStage: cultivators.realm_stage,
            gender: cultivators.gender,
            origin: cultivators.origin,
          })
          .from(cultivators)
          .where(
            and(
              inArray(cultivators.id, cultivatorIds),
              eq(cultivators.status, 'active'),
            ),
          );
  const basicsById = new Map(basics.map((item) => [item.id, item]));

  return records.flatMap((record, index) => {
    const basic = basicsById.get(record.cultivatorId);
    if (!basic) {
      return [];
    }

    return [
      {
        cultivatorId: record.cultivatorId,
        rank: index + 1,
        name: basic.name,
        title: basic.title,
        realm: basic.realm,
        realmStage: basic.realmStage,
        gender: basic.gender,
        origin: basic.origin,
        highestFloor: record.highestFloor,
        recordedRealm: record.recordedRealm,
        firstReachedAt: record.firstReachedAt,
        isSelf: record.cultivatorId === args.selfCultivatorId,
      },
    ];
  });
}
