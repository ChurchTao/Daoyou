import { type RealmType } from '@daoyou/constants/realms';
import {
  PARTY_CAPACITY,
  PARTY_RECRUITMENT_LABELS,
  type PartyRecruitment,
  type PartyRecruitmentIntent,
  type PartyRecruitmentSource,
} from '@daoyou/contracts/party';
import { hasActiveCombat } from '@server/combat/application/CombatOccupancy.js';
import {
  huntRecruitmentFor,
  withHuntRecruitment,
} from '@server/hunts/application/HuntTeamService.js';
import { invasionRecruitmentFor } from '@server/invasion/invasion.service.js';
import { db, type DbTransaction } from '@server/lib/drizzle/db.js';
import {
  listRecruitmentNotices,
  readPartyRecruitment,
} from './party-recruitments.js';
import { readParties, type Party } from './party.service.js';

type Applicant = { userId: string; cultivatorId: string; realm: string };
type RecruitmentDetails = {
  label: string;
  requirement?: string;
  deadline?: number;
};

export function describePartyRecruitment(
  party: Party,
  source: PartyRecruitmentSource,
  { label, requirement }: RecruitmentDetails,
): PartyRecruitment {
  const member = party.members.find(({ userId }) => userId === party.leaderId)!;
  const { cultivatorId, name, title, realm, realmStage, gender } = member;
  return {
    partyId: party.id,
    leader: { cultivatorId, name, title, realm, realmStage, gender },
    memberCount: party.members.length,
    source,
    label,
    requirement,
  };
}

export async function validatePartyRecruitment(
  party: Party,
  source: PartyRecruitmentSource,
  applicant: Applicant,
  tx: DbTransaction | typeof db = db,
): Promise<RecruitmentDetails | null> {
  if (source.kind === 'invite') return { label: '自由结伴' };
  if (source.kind === 'public') {
    const notice = await readPartyRecruitment(party.id);
    return notice?.id === source.recruitmentId
      ? { label: PARTY_RECRUITMENT_LABELS[notice.intent] }
      : null;
  }
  if (await hasActiveCombat(applicant.cultivatorId)) return null;
  if (source.kind === 'invasion')
    return invasionRecruitmentFor(party, source.week, applicant, tx);
  return huntRecruitmentFor(
    party,
    source.eventId,
    applicant.realm as RealmType,
  );
}

// The hunt changes its target under a Redis lease before locking the party in PostgreSQL.
export function withPartyRecruitment<T>(
  source: PartyRecruitmentSource,
  task: () => Promise<T>,
) {
  return source.kind === 'hunt' ? withHuntRecruitment(task) : task();
}

export async function listPartyRecruitments(intent?: PartyRecruitmentIntent) {
  const notices = await listRecruitmentNotices(intent);
  const parties = new Map(
    (await readParties(notices.map(({ partyId }) => partyId))).map((party) => [
      party.id,
      party,
    ]),
  );
  return notices
    .flatMap((notice) => {
      const party = parties.get(notice.partyId);
      if (!party || party.members.length >= PARTY_CAPACITY) return [];
      return [
        describePartyRecruitment(
          party,
          { kind: 'public', recruitmentId: notice.id },
          { label: PARTY_RECRUITMENT_LABELS[notice.intent] },
        ),
      ];
    })
    .slice(0, 20);
}
