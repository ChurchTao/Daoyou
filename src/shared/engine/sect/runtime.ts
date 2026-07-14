import { sectRegistry } from './catalog';
import type { CultivatorSectState, ResolvedSectAbility, SectCombatProjection } from './types';
import type { RealmType } from '@shared/types/constants';

export function projectSectCombat(args: { sect: CultivatorSectState; realm: RealmType }): SectCombatProjection | null {
  sectRegistry.validateState(args.sect);
  return sectRegistry.require(args.sect.sectId).projectCombat(args);
}

export function resolveSectAbility(args: {
  sect: CultivatorSectState;
  realm: RealmType;
  abilityId: string;
}): ResolvedSectAbility {
  sectRegistry.validateState(args.sect);
  return sectRegistry.require(args.sect.sectId).resolveAbility(args);
}

export function validateSectState(state: CultivatorSectState): void {
  sectRegistry.validateState(state);
}
