import type { PlayerRaceId } from './definitions.js';

export interface SectAdmissionContext {
  playerRace: PlayerRaceId;
  realm: import('@daoyou/shared/types/constants').RealmType;
  stage: import('@daoyou/shared/types/constants').RealmStage;
}

export interface SectAdmissionResult {
  allowed: boolean;
  reason?: string;
}
