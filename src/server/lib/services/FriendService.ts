import {
  getExecutor,
  type DbExecutor,
  type DbTransaction,
} from '@server/lib/drizzle/db';
import * as schema from '@server/lib/drizzle/schema';
import type {
  FriendCultivatorSummary,
  FriendSearchResult,
  FriendTargetResponse,
} from '@shared/contracts/friends';
import { MAX_FRIENDS_PER_CULTIVATOR } from '@shared/config/socialConfig';
import { and, desc, eq, inArray, ne, or, sql } from 'drizzle-orm';

export class FriendServiceError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'FriendServiceError';
  }
}

function toSummary(
  row: Pick<
    typeof schema.cultivators.$inferSelect,
    'id' | 'name' | 'title' | 'realm' | 'realm_stage' | 'status'
  >,
): FriendCultivatorSummary {
  return {
    id: row.id,
    name: row.name,
    title: row.title,
    realm: row.realm,
    realmStage: row.realm_stage,
    status: row.status,
  };
}

async function getActiveCultivatorSummary(
  cultivatorId: string,
  q: DbExecutor | DbTransaction,
): Promise<FriendCultivatorSummary | null> {
  const [row] = await q
    .select({
      id: schema.cultivators.id,
      name: schema.cultivators.name,
      title: schema.cultivators.title,
      realm: schema.cultivators.realm,
      realm_stage: schema.cultivators.realm_stage,
      status: schema.cultivators.status,
    })
    .from(schema.cultivators)
    .where(
      and(
        eq(schema.cultivators.id, cultivatorId),
        eq(schema.cultivators.status, 'active'),
      ),
    )
    .limit(1);

  return row ? toSummary(row) : null;
}

export async function areFriends(
  cultivatorId: string,
  friendCultivatorId: string,
  executor?: DbExecutor | DbTransaction,
): Promise<boolean> {
  const q = executor ?? getExecutor();
  const [row] = await q
    .select({ id: schema.cultivatorFriends.id })
    .from(schema.cultivatorFriends)
    .where(
      and(
        eq(schema.cultivatorFriends.cultivatorId, cultivatorId),
        eq(schema.cultivatorFriends.friendCultivatorId, friendCultivatorId),
      ),
    )
    .limit(1);
  return Boolean(row);
}

export async function listFriends(
  cultivatorId: string,
  executor?: DbExecutor | DbTransaction,
): Promise<FriendCultivatorSummary[]> {
  const q = executor ?? getExecutor();
  const rows = await q
    .select({
      id: schema.cultivators.id,
      name: schema.cultivators.name,
      title: schema.cultivators.title,
      realm: schema.cultivators.realm,
      realm_stage: schema.cultivators.realm_stage,
      status: schema.cultivators.status,
    })
    .from(schema.cultivatorFriends)
    .innerJoin(
      schema.cultivators,
      eq(schema.cultivatorFriends.friendCultivatorId, schema.cultivators.id),
    )
    .where(eq(schema.cultivatorFriends.cultivatorId, cultivatorId))
    .orderBy(desc(schema.cultivatorFriends.createdAt))
    .limit(MAX_FRIENDS_PER_CULTIVATOR);

  return rows.map(toSummary);
}

export async function searchActiveCultivatorsByExactName(
  currentCultivatorId: string,
  name: string,
  executor?: DbExecutor | DbTransaction,
): Promise<FriendSearchResult[]> {
  const q = executor ?? getExecutor();
  const candidates = await q
    .select({
      id: schema.cultivators.id,
      name: schema.cultivators.name,
      title: schema.cultivators.title,
      realm: schema.cultivators.realm,
      realm_stage: schema.cultivators.realm_stage,
      status: schema.cultivators.status,
    })
    .from(schema.cultivators)
    .where(
      and(
        eq(schema.cultivators.name, name),
        eq(schema.cultivators.status, 'active'),
        ne(schema.cultivators.id, currentCultivatorId),
      ),
    )
    .limit(20);

  if (candidates.length === 0) {
    return [];
  }

  const candidateIds = candidates.map((candidate) => candidate.id);
  const friendRows = await q
    .select({ friendCultivatorId: schema.cultivatorFriends.friendCultivatorId })
    .from(schema.cultivatorFriends)
    .where(
      and(
        eq(schema.cultivatorFriends.cultivatorId, currentCultivatorId),
        inArray(schema.cultivatorFriends.friendCultivatorId, candidateIds),
      ),
    );
  const friendIds = new Set(friendRows.map((row) => row.friendCultivatorId));

  return candidates.map((candidate) => {
    const target = toSummary(candidate);
    const isFriend = friendIds.has(target.id);
    return {
      ...target,
      relationship: isFriend ? 'friend' : 'none',
      isFriend,
    };
  });
}

