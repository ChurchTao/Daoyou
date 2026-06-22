import {
  getExecutor,
  type DbExecutor,
  type DbTransaction,
} from '@server/lib/drizzle/db';
import * as schema from '@server/lib/drizzle/schema';
import { and, eq, inArray, or } from 'drizzle-orm';

export type FriendCultivatorSummary = {
  id: string;
  name: string;
  title: string | null;
  realm: string;
  realmStage: string;
  status: string;
};

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
    .where(eq(schema.cultivatorFriends.cultivatorId, cultivatorId));

  return rows.map(toSummary);
}

export async function getInviteTarget(
  currentCultivatorId: string,
  targetCultivatorId: string,
  executor?: DbExecutor | DbTransaction,
): Promise<{ target: FriendCultivatorSummary; isFriend: boolean }> {
  const q = executor ?? getExecutor();
  if (currentCultivatorId === targetCultivatorId) {
    throw new FriendServiceError(400, '不能将自己加入好友名录');
  }

  const target = await getActiveCultivatorSummary(targetCultivatorId, q);
  if (!target) {
    throw new FriendServiceError(404, '未找到该道友');
  }

  return {
    target,
    isFriend: await areFriends(currentCultivatorId, targetCultivatorId, q),
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
    const [current, friend] = await Promise.all([
      getActiveCultivatorSummary(cultivatorId, tx),
      getActiveCultivatorSummary(friendCultivatorId, tx),
    ]);

    if (!current) {
      throw new FriendServiceError(404, '当前角色不存在');
    }
    if (!friend) {
      throw new FriendServiceError(404, '未找到该道友');
    }

    await tx
      .insert(schema.cultivatorFriends)
      .values([
        { cultivatorId, friendCultivatorId },
        { cultivatorId: friendCultivatorId, friendCultivatorId: cultivatorId },
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
