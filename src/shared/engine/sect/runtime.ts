import type { RealmType } from '@shared/types/constants';
import { productionSectRuntime } from './catalog';
import type { CultivatorSectState } from './types';
export { createSectRuntime, type SectRuntime } from './runtimeFactory';

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