export async function getInviteTarget(
  currentCultivatorId: string,
  targetCultivatorId: string,
  executor?: DbExecutor | DbTransaction,
): Promise<FriendTargetResponse> {
  const q = executor ?? getExecutor();
  if (currentCultivatorId === targetCultivatorId) {
    throw new FriendServiceError(400, '不能将自己加入好友名录');
  }

  const target = await getActiveCultivatorSummary(targetCultivatorId, q);
  if (!target) {
    throw new FriendServiceError(404, '未找到该道友');
  }

  const isFriend = await areFriends(currentCultivatorId, targetCultivatorId, q);
  return {
    target,
    relationship: isFriend ? 'friend' : 'none',
    isFriend,
  };
}

export async function addFriendPair(
  cultivatorId: string,
  friendCultivatorId: string,
  executor?: DbExecutor | DbTransaction,
): Promise<FriendCultivatorSummary> {
  if (cultivatorId === friendCultivatorId) {
    throw new FriendServiceError(400, '不能将自己加入好友名录');
  }

  const persist = async (tx: DbTransaction) => {
    const participantIds = [cultivatorId, friendCultivatorId].sort();
    await tx
      .select({ id: schema.cultivators.id })
      .from(schema.cultivators)
      .where(inArray(schema.cultivators.id, participantIds))
      .orderBy(schema.cultivators.id)
      .for('update');

    const current = await getActiveCultivatorSummary(cultivatorId, tx);
    const friend = await getActiveCultivatorSummary(friendCultivatorId, tx);

    if (!current) {
      throw new FriendServiceError(404, '当前角色不存在');
    }
    if (!friend) {
      throw new FriendServiceError(404, '未找到该道友');
    }
    if (await areFriends(cultivatorId, friendCultivatorId, tx)) {
      return friend;
    }

    const countRows = await tx
      .select({
        cultivatorId: schema.cultivatorFriends.cultivatorId,
        total: sql<number>`count(*)::int`,
      })
      .from(schema.cultivatorFriends)
      .where(inArray(schema.cultivatorFriends.cultivatorId, participantIds))
      .groupBy(schema.cultivatorFriends.cultivatorId);
    const counts = new Map(
      countRows.map((row) => [row.cultivatorId, row.total] as const),
    );

    if ((counts.get(cultivatorId) ?? 0) >= MAX_FRIENDS_PER_CULTIVATOR) {
      throw new FriendServiceError(409, '好友名录已满，请先移除一位道友');
    }
    if ((counts.get(friendCultivatorId) ?? 0) >= MAX_FRIENDS_PER_CULTIVATOR) {
      throw new FriendServiceError(409, '该道友的好友名录已满');
    }

    const [firstId, secondId] = participantIds;
    await tx
      .insert(schema.cultivatorFriends)
      .values([
        { cultivatorId: firstId!, friendCultivatorId: secondId! },
        { cultivatorId: secondId!, friendCultivatorId: firstId! },
      ])
      .onConflictDoNothing();

    return friend;
  };

  return executor
    ? persist(executor as DbTransaction)
    : getExecutor().transaction(persist);
}

export async function removeFriendPair(
  cultivatorId: string,
  friendCultivatorId: string,
  executor?: DbExecutor | DbTransaction,
): Promise<void> {
  const q = executor ?? getExecutor();
  await q
    .delete(schema.cultivatorFriends)
    .where(
      or(
        and(
          eq(schema.cultivatorFriends.cultivatorId, cultivatorId),
          eq(schema.cultivatorFriends.friendCultivatorId, friendCultivatorId),
        ),
        and(
          eq(schema.cultivatorFriends.cultivatorId, friendCultivatorId),
          eq(schema.cultivatorFriends.friendCultivatorId, cultivatorId),
        ),
      ),
    );
}

export async function assertFriend(
  cultivatorId: string,
  friendCultivatorId: string,
  executor?: DbExecutor | DbTransaction,
): Promise<void> {
  if (!(await areFriends(cultivatorId, friendCultivatorId, executor))) {
    throw new FriendServiceError(403, '只能向好友名录中的道友发送');
  }
}

export async function assertFriends(
  cultivatorId: string,
  friendCultivatorIds: string[],
  executor?: DbExecutor | DbTransaction,
): Promise<void> {
  if (friendCultivatorIds.length === 0) {
    return;
  }

  const q = executor ?? getExecutor();
  const rows = await q
    .select({ friendCultivatorId: schema.cultivatorFriends.friendCultivatorId })
    .from(schema.cultivatorFriends)
    .where(
      and(
        eq(schema.cultivatorFriends.cultivatorId, cultivatorId),
        inArray(
          schema.cultivatorFriends.friendCultivatorId,
          friendCultivatorIds,
        ),
      ),
    );
  if (rows.length !== new Set(friendCultivatorIds).size) {
    throw new FriendServiceError(403, '只能指定好友名录中的道友');
  }
}
