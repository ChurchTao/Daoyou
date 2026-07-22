import type { SectPathId } from '../../../core';

export interface YouduBuildSettings {
  pathId?: SectPathId;
  forgetDirectCoefficient: number;
  forgetDotCoefficient: number;
  forgetDuration: number;
  forgetHealReduction: number;
  forgetSpeedReduction: number;
  forgetHighLayerBonus: number;
  forgetFourLayerBonus: number;
  sighForgetBonus: number;
  firstErosionExtraFire: boolean;
  erosionAttributeCurve: readonly number[];
  erosionHealCurve: readonly number[];
  crossingEcho: boolean;
  cleanseToll: boolean;
  noReturnSpeedReduction: number;
  hundredGhosts: boolean;
  dreamInvasion: boolean;
  lastFerry: boolean;
  finishRetainedLayers: number;
  finishBaseCoefficient: number;
  finishPerLayerCoefficient: number;
  finishAddsForget: boolean;
  mixedDamageMultiplier: number;
  shadowDuration: number;
  extraControlResistance: number;
  seizeDuration: number;
  pinMpCost: number;
  soulFireBonus: number;
  severHighLayerBonus: number;
  firstShadowExtraLayer: boolean;
  heartSoulFireGain: number;
  pinHighLayerSlow: boolean;
  lostResistPenalty: boolean;
  pinControlHitBonus: number;
  lostAfterPenalty: boolean;
  heartShield: boolean;
  oneNameOneJudgment: boolean;
  nameInYoudu: boolean;
  decreeDirectSoulBonus: number;
  decreeShadowLayerBonus: number;
}

export function createYouduBuildSettings(pathId?: SectPathId): YouduBuildSettings {
  return {
    pathId,
    forgetDirectCoefficient: 0.16,
    forgetDotCoefficient: 0.14,
    forgetDuration: 2,
    forgetHealReduction: 0.20,
    forgetSpeedReduction: 0,
    forgetHighLayerBonus: pathId === 'tide' ? 0.20 : 0,
    forgetFourLayerBonus: 0,
    sighForgetBonus: 0,
    firstErosionExtraFire: false,
    erosionAttributeCurve: [-0.03, -0.05, -0.08, -0.12, -0.12],
    erosionHealCurve: [0, 0.15, 0.30, 0.50, 1],
    crossingEcho: false,
    cleanseToll: false,
    noReturnSpeedReduction: -0.30,
    hundredGhosts: false,
    dreamInvasion: false,
    lastFerry: false,
    finishRetainedLayers: 0,
    finishBaseCoefficient: 0.70,
    finishPerLayerCoefficient: 0.20,
    finishAddsForget: false,
    mixedDamageMultiplier: 1,
    shadowDuration: 3,
    extraControlResistance: 0,
    seizeDuration: 2,
    pinMpCost: 55,
    soulFireBonus: 0.25,
    severHighLayerBonus: 0.50,
    firstShadowExtraLayer: false,
    heartSoulFireGain: pathId === 'decree' ? 1 : 0,
    pinHighLayerSlow: false,
    lostResistPenalty: false,
    pinControlHitBonus: 0,
    lostAfterPenalty: false,
    heartShield: false,
    oneNameOneJudgment: false,
    nameInYoudu: false,
    decreeDirectSoulBonus: pathId === 'decree' ? 0.10 : 0,
    decreeShadowLayerBonus: pathId === 'decree' ? 0.01 : 0,
  };
}

export const TIDE_BUILD_FACADE = Symbol('youdu-tide-build');
export const DECREE_BUILD_FACADE = Symbol('youdu-decree-build');

export class TideBuildFacade {
  constructor(readonly settings: YouduBuildSettings) {}
  empowerForget(): void {
    this.settings.forgetDirectCoefficient *= 1.15;
    this.settings.forgetDotCoefficient *= 1.15;
  }
  empowerSigh(): void { this.settings.sighForgetBonus = 0.20; }
  enableFirstLantern(): void { this.settings.firstErosionExtraFire = true; }
  extendForget(): void { this.settings.forgetDuration = 3; }
  deepenHealSuppression(): void { this.settings.forgetHealReduction = 0.30; }
  slowBlackWater(): void { this.settings.forgetSpeedReduction = -0.08; }
  deepenAttributeCurve(): void {
    this.settings.erosionAttributeCurve = [-0.03, -0.05, -0.10, -0.15, -0.15];
  }
  deepenHealCurve(): void {
    this.settings.erosionHealCurve = [0, 0.15, 0.40, 0.60, 1];
  }
  enableCrossingEcho(): void { this.settings.crossingEcho = true; }
  empowerFourLayerForget(): void { this.settings.forgetFourLayerBonus = 0.30; }
  enableCleanseToll(): void { this.settings.cleanseToll = true; }
  deepenNoReturnSlow(): void { this.settings.noReturnSpeedReduction = -0.40; }
  enableHundredGhosts(): void { this.settings.hundredGhosts = true; }
  enableDreamInvasion(): void { this.settings.dreamInvasion = true; }
  enableLastFerry(): void { this.settings.lastFerry = true; }
  retainTwoLayers(): void { this.settings.finishRetainedLayers = 2; }
  deepenLament(): void { this.settings.finishPerLayerCoefficient = 0.24; }
  enableBurialCurrent(): void { this.settings.finishAddsForget = true; }
}

export class DecreeBuildFacade {
  constructor(readonly settings: YouduBuildSettings) {}
  empowerMixedStrikes(): void { this.settings.mixedDamageMultiplier = 1.10; }
  extendShadow(): void { this.settings.shadowDuration = 4; }
  guardSpirit(): void { this.settings.extraControlResistance = 0.10; }
  extendSeize(): void { this.settings.seizeDuration = 3; }
  quietNail(): void { this.settings.pinMpCost = 45; }
  brightenSoulFire(): void { this.settings.soulFireBonus = 0.35; }
  deepenSevering(): void { this.settings.severHighLayerBonus = 0.70; }
  enableFirstShadowLayer(): void { this.settings.firstShadowExtraLayer = true; }
  deepenHeartReflection(): void { this.settings.heartSoulFireGain = 2; }
  enableFourGatesSlow(): void { this.settings.pinHighLayerSlow = true; }
  enableMeasuredPunishment(): void { this.settings.lostResistPenalty = true; }
  enforceIronLaw(): void { this.settings.pinControlHitBonus = 0.15; }
  enableFiveSoulsPenalty(): void { this.settings.lostAfterPenalty = true; }
  enableReturningBarrier(): void { this.settings.heartShield = true; }
  enableOneNameJudgment(): void { this.settings.oneNameOneJudgment = true; }
  strengthenVerdict(): void { this.settings.finishBaseCoefficient = 0.85; }
  severSevenInches(): void { this.settings.finishPerLayerCoefficient = 0.25; }
  enableNameInYoudu(): void { this.settings.nameInYoudu = true; }
}

