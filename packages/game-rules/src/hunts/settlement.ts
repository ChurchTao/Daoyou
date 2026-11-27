import { isStanding } from '@daoyou/combat-core/units';
import type { BattleState } from '@daoyou/combat-core/types';

/** Personal success uses the terminal battle state, before post-battle recovery. */
export function huntParticipantSucceeded(state: BattleState, unitId: string) {
  const unit = state.units.find((u) => u.id === unitId);
  return (
    state.result?.winner === 0 &&
    !!unit &&
    unit.kind === 'player' &&
    unit.side === 0 &&
    unit.attrs.hp > 0 &&
    isStanding(unit)
  );
}
