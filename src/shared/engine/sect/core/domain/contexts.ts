import type { RealmType } from '@shared/types/constants';
import type { Cultivator } from '@shared/types/cultivator';
import type { PlayerRaceId, SectAbilityId } from './definitions';
import type { CultivatorSectPathState, CultivatorSectState } from './state';

export interface SectProjectionContext {
  sect: CultivatorSectState;
  realm: RealmType;
}

export interface SectPathCompileContext extends SectProjectionContext {
  path: CultivatorSectPathState;
}

export interface SectNodeApplyContext extends SectPathCompileContext {
  activeNodeIds: ReadonlySet<string>;
}

export interface SectAbilityResolveContext extends SectProjectionContext {
  abilityId: SectAbilityId;
}

export interface SectAdmissionContext {
  playerRace: PlayerRaceId;
  realm: import('@shared/types/constants').RealmType;
  stage: import('@shared/types/constants').RealmStage;
}

export interface SectAdmissionResult {
  allowed: boolean;
  reason?: string;
}

export interface SectTrialContext {
  cultivator: Cultivator;
}

export interface SectTrialScenario {
  trainee: Cultivator;
  opponent: Cultivator;
}
