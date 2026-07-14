import type { RealmType } from '@shared/types/constants';
import type { CultivatorSectState } from '../core';
import { productionSectRuntime } from './productionRuntime';

export { productionSectRuntime, sectRegistry } from './productionRuntime';

export const projectSectCombat = (args: {
  sect: CultivatorSectState;
  realm: RealmType;
}) => productionSectRuntime.projectCombat(args);

export const resolveSectAbility = (args: {
  sect: CultivatorSectState;
  realm: RealmType;
  abilityId: string;
}) => productionSectRuntime.resolveAbility(args);

export const validateSectState = (state: CultivatorSectState) =>
  productionSectRuntime.validateState(state);
