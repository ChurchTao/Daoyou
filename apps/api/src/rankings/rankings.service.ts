import type { RankingChallengeRequest } from '@daoyou/shared/contracts/combatV6Ranking';
import { ConsumableFactsSchema } from '@daoyou/shared/items/definitions/consumables';
import {
  QUALITY_VALUES,
  REALM_VALUES,
  type RealmType,
} from '@daoyou/shared/types/constants';
import type {
  ItemRankingEntry,
  WealthRankingEntry,
} from '@daoyou/shared/types/rankings';
import { HttpException, Inject, Injectable } from '@nestjs/common';
import { DRIZZLE_DATABASE } from '@server/database/database.service.js';
import type { ActiveCultivatorRef } from '@server/lib/auth/types.js';
import type { DbClient } from '@server/lib/drizzle/db.js';
import { cultivators, inventoryItems } from '@server/lib/drizzle/schema.js';
import {
  getCultivatorRank,
  getRankingList,
  getRemainingChallenges,
} from '@server/lib/redis/rankings.js';
import {
  pendingRanking,
  runRankingChallenge,
} from '@server/combat/application/CombatV6RankingService.js';
import { loadCultivatorInspectionData } from '@server/cultivator/application/readers/CultivatorCombatProjectionReader.js';
import { readCultivatorRealm } from '@server/cultivator/facts.js';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';

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
  async items(type: string | undefined) {
    if (type !== 'elixir')
      throw new HttpException({ success: false, error: '无效的榜单类型' }, 400);
    const score = sql<number>`(${inventoryItems.instanceData}->>'score')::double precision`;
    const groupId = sql<string>`concat('pill:', ${inventoryItems.cultivatorId}, ':', md5(${inventoryItems.instanceData}::text))`;
    const rows = await this.database
      .select({
        id: groupId,
        ownerName: cultivators.name,
        facts: inventoryItems.instanceData,
        quantity: sql<number>`sum(${inventoryItems.quantity})::integer`,
      })
      .from(inventoryItems)
      .innerJoin(cultivators, eq(inventoryItems.cultivatorId, cultivators.id))
      .where(
        and(
          eq(inventoryItems.definitionId, 'consumable.v1'),
          inArray(inventoryItems.location, ['bag', 'storage']),
          sql`${inventoryItems.instanceData}->>'type' = '丹药'`,
          sql`${inventoryItems.instanceData}->'spec'->>'kind' = 'pill'`,
          inArray(
            sql`${inventoryItems.instanceData}->>'quality'`,
            QUALITY_VALUES.slice(2),
          ),
        ),
      )
      .groupBy(
        inventoryItems.cultivatorId,
        cultivators.name,
        inventoryItems.instanceData,
      )
      .orderBy(desc(score), groupId)
      .limit(100);
    const items: ItemRankingEntry[] = rows.map((row, index) => {
      const facts = ConsumableFactsSchema.parse(row.facts);
      return {
        id: row.id,
        rank: index + 1,
        name: facts.name,
        itemType: 'elixir',
        type: facts.type,
        quality: facts.quality,
        ownerName: row.ownerName,
        score: facts.score,
        description: facts.description,
        quantity: row.quantity,
        spec: facts.spec,
      };
    });

    return {
      success: true,
      data: items,
    };
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
  async probe(input: { targetId?: unknown }) {
    const { targetId } = input;
    if (!targetId || typeof targetId !== 'string')
      throw new HttpException({ error: '请提供有效的目标角色ID' }, 400);
    const inspection = await loadCultivatorInspectionData(targetId);
    if (!inspection)
      throw new HttpException({ error: '目标角色不存在或不可查探' }, 404);
    return { success: true, data: { cultivator: inspection } };
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
