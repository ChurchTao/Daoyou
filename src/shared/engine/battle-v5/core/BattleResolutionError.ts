export type BattleResolutionErrorCode =
  | 'BATTLE_ROUND_RESOLUTION_FAILED'
  | 'BATTLE_RESOLUTION_LIMIT_EXCEEDED'
  | 'BATTLE_REACTION_LIMIT_EXCEEDED'
  | 'BATTLE_DAMAGE_COMPONENT_INVALID';

export class BattleResolutionError extends Error {
  constructor(
    readonly code: BattleResolutionErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'BattleResolutionError';
  }
}
