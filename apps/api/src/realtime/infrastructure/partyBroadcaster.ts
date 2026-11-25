import {
  encodeNatsSubjectToken,
  publishNatsCoreMessage,
  subscribeNatsCoreSubject,
} from './natsCorePubSub.js';

function partySubject(userId: string) {
  return `daoyou.realtime.party.user.${encodeNatsSubjectToken(userId)}`;
}

export function subscribePartyChanges(userId: string, onChange: () => void) {
  return subscribeNatsCoreSubject(partySubject(userId), (message) => {
    if (message === 'changed') onChange();
  });
}

export function publishPartyChanges(userIds: readonly string[]) {
  for (const userId of new Set(userIds))
    void publishNatsCoreMessage(partySubject(userId), 'changed');
}
