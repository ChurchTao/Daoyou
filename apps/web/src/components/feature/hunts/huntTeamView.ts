import { HUNT_BOSSES } from '@daoyou/game-content/hunts';
import type { HuntEvent, HuntTeam } from '@daoyou/game-domain/hunts';

export const HUNT_TEAM_CHANGED = 'daoyou:hunt-team-changed';

export function notifyHuntTeamChanged() {
  window.dispatchEvent(new Event(HUNT_TEAM_CHANGED));
}

export function huntTargetLabel(event: HuntEvent) {
  return `${event.realm}期·${HUNT_BOSSES[event.bossId].name}`;
}

export function huntTeamStatusLabel(status: HuntTeam['status']) {
  if (status === 'in_battle') return '讨伐中';
  if (status === 'starting') return '正在出战';
  return '集结中';
}

export function huntTeamSummary(team: HuntTeam) {
  const names = team.members.map((member) => member.name).join('、');
  const target = team.event ? huntTargetLabel(team.event) : '未选目标';
  return `${team.members.length}/4 · ${names} · ${target} · ${huntTeamStatusLabel(team.status)}`;
}
