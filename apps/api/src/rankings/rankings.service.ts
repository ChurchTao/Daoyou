import { REALM_VALUES, type RealmType } from '@daoyou/constants/realms';
import type { RankingChallengeRequest } from '@daoyou/contracts/combat/ranking';
import type { WealthRankingEntry } from '@daoyou/contracts/rankings';
import { Inject, Injectable } from '@nestjs/common';
import {
  pendingRanking,
  runRankingChallenge,
} from '@server/combat/application/CombatV6RankingService.js';
import { readCultivatorRealm } from '@server/cultivator/facts.js';
import { DRIZZLE_DATABASE } from '@server/database/database.service.js';
import type { ActiveCultivatorRef } from '@server/lib/auth/types.js';
import type { DbClient } from '@server/lib/drizzle/db.js';
import { cultivators } from '@server/lib/drizzle/schema.js';
import {
  getCultivatorRank,
  getRankingList,
  getRemainingChallenges,
} from '@server/lib/redis/rankings.js';
import { desc, eq } from 'drizzle-orm';

function parseRealm(raw: string | undefined): RealmType | null {
  return REALM_VALUES.includes(raw as RealmType) ? (raw as RealmType) : null;
}

@Injectable()
export class RankingsService {
  constructor(@Inject(DRIZZLE_DATABASE) private readonly database: DbClient) {}

  async list(rawRealm: string | undefined) {
    const realm = parseRealm(rawRealm) ?? '炼气';
    return { success: true, data: await getRankingList(realm), realm };
  }
  async wealth() {
    const limit = 100;
    const rows = await this.database
      .select({
        id: cultivators.id,
        name: cultivators.name,
        title: cultivators.title,
        realm: cultivators.realm,
        realmStage: cultivators.realm_stage,
        age: cultivators.age,
        origin: cultivators.origin,
        spiritStones: cultivators.spirit_stones,
      })
      .from(cultivators)
      .where(eq(cultivators.status, 'active'))
      .orderBy(desc(cultivators.spirit_stones))
      .limit(limit);

    const items: WealthRankingEntry[] = rows.map((row, index) => ({
      id: row.id,
      rank: index + 1,
      rankingType: 'wealth',
      name: row.name,
      title: row.title,
      realm: row.realm,
      realm_stage: row.realmStage,
      age: row.age,
      origin: row.origin,
      spiritStones: row.spiritStones,
    }));

    return {
      success: true,
      data: items,
    };
  }
  async myRank(actor: ActiveCultivatorRef, rawRealm: string | undefined) {
    const own = await readCultivatorRealm(actor.cultivatorId);
    const realm = parseRealm(rawRealm) ?? own.realm;
    const rank = await getCultivatorRank(realm, actor.cultivatorId);
    const remainingChallenges = await getRemainingChallenges(
      actor.cultivatorId,
    );
    return { success: true, data: { rank, realm, remainingChallenges } };
  }
  async current(actor: ActiveCultivatorRef) {
    return { success: true, data: await pendingRanking(actor.cultivatorId) };
  }
  async challenge(actor: ActiveCultivatorRef, input: RankingChallengeRequest) {
    const data = await runRankingChallenge(
      { userId: actor.userId, cultivatorId: actor.cultivatorId },
      input,
    );
    return { success: true, data };
  }
}
