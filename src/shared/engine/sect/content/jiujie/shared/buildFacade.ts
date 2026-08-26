import type { SectPathId } from '../../../core';
import { JIUJIE_CONDEMNATION_PATH_ID, JIUJIE_EYE_PATH_ID } from '../ids';

export interface JiujieEyeFeatures {
  openingShield: boolean;
  bearingMark: boolean;
  firstLight: boolean;
  armorMemory: boolean;
  questionBeheld: boolean;
  borrowExtendsEye: boolean;
  lowHpGate: boolean;
  counterThunder: boolean;
  quietCalamity: boolean;
  echoMemory: boolean;
  questionPursuit: boolean;
  shieldRebirth: boolean;
  trueMemory: boolean;
  memoryHeal: boolean;
  settlementReopen: boolean;
  fullMemory: boolean;
  memoryShield: boolean;
  calamityCycle: boolean;
}

export interface JiujieCondemnationFeatures {
  hearingRecords: boolean;
  questionEvidence: boolean;
  firstCrime: boolean;
  damagePunishment: boolean;
  supportPunishment: boolean;
  controlPunishment: boolean;
  changingCrimePunished: boolean;
  lockCrime: boolean;
  basicRecorded: boolean;
  echoExpedites: boolean;
  sealQuickensQuestion: boolean;
  pendingTrial: boolean;
  repeatedThunder: boolean;
  preserveCrime: boolean;
  twoBasicsCrime: boolean;
  fullDebtSettlement: boolean;
  crimeVerdict: boolean;
  endlessCondemnation: boolean;
}

const emptyEyeFeatures = (): JiujieEyeFeatures => ({
  openingShield: false, bearingMark: false, firstLight: false,
  armorMemory: false, questionBeheld: false, borrowExtendsEye: false,
  lowHpGate: false, counterThunder: false, quietCalamity: false,
  echoMemory: false, questionPursuit: false, shieldRebirth: false,
  trueMemory: false, memoryHeal: false, settlementReopen: false,
  fullMemory: false, memoryShield: false, calamityCycle: false,
});

const emptyCondemnationFeatures = (): JiujieCondemnationFeatures => ({
  hearingRecords: false, questionEvidence: false, firstCrime: false,
  damagePunishment: false, supportPunishment: false, controlPunishment: false,
  changingCrimePunished: false, lockCrime: false, basicRecorded: false,
  echoExpedites: false, sealQuickensQuestion: false, pendingTrial: false,
  repeatedThunder: false, preserveCrime: false, twoBasicsCrime: false,
  fullDebtSettlement: false, crimeVerdict: false, endlessCondemnation: false,
});

export interface JiujieBuildSettings {
  pathId?: SectPathId;
  resourceMax: number;
  thunderDuration: number;
  thunderCoefficient: number;
  debtDuration: number;
  receiveDuration: number;
  receiveReduction: number;
  memoryCap: number;
  questionCoefficient: number;
  borrowShieldRatio: number;
  finishDebtCoefficient: number;
  eyeDuration: number;
  reoffendBonus: number;
  finishMemoryRatio: number;
  settlementThunderDuration: number;
  eye: JiujieEyeFeatures;
  condemnation: JiujieCondemnationFeatures;
}

export function createJiujieBuildSettings(pathId?: SectPathId): JiujieBuildSettings {
  const eyePath = pathId === JIUJIE_EYE_PATH_ID;
  const condemnationPath = pathId === JIUJIE_CONDEMNATION_PATH_ID;
  return {
    pathId, resourceMax: 3, thunderDuration: 3, thunderCoefficient: 0.25,
    debtDuration: 4, receiveDuration: eyePath ? 2 : 1, receiveReduction: eyePath ? 0.80 : 0.90,
    memoryCap: eyePath ? 0.50 : 0.25, questionCoefficient: 0.55, borrowShieldRatio: 0.15,
    finishDebtCoefficient: condemnationPath ? 0.20 : 0.15, eyeDuration: 2,
    reoffendBonus: condemnationPath ? 0.15 : 0, finishMemoryRatio: eyePath ? 0.35 : 0,
    settlementThunderDuration: 0,
    eye: emptyEyeFeatures(),
    condemnation: emptyCondemnationFeatures(),
  };
}

export const EYE_BUILD_FACADE = Symbol('jiujie-eye-build');
export const CONDEMNATION_BUILD_FACADE = Symbol('jiujie-condemnation-build');

export class JiujieEyeBuildFacade {
  constructor(readonly settings: JiujieBuildSettings) {}
  enable(feature: keyof JiujieEyeFeatures): void { this.settings.eye[feature] = true; }
}

export class JiujieCondemnationBuildFacade {
  constructor(readonly settings: JiujieBuildSettings) {}
  enable(feature: keyof JiujieCondemnationFeatures): void { this.settings.condemnation[feature] = true; }
}
