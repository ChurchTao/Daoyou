const MATCH_PREFIX = 'battle:online:';

export const BATTLE_ONLINE_ALL_MATCHES_KEY = 'battle:online:matches';
export const BATTLE_ONLINE_DEADLINES_KEY = 'battle:online:deadlines';
export const BATTLE_ONLINE_DEADLINE_CLAIMS_KEY =
  'battle:online:deadline-claims';
export const BATTLE_ONLINE_RESOLVING_KEY = 'battle:online:resolving';
export const BATTLE_ONLINE_WAITING_KEY = 'battle:online:waiting';
export const BATTLE_ONLINE_WAITING_CLAIMS_KEY =
  'battle:online:waiting-claims';
export const BATTLE_RESOLUTION_TASK_PENDING_KEY =
  'battle:resolution:task:pending';
export const BATTLE_TERMINAL_OUTBOX_PENDING_KEY =
  'battle:terminal:outbox:pending';
export const BATTLE_TERMINAL_CLEANUP_PENDING_KEY =
  'battle:terminal:cleanup:pending';

export function battleOnlineMatchKey(matchId: string): string {
  if (!/^[A-Za-z0-9_-]{1,120}$/.test(matchId)) {
    throw new Error('Invalid battle match id');
  }
  return `${MATCH_PREFIX}${matchId}`;
}

export function battleReplayRoundsKey(matchId: string): string {
  return `${battleOnlineMatchKey(matchId)}:replay-rounds`;
}

export function battleReplayArchivePayloadKey(matchId: string): string {
  if (!/^[A-Za-z0-9_-]{1,120}$/.test(matchId)) {
    throw new Error('Invalid battle match id');
  }
  return `battle:replay:archive:payload:${matchId}`;
}

export function battleOnlineCommandReceiptsKey(matchId: string): string {
  return `${battleOnlineMatchKey(matchId)}:command-receipts`;
}

export function battleOnlinePresentationKey(matchId: string): string {
  return `${battleOnlineMatchKey(matchId)}:presentation`;
}

export function battleOnlineEventSnapshotsKey(matchId: string): string {
  return `${battleOnlineMatchKey(matchId)}:event-snapshots`;
}

export function battleTerminalOutboxKey(matchId: string): string {
  if (!/^[A-Za-z0-9_-]{1,120}$/.test(matchId)) {
    throw new Error('Invalid battle match id');
  }
  return `battle:terminal:outbox:${matchId}`;
}
