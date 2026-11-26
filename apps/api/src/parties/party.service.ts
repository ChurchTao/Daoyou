import { PARTY_CAPACITY, type PartyView } from '@daoyou/contracts/party';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import type { ActiveCultivatorRef } from '@server/lib/auth/types.js';
import {
  db,
  type DbExecutor,
  type DbTransaction,
} from '@server/lib/drizzle/db.js';
import {
  cultivators,
  parties,
  partyMembers,
} from '@server/lib/drizzle/schema.js';
import { and, asc, eq, inArray, sql } from 'drizzle-orm';

export { PARTY_CAPACITY };

export type Party = PartyView;

type Identity = Pick<ActiveCultivatorRef, 'userId' | 'cultivatorId'>;

function partyRoster(executor: DbExecutor) {
  return executor
    .select({
      party: parties,
      member: {
        userId: partyMembers.userId,
        cultivatorId: partyMembers.cultivatorId,
        name: cultivators.name,
        realm: cultivators.realm,
        realmStage: cultivators.realm_stage,
        title: cultivators.title,
        gender: cultivators.gender,
      },
    })
    .from(parties)
    .innerJoin(partyMembers, eq(partyMembers.partyId, parties.id))
    .innerJoin(cultivators, eq(cultivators.id, partyMembers.cultivatorId))
    .orderBy(asc(partyMembers.joinedAt), asc(partyMembers.userId))
    .$dynamic();
}

function collectParties(
  rows: Awaited<ReturnType<typeof partyRoster>>,
): Party[] {
  const grouped = new Map<string, Party>();
  for (const { party, member } of rows) {
    const current = grouped.get(party.id);
    if (current) current.members.push(member);
    else grouped.set(party.id, { ...party, members: [member] });
  }
  return [...grouped.values()];
}

export function partyOwns(party: Party, actor: Identity) {
  return party.members.some(
    (member) =>
      member.userId === actor.userId &&
      member.cultivatorId === actor.cultivatorId,
  );
}

export async function readParty(
  id: string,
  executor: DbExecutor = db,
  lock?: 'update',
): Promise<Party | null> {
  if (lock) {
    const [party] = await executor
      .select({ id: parties.id })
      .from(parties)
      .where(eq(parties.id, id))
      .for(lock);
    if (!party) return null;
  }
  const rows = await partyRoster(executor).where(eq(parties.id, id));
  return collectParties(rows)[0] ?? null;
}

export async function readParties(ids: string[]): Promise<Party[]> {
  if (!ids.length) return [];
  return collectParties(await partyRoster(db).where(inArray(parties.id, ids)));
}

export async function partyForUser(userId: string, executor: DbExecutor = db) {
  const memberParty = executor
    .select({ partyId: partyMembers.partyId })
    .from(partyMembers)
    .where(eq(partyMembers.userId, userId));
  const rows = await partyRoster(executor).where(
    inArray(parties.id, memberParty),
  );
  return collectParties(rows)[0] ?? null;
}

export async function requirePartyIdentity(tx: DbTransaction, actor: Identity) {
  const [owner] = await tx
    .select({ id: cultivators.id })
    .from(cultivators)
    .where(
      and(
        eq(cultivators.id, actor.cultivatorId),
        eq(cultivators.userId, actor.userId),
        eq(cultivators.status, 'active'),
      ),
    );
  if (!owner) throw new ForbiddenException('当前角色无法组队');
}

export async function addPartyMember(
  tx: DbTransaction,
  partyId: string,
  actor: Identity,
) {
  await requirePartyIdentity(tx, actor);
  const inserted = await tx
    .insert(partyMembers)
    .values({ partyId, userId: actor.userId, cultivatorId: actor.cultivatorId })
    .onConflictDoNothing()
    .returning({ userId: partyMembers.userId });
  if (!inserted.length) throw new ConflictException('请先退出当前队伍');
}

export function lockPartyApplicant(tx: DbTransaction, userId: string) {
  return tx.execute(
    sql`select pg_advisory_xact_lock(hashtextextended(${`party-applicant:${userId}`}, 0))`,
  );
}

export async function createParty(
  actor: Identity,
  tx?: DbTransaction,
): Promise<Party> {
  const mutate = async (executor: DbTransaction) => {
    await lockPartyApplicant(executor, actor.userId);
    const [party] = await executor
      .insert(parties)
      .values({ leaderId: actor.userId })
      .returning();
    await addPartyMember(executor, party.id, actor);
    return (await readParty(party.id, executor))!;
  };
  return tx ? mutate(tx) : db.transaction(mutate);
}

export async function changeParty(
  actor: Identity,
  partyId: string,
  action:
    | { type: 'leave' }
    | { type: 'disband' }
    | { type: 'kick' | 'promote'; userId: string },
  tx?: DbTransaction,
) {
  const mutate = async (executor: DbTransaction) => {
    const party = await readParty(partyId, executor, 'update');
    if (
      !party ||
      (action.type === 'leave'
        ? !party.members.some((member) => member.userId === actor.userId)
        : !partyOwns(party, actor))
    )
      throw new ForbiddenException('你尚未加入这支队伍');
    if (action.type !== 'leave' && party.leaderId !== actor.userId)
      throw new ForbiddenException('只有队长可以调整其他队员');
    if (action.type === 'disband') {
      await executor.delete(parties).where(eq(parties.id, partyId));
      return null;
    }
    const userId = action.type === 'leave' ? actor.userId : action.userId;
    if (
      !party.members.some((member) => member.userId === userId) ||
      (action.type !== 'leave' && userId === actor.userId)
    )
      throw new BadRequestException('目标队员无效');
    if (action.type === 'promote') {
      await executor
        .update(parties)
        .set({ leaderId: userId, revision: party.revision + 1 })
        .where(eq(parties.id, partyId));
    } else {
      await executor
        .delete(partyMembers)
        .where(
          and(
            eq(partyMembers.partyId, partyId),
            eq(partyMembers.userId, userId),
          ),
        );
      const remaining = party.members.find(
        (member) => member.userId !== userId,
      );
      if (!remaining) {
        await executor.delete(parties).where(eq(parties.id, partyId));
        return null;
      }
      await executor
        .update(parties)
        .set({
          leaderId:
            party.leaderId === userId ? remaining.userId : party.leaderId,
          revision: party.revision + 1,
        })
        .where(eq(parties.id, partyId));
    }
    return readParty(partyId, executor);
  };
  return tx ? mutate(tx) : db.transaction(mutate);
}

/** One-time handoff for rosters created before shared parties were introduced. */
export async function importParty(
  id: string,
  leaderId: string,
  members: readonly Identity[],
): Promise<Party | null> {
  if (!members.length || members.length > PARTY_CAPACITY) return null;
  try {
    return await db.transaction(async (tx) => {
      const [inserted] = await tx
        .insert(parties)
        .values({ id, leaderId })
        .onConflictDoNothing()
        .returning();
      if (inserted) {
        for (const actor of members) await addPartyMember(tx, id, actor);
      }
      return readParty(id, tx);
    });
  } catch (error) {
    if (
      error instanceof ConflictException ||
      error instanceof ForbiddenException
    )
      return null;
    throw error;
  }
}
