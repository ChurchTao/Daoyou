export type BattleResolutionErrorCode =
  | 'BATTLE_ROUND_RESOLUTION_FAILED'
  | 'BATTLE_RESOLUTION_LIMIT_EXCEEDED';

export class BattleResolutionError extends Error {
  constructor(
    readonly code: BattleResolutionErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'BattleResolutionError';
  }
}
