import { HUNT_BOSSES } from '@daoyou/game-content/hunts';
import type { HuntEvent } from '@daoyou/game-domain/hunts';

export const HUNT_TEAM_CHANGED = 'daoyou:hunt-team-changed';

export function notifyHuntTeamChanged() {
  window.dispatchEvent(new Event(HUNT_TEAM_CHANGED));
}

export function huntTargetLabel(event: HuntEvent) {
  return `${event.realm}期·${HUNT_BOSSES[event.bossId].name}`;
}
