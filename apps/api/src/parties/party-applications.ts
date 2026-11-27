import {
  PARTY_APPLICATION_LIMIT,
  PARTY_APPLICATION_TTL_MS,
  PARTY_CAPACITY,
  type CurrentParty,
  type PartyApplication,
  type PartyApplicationStatus,
  type PartyRecruitmentSource,
  type PartyVitalsView,
} from '@daoyou/contracts/party';
import { SECT_ORGANIZATION_DEFINITIONS } from '@daoyou/game-content/sect-organization/definitions';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { readPersistentCharacterVitals } from '@server/combat/application/CombatV6PersistentCondition.js';
import { loadCultivatorInspectionData } from '@server/cultivator/application/readers/CultivatorCombatProjectionReader.js';
import type { ActiveCultivatorRef } from '@server/lib/auth/types.js';
import { db, type DbExecutor } from '@server/lib/drizzle/db.js';
import {
  cultivators,
  parties,
  partyMembers,
  sectMemberships,
} from '@server/lib/drizzle/schema.js';
import type { PresenceService } from '@server/presence/presence.service.js';
import { publishPartyChanges } from '@server/realtime/infrastructure/partyBroadcaster.js';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import {
  describePartyRecruitment,
  validatePartyRecruitment,
  withPartyRecruitment,
} from './party-admissions.js';
import {
  getPartyApplication,
  incomingPartyApplications,
  isPendingApplication,
  pendingPartyApplications,
  recentPartyApplications,
  writePartyApplications,
  type StoredPartyApplication,
} from './party-application-store.js';
import { readPartyRecruitment } from './party-recruitments.js';
import {
  addPartyMember,
  lockPartyApplicant,
  partyForUser,
  partyOwns,
  readParty,
  type Party,
} from './party.service.js';

type Identity = Pick<ActiveCultivatorRef, 'userId' | 'cultivatorId'>;

const publicIdentity = {
  cultivatorId: cultivators.id,
  name: cultivators.name,
  realm: cultivators.realm,
  realmStage: cultivators.realm_stage,
  title: cultivators.title,
  gender: cultivators.gender,
};

export async function partyApplicant(
  actor: Identity,
  executor: DbExecutor = db,
) {
  const [identity] = await executor
    .select(publicIdentity)
    .from(cultivators)
    .where(
      and(
        eq(cultivators.id, actor.cultivatorId),
        eq(cultivators.userId, actor.userId),
        eq(cultivators.status, 'active'),
      ),
    );
  return identity && { ...identity, userId: actor.userId };
}

async function existingParties(
  rows: StoredPartyApplication[],
  executor: DbExecutor = db,
) {
  if (!rows.length) return new Set<string>();
  const found = await executor
    .select({ id: parties.id })
    .from(parties)
    .where(inArray(parties.id, [...new Set(rows.map((row) => row.partyId))]));
  return new Set(found.map(({ id }) => id));
}

function applicationStatus(
  row: StoredPartyApplication,
  membership: Party | null,
  now: number,
): PartyApplicationStatus {
  if (row.status === 'reviewing')
    return membership?.id === row.partyId && partyOwns(membership, row)
      ? 'accepted'
      : 'expired';
  if (
    row.status === 'pending' &&
    (membership || !isPendingApplication(row, now))
  )
    return 'expired';
  return row.status;
}

function applicationView(
  row: StoredPartyApplication,
  status: PartyApplicationStatus,
): PartyApplication {
  const { id, partyId, partyLabel, label, source, expiresAt } = row;
  return { id, partyId, partyLabel, label, source, status, expiresAt };
}

export async function currentParty(actor: Identity): Promise<CurrentParty> {
  const party = await partyForUser(actor.userId);
  const roleMismatch = Boolean(party && !partyOwns(party, actor));
  const [inbox, history, recruitment] = await Promise.all([
    party && !roleMismatch && party.leaderId === actor.userId
      ? incomingPartyApplications(party.id).catch(() => [])
      : [],
    recentPartyApplications(actor.userId).catch(() => []),
    party && !roleMismatch
      ? readPartyRecruitment(party.id).catch(() => null)
      : null,
  ]);
  const sent = history.filter((row) => row.cultivatorId === actor.cultivatorId);
  const now = Date.now();
  const [applicants, openParties] = await Promise.all([
    inbox.length
      ? db
          .select({ ...publicIdentity, userId: cultivators.userId })
          .from(cultivators)
          .leftJoin(partyMembers, eq(partyMembers.userId, cultivators.userId))
          .where(
            and(
              inArray(
                cultivators.id,
                inbox.map((row) => row.cultivatorId),
              ),
              eq(cultivators.status, 'active'),
              isNull(partyMembers.userId),
            ),
          )
      : [],
    party
      ? new Set<string>()
      : existingParties(sent.filter((row) => isPendingApplication(row, now))),
  ]);
  const people = new Map(
    applicants.map((person) => [person.cultivatorId, person]),
  );
  return {
    party,
    roleMismatch,
    recruitment,
    incoming: inbox.flatMap((row) => {
      const person = people.get(row.cultivatorId);
      if (person?.userId !== row.userId || !isPendingApplication(row))
        return [];
      const { cultivatorId, name, realm, realmStage, title, gender } = person;
      return [
        {
          ...applicationView(row, 'pending'),
          applicant: { cultivatorId, name, realm, realmStage, title, gender },
        },
      ];
    }),
    outgoing: sent.map((row) => {
      const status = applicationStatus(row, party, now);
      return applicationView(
        row,
        status === 'pending' && !openParties.has(row.partyId)
          ? 'expired'
          : status,
      );
    }),
  };
}

