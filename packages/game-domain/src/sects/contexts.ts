import type { PlayerRaceId } from './definitions.js';

export interface SectAdmissionContext {
  playerRace: PlayerRaceId;
  realm: import('@daoyou/constants/realms').RealmType;
  stage: import('@daoyou/constants/realms').RealmStage;
}

export interface SectAdmissionResult {
  allowed: boolean;
  reason?: string;
}
