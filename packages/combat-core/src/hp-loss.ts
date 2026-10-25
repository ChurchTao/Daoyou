import type { BattleContext } from './context.js';
import type { Unit } from './types.js';

/** Actual HP decreases stay recorded even when healing later restores the HP. */
export function recordHpLoss(ctx: Pick<BattleContext, 'state'>, unit: Unit, amount: number): void {
  if (amount <= 0) return;
  const previous = unit.hpLossThisRound;
  unit.hpLossThisRound = {
    round: ctx.state.round,
    amount: (previous?.round === ctx.state.round ? previous.amount : 0) + amount,
  };
}
