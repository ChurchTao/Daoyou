import type { RealtimeServerEvent } from '@daoyou/contracts/realtime';
import { db } from '@server/lib/drizzle/db.js';
import { partyMembers } from '@server/lib/drizzle/schema.js';
import { inArray } from 'drizzle-orm';
import {
  encodeNatsSubjectToken,
  publishNatsCoreMessage,
  subscribeNatsCoreSubject,
  waitForNatsCoreSubjectReady,
} from './natsCorePubSub.js';

type PartyEvent = Extract<
  RealtimeServerEvent,
  { type: 'party.changed' | 'party.vitals.changed' | 'party.presence.changed' }
>;

function partySubject(userId: string) {
  return `daoyou.realtime.party.user.${encodeNatsSubjectToken(userId)}`;
}

export function subscribePartyChanges(
  userId: string,
  cultivatorId: string | null,
  send: (event: PartyEvent) => void,
) {
  return subscribeNatsCoreSubject(partySubject(userId), (message) => {
    if (message === 'changed') {
      send({ type: 'party.changed', payload: null });
      return;
    }
    const [kind, recipient, partyId] = message.split(':');
    if (recipient !== cultivatorId || !partyId) return;
    if (kind === 'vitals' || kind === 'presence')
      send({ type: `party.${kind}.changed`, payload: { partyId } });
  });
}

export function waitForPartyChangesReady(userId: string, signal: AbortSignal) {
  return waitForNatsCoreSubjectReady(partySubject(userId), signal);
}

export function publishPartyChanges(userIds: readonly string[]) {
  for (const userId of new Set(userIds))
    void publishNatsCoreMessage(partySubject(userId), 'changed');
}

export async function publishPartyMemberChanges(
  kind: 'vitals' | 'presence',
  cultivatorIds: string[],
) {
  const affectedParties = db
    .select({ partyId: partyMembers.partyId })
    .from(partyMembers)
    .where(inArray(partyMembers.cultivatorId, cultivatorIds));
  const audience = await db
    .select({
      userId: partyMembers.userId,
      cultivatorId: partyMembers.cultivatorId,
      partyId: partyMembers.partyId,
    })
    .from(partyMembers)
    .where(inArray(partyMembers.partyId, affectedParties));

  for (const member of audience)
    void publishNatsCoreMessage(
      partySubject(member.userId),
      `${kind}:${member.cultivatorId}:${member.partyId}`,
    );
}
