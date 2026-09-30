import type { HuntTeam } from '../contracts/hunts';
import { REALM_VALUES, type RealmType } from '../types/constants';
import { huntIsOpen } from './config';
export function huntRealmAllowed(
  team: Pick<HuntTeam, 'minRealm' | 'maxRealm'>,
  realm: RealmType,
) {
  const rank = REALM_VALUES.indexOf(realm);
  return (
    rank >= REALM_VALUES.indexOf(team.minRealm) &&
    rank <= REALM_VALUES.indexOf(team.maxRealm)
  );
}
export function huntStartError(
  team: HuntTeam,
  actorId: string,
  now: number,
): string | null {
  if (!huntIsOpen(team.event, now)) return '此处异动已平息';
  if (team.leaderId !== actorId) return '只有队长可以开战';
  if (team.status !== 'assembling') return '队伍已经开始挑战';
  if (team.members.length < 2 || team.members.length > 4)
    return '需要 2～4 位道友结伴';
  if (new Set(team.members.map((m) => m.userId)).size !== team.members.length)
    return '同一账号不能重复参战';
  if (team.members.some((m) => !huntRealmAllowed(team, m.realm)))
    return '有成员不符合招募境界';
  if (team.members.some((m) => !m.ready)) return '请等待全员准备';
  return null;
}
export function selectHuntTeam(
  teams: HuntTeam[],
  realm: RealmType,
  now: number,
) {
  return teams
    .filter(
      (team) =>
        team.status === 'assembling' &&
        team.members.length < 4 &&
        huntIsOpen(team.event, now) &&
        huntRealmAllowed(team, realm),
    )
    .sort(
      (a, b) => b.members.length - a.members.length || a.id.localeCompare(b.id),
    )[0];
}
