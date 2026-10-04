import type { CreateBattleInput } from '@daoyou/combat-core/types';
import type { AutoStrategy } from './auto-strategy.js';
import type { CombatV6UnitAppearance } from './display.js';


/** Frozen presentation facts belong to the host, never to combat calculations. */
export type PresentedBattleInput = Omit<CreateBattleInput, 'ruleset'> & {
  unitAppearances?: Record<string, CombatV6UnitAppearance>;
  autoStrategy?: AutoStrategy;
};
