const MATCH_PREFIX = 'battle:online:';

export const BATTLE_ONLINE_ALL_MATCHES_KEY = 'battle:online:matches';
export const BATTLE_ONLINE_DEADLINES_KEY = 'battle:online:deadlines';
export const BATTLE_ONLINE_RESOLVING_KEY = 'battle:online:resolving';
export const BATTLE_ONLINE_WAITING_KEY = 'battle:online:waiting';

export function battleOnlineMatchKey(matchId: string): string {
  if (!/^[A-Za-z0-9_-]{1,120}$/.test(matchId)) {
    throw new Error('Invalid battle match id');
  }
  return `${MATCH_PREFIX}${matchId}`;
}

export function battleReplayRoundsKey(matchId: string): string {
  return `${battleOnlineMatchKey(matchId)}:replay-rounds`;
}
