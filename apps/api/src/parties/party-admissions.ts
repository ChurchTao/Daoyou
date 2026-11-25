import { type RealmType } from '@daoyou/constants/realms';
import {
  PARTY_CAPACITY,
  type PartyRecruitment,
  type PartyRecruitmentSource,
} from '@daoyou/contracts/party';
import { huntEventsAt, huntRealmAllowed } from '@daoyou/game-rules/hunts';
import { invasionWeek } from '@daoyou/game-rules/invasion';
import { hasActiveCombat } from '@server/combat/application/CombatOccupancy.js';
import {
  huntRecruitingTeams,
  huntRecruitmentFor,
  withHuntRecruitment,
} from '@server/hunts/application/HuntTeamService.js';
import {
  invasionRecruitmentFor,
  recruitingInvasionParties,
} from '@server/invasion/invasion.service.js';
import { db, type DbTransaction } from '@server/lib/drizzle/db.js';
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

export async function listPartyRecruitments(
  kind: 'hunt' | 'invasion',
  applicant: Applicant,
) {
  const now = Date.now();
  if (kind === 'invasion') {
    const clock = invasionWeek(now);
    if (!clock.open) return [];
    const source = { kind, week: clock.week } as const;
    const parties = (await recruitingInvasionParties(clock.week)).slice(0, 20);
    const items = await Promise.all(
      parties.map(async (party) => {
        const details = await validatePartyRecruitment(
          party,
          source,
          applicant,
        );
        return details && describePartyRecruitment(party, source, details);
      }),
    );
    return items.filter((entry) => entry !== null);
  }
  const teams = (
    await Promise.all(
      huntEventsAt(now).map(({ id }) => huntRecruitingTeams(id)),
    )
  )
    .flat()
    .filter(
      (team) =>
        team.status === 'assembling' &&
        team.members.length < PARTY_CAPACITY &&
        huntRealmAllowed(team, applicant.realm as RealmType),
    )
    .slice(0, 20);
  const parties = new Map(
    (await readParties(teams.map(({ id }) => id))).map((party) => [
      party.id,
      party,
    ]),
  );
  const items = await Promise.all(
    teams.map(async (team) => {
      const party = parties.get(team.id);
      if (!party || party.members.length >= PARTY_CAPACITY) return null;
      const source = { kind, eventId: team.event?.id ?? null } as const;
      const details = await validatePartyRecruitment(party, source, applicant);
      return details && describePartyRecruitment(party, source, details);
    }),
  );
  return items.filter((entry) => entry !== null);
}
