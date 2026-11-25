import { apiFetch } from '@app/lib/api/fetch';
import type { PartyRecruitmentSource } from '@daoyou/contracts/party';

export async function requestParty<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await apiFetch(`/api/parties${path}`, {
    cache: 'no-store',
    ...init,
  });
  const body = await response.json();
  if (!response.ok)
    throw new Error(body.message ?? body.error ?? '暂时无法处理队伍事务');
  return body;
}

export function partyInviteHref(
  partyId: string,
  source: PartyRecruitmentSource = { kind: 'invite' },
) {
  const query = new URLSearchParams({ join: partyId });
  if (source.kind === 'hunt') {
    query.set('kind', source.kind);
    if (source.eventId) query.set('eventId', source.eventId);
  } else if (source.kind === 'invasion') {
    query.set('kind', source.kind);
    query.set('week', source.week);
  }
  return `/game/party?${query}`;
}