export async function previewPartyApplication(
  actor: Identity,
  partyId: string,
  source: PartyRecruitmentSource,
) {
  const [party, applicant] = await Promise.all([
    readParty(partyId),
    partyApplicant(actor),
  ]);
  if (!party) throw new NotFoundException('队伍已解散');
  if (!applicant) throw new ForbiddenException('当前角色无法组队');
  const details = await validatePartyRecruitment(party, source, applicant);
  if (!details)
    throw new ConflictException(
      source.kind === 'public'
        ? '这条招募已结束'
        : '招募已结束，或当前角色不符合招募条件',
    );
  return describePartyRecruitment(party, source, details);
}

export async function applyToParty(
  actor: Identity,
  partyId: string,
  source: PartyRecruitmentSource,
) {
  const leaderId = await withPartyRecruitment(source, () =>
    db.transaction(async (tx) => {
      await lockPartyApplicant(tx, actor.userId);
      if (await partyForUser(actor.userId, tx))
        throw new ConflictException('请先退出当前队伍');
      const applicant = await partyApplicant(actor, tx);
      if (!applicant) throw new ForbiddenException('当前角色无法组队');
      const party = await readParty(partyId, tx, 'update');
      if (!party) throw new NotFoundException('队伍已解散');
      const pending = await pendingPartyApplications(actor.userId);
      const sameParty = pending.filter((row) => row.partyId === partyId);
      if (sameParty.some((row) => row.cultivatorId === actor.cultivatorId))
        return party.leaderId;
      const others = await existingParties(
        pending.filter((row) => row.partyId !== partyId),
        tx,
      );
      if (others.size >= PARTY_APPLICATION_LIMIT)
        throw new ConflictException(
          `最多同时申请 ${PARTY_APPLICATION_LIMIT} 支队伍`,
        );
      if (party.members.length >= PARTY_CAPACITY)
        throw new ConflictException('队伍已满');
      const details = await validatePartyRecruitment(
        party,
        source,
        applicant,
        tx,
      );
      if (!details)
        throw new ConflictException(
          source.kind === 'public'
            ? '这条招募已结束'
            : '招募已结束，或当前角色不符合招募条件',
        );
      const createdAt = Date.now();
      const expiresAt = Math.min(
        createdAt + PARTY_APPLICATION_TTL_MS,
        details.deadline ?? Infinity,
      );
      if (expiresAt <= createdAt) throw new ConflictException('招募已结束');
      const recruitment = describePartyRecruitment(party, source, details);
      await writePartyApplications([
        ...sameParty.map((row) => ({ ...row, status: 'expired' as const })),
        {
          id: randomUUID(),
          partyId,
          userId: actor.userId,
          cultivatorId: actor.cultivatorId,
          partyLabel: recruitment.leader.name,
          source,
          label: recruitment.label,
          status: 'pending',
          createdAt,
          expiresAt,
        },
      ]);
      return party.leaderId;
    }),
  );
  publishPartyChanges([leaderId, actor.userId]);
  return 'pending' as const;
}

export async function expireApplicationsAfterPartyCreation(actor: Identity) {
  try {
    await db.transaction(async (tx) => {
      await lockPartyApplicant(tx, actor.userId);
      if (!(await partyForUser(actor.userId, tx))) return;
      const pending = await pendingPartyApplications(actor.userId);
      await writePartyApplications(
        pending.map((row) => ({ ...row, status: 'expired' })),
      );
    });
  } catch (error) {
    console.warn(
      '[party] could not close pending applications after party creation',
      error,
    );
  }
}

