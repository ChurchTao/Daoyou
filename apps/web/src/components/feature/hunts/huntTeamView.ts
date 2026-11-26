export { huntTargetLabel } from '@daoyou/game-rules/hunts';

export const HUNT_TEAM_CHANGED = 'daoyou:hunt-team-changed';

export function notifyHuntTeamChanged() {
  window.dispatchEvent(new Event(HUNT_TEAM_CHANGED));
}
