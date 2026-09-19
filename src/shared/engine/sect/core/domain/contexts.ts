import type { PlayerRaceId } from './definitions';

export interface SectAdmissionContext {
  playerRace: PlayerRaceId;
  realm: import('@shared/types/constants').RealmType;
  stage: import('@shared/types/constants').RealmStage;
}

export interface SectAdmissionResult {
  allowed: boolean;
  reason?: string;
}
