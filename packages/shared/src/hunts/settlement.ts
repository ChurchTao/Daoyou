import {
  isStanding,
  type Attrs,
  type BattleState,
  type Unit,
} from '../engine/combat-v6/core/index.js';
import { settleWildResources } from '../engine/combat-v6/wild/rules.js';

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

export function settleHuntResources(
  entry: Partial<Attrs> | undefined,
  final: Unit | undefined,
  technicalAbort: boolean,
) {
  if (
    !entry ||
    !final ||
    ![entry.hp, entry.mp, entry.maxHp, entry.maxMp].every(
      (n) => typeof n === 'number' && Number.isFinite(n),
    )
  )
    throw new Error('HUNT_RESOURCES_MISSING');
  return settleWildResources(
    {
      ...final.attrs,
      hp: final.flags.dead || final.flags.downed ? 0 : final.attrs.hp,
    },
    { hp: entry.hp!, mp: entry.mp!, maxHp: entry.maxHp!, maxMp: entry.maxMp! },
    technicalAbort,
  );
}