export async function reviewPartyApplication(
  actor: Identity,
  id: string,
  action: 'approve' | 'reject' | 'cancel',
) {
  const snapshot = await getPartyApplication(id);
  if (!snapshot) throw new NotFoundException('这条申请已失效');

  const review = () =>
    db.transaction(
      async (
        tx,
      ): Promise<{
        status: PartyApplicationStatus;
        audience: string[];
        accepted?: StoredPartyApplication;
      }> => {
        await lockPartyApplicant(tx, snapshot.userId);
        const party = await readParty(snapshot.partyId, tx, 'update');
        const row = await getPartyApplication(id);
        if (!row) throw new NotFoundException('这条申请已失效');
        if (action === 'cancel') {
          if (
            row.userId !== actor.userId ||
            row.cultivatorId !== actor.cultivatorId
          )
            throw new ForbiddenException('只能撤回自己的申请');
        } else if (
          !party ||
          party.leaderId !== actor.userId ||
          !partyOwns(party, actor)
        ) {
          throw new ForbiddenException('由队长处理入队申请');
        }

        const membership = await partyForUser(row.userId, tx);
        const current = applicationStatus(row, membership, Date.now());
        if (current !== 'pending') return { status: current, audience: [] };

        const audience = [
          row.userId,
          ...(party?.members.map(({ userId }) => userId) ?? []),
        ];
        let status: PartyApplicationStatus =
          action === 'cancel' ? 'cancelled' : 'rejected';
        if (action === 'approve' && party) {
          const applicant = await partyApplicant(row, tx);
          if (
            !applicant ||
            (row.source.kind !== 'public' &&
              !(await validatePartyRecruitment(
                party,
                row.source,
                applicant,
                tx,
              ))) ||
            !isPendingApplication(row)
          ) {
            status = 'expired';
          } else {
            if (party.members.length >= PARTY_CAPACITY)
              throw new ConflictException('队伍已满');
            const other = (await pendingPartyApplications(row.userId)).filter(
              (entry) => entry.id !== row.id,
            );
            if (!isPendingApplication(row))
              return { status: 'expired', audience };
            // Consume the permission before changing membership. If PostgreSQL rolls back,
            // the applicant can reapply. An old request cannot add them after they leave.
            await writePartyApplications([
              ...other.map((entry) => ({
                ...entry,
                status: 'expired' as const,
              })),
              { ...row, status: 'reviewing' },
            ]);
            await addPartyMember(tx, party.id, row);
            await tx
              .update(parties)
              .set({ revision: party.revision + 1 })
              .where(eq(parties.id, party.id));
            return {
              status: 'accepted',
              audience,
              accepted: { ...row, status: 'accepted' },
            };
          }
        }
        await writePartyApplications([{ ...row, status }]);
        return { status, audience };
      },
    );

  const result = await (action === 'approve'
    ? withPartyRecruitment(snapshot.source, review)
    : review());
  if (result.accepted) {
    try {
      await writePartyApplications([result.accepted]);
    } catch (error) {
      console.warn('[party] could not record an approval receipt', error);
    }
  }
  publishPartyChanges(result.audience);
  return result.status;
}

export async function inspectPartyApplicant(actor: Identity, id: string) {
  const row = await getPartyApplication(id);
  if (!row || !isPendingApplication(row))
    throw new NotFoundException('这条申请已失效');
  const party = await readParty(row.partyId);
  if (!party || party.leaderId !== actor.userId || !partyOwns(party, actor))
    throw new ForbiddenException('由队长查看入队申请');
  if (await partyForUser(row.userId))
    throw new NotFoundException('这条申请已失效');
  const profile = await loadCultivatorInspectionData(row.cultivatorId);
  if (!profile) throw new NotFoundException('申请角色已不可用');
  return profile;
}

export async function inspectPartyMember(actor: Identity, id: string) {
  const party = await partyForUser(actor.userId);
  if (!party || !partyOwns(party, actor))
    throw new ForbiddenException('仅队内道友可互相查探');
  if (!party.members.some((member) => member.cultivatorId === id))
    throw new NotFoundException('这位道友已不在队中');
  const profile = await loadCultivatorInspectionData(id);
  if (!profile) throw new NotFoundException('队员角色已不可用');
  return profile;
}

export async function readPartyVitals(
  actor: Identity,
  partyId: string,
  presence: Pick<PresenceService, 'getOnlineCultivatorIds'>,
): Promise<PartyVitalsView> {
  const party = await partyForUser(actor.userId);
  if (!party || party.id !== partyId || !partyOwns(party, actor))
    throw new ForbiddenException('仅当前队员可查看队伍状态');

  const ids = party.members.map(({ cultivatorId }) => cultivatorId);
  const [online, vitals, memberships] = await Promise.all([
    presence.getOnlineCultivatorIds(ids),
    Promise.allSettled(ids.map((id) => readPersistentCharacterVitals(id, db))),
    db
      .select({
        cultivatorId: sectMemberships.cultivatorId,
        sectId: sectMemberships.sectId,
      })
      .from(sectMemberships)
      .where(
        and(
          inArray(sectMemberships.cultivatorId, ids),
          eq(sectMemberships.status, 'active'),
        ),
      ),
  ]);
  const sectNames = new Map(
    memberships.map(({ cultivatorId, sectId }) => [
      cultivatorId,
      Object.hasOwn(SECT_ORGANIZATION_DEFINITIONS, sectId)
        ? SECT_ORGANIZATION_DEFINITIONS[sectId].name
        : '未知宗门',
    ] as const),
  );
  return Object.fromEntries(
    ids.map((id, index) => {
      const result = vitals[index];
      return [id, {
        online: online.has(id),
        sectName: sectNames.get(id) ?? null,
        vitals: result.status === 'fulfilled' ? result.value : null,
      }];
    }),
  );
}
