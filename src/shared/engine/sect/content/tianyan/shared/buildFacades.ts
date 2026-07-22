import type { SectPathId } from '../../../core';

export interface TianyanBuildSettings {
  pathId?: SectPathId;
  initialDerivation: number;
  sealDuration: number;
  repositoryMultiplier: number;
  repositoryGain: number;
  shiftCost: number;
  shiftCooldown: number;
  shiftSteps: number;
  shiftGain: number;
  shiftReactionBonus: number;
  woodHealingMultiplier: number;
  woodFullHealthShield: number;
  lotusHpRatio: number;
  earthShieldMultiplier: number;
  earthReduction: number;
  riverCleanseCount: number;
  riverMpRatio: number;
  riverControlResistance: number;
  generationHealRatio: number;
  overcomingShieldRatio: number;
  threeTalents: boolean;
  blankBreath: boolean;
  reactionManaRefund: number;
  innerOuter: boolean;
  hetuMainBonus: number;
  hetuHpRatio: number;
  hetuMpRatio: number;
  hetuSealExtension: number;
  hetuRetain: boolean;
  hetuReactionValueBonus: number;
  nonLandingSlotBonus: number;
  /** 由最终主动栏推导，只在单次编译中使用，不进入存档。 */
  loadoutMultiplier: number;
  observeSealDamageBonus: number;
  firstChange: boolean;
  wildfireBonus: number;
  vaporizeRatio: number;
  meltMetalAttackReduction: number;
  lavaDotCoefficient: number;
  quagmireRatio: number;
  rootCollapseMagicDefReduction: number;
  forgeEdgeBypass: number;
  coldSpringSlow: number;
  severMeridianRatio: number;
  controlHitBonus: number;
  quagmireResistSlow: number;
  severResistMagicAttackReduction: number;
  exploitWeaknessBonus: number;
  dispelOnOvercoming: boolean;
  chainControl: boolean;
  shatterSeal: boolean;
  saveError: boolean;
  luoshuFollowUpRatio: number;
  luoshuDebuffBonus: number;
  luoshuRetain: boolean;
  heavenEnds: boolean;
}

export const HETU_BUILD_FACADE = Symbol('tianyan-hetu-build');
export const LUOSHU_BUILD_FACADE = Symbol('tianyan-luoshu-build');

export function createTianyanBuildSettings(
  pathId?: SectPathId,
): TianyanBuildSettings {
  return {
    pathId,
    initialDerivation: 0,
    sealDuration: 2,
    repositoryMultiplier: 1,
    repositoryGain: 0,
    shiftCost: 20,
    shiftCooldown: 2,
    shiftSteps: 1,
    shiftGain: 0,
    shiftReactionBonus: 0,
    woodHealingMultiplier: 1,
    woodFullHealthShield: 0,
    lotusHpRatio: 0.05,
    earthShieldMultiplier: 1,
    earthReduction: 0.15,
    riverCleanseCount: 2,
    riverMpRatio: 0.12,
    riverControlResistance: 0.20,
    generationHealRatio: 0,
    overcomingShieldRatio: 0,
    threeTalents: false,
    blankBreath: false,
    reactionManaRefund: 0,
    innerOuter: false,
    hetuMainBonus: 0.20,
    hetuHpRatio: 0.05,
    hetuMpRatio: 0.06,
    hetuSealExtension: 1,
    hetuRetain: false,
    hetuReactionValueBonus: 0,
    nonLandingSlotBonus: 0,
    loadoutMultiplier: 1,
    observeSealDamageBonus: 0,
    firstChange: false,
    wildfireBonus: 0.50,
    vaporizeRatio: 0.80,
    meltMetalAttackReduction: 0.30,
    lavaDotCoefficient: 0.18,
    quagmireRatio: 0.40,
    rootCollapseMagicDefReduction: 0.30,
    forgeEdgeBypass: 0.40,
    coldSpringSlow: 0.40,
    severMeridianRatio: 0.40,
    controlHitBonus: 0,
    quagmireResistSlow: 0.25,
    severResistMagicAttackReduction: 0.15,
    exploitWeaknessBonus: 0,
    dispelOnOvercoming: false,
    chainControl: false,
    shatterSeal: false,
    saveError: false,
    luoshuFollowUpRatio: 0.50,
    luoshuDebuffBonus: 0.20,
    luoshuRetain: false,
    heavenEnds: false,
  };
}

abstract class TianyanBuildFacade {
  constructor(readonly settings: TianyanBuildSettings) {}
  startWithOne(): void { this.settings.initialDerivation = 1; }
  extendSeals(): void { this.settings.sealDuration = 3; }
  empowerRepository(multiplier: number, gain = 0): void {
    this.settings.repositoryMultiplier = multiplier;
    this.settings.repositoryGain = gain;
  }
}

export class HetuBuildFacade extends TianyanBuildFacade {
  enableBlankBreath(): void { this.settings.blankBreath = true; }
  enableReactionRefund(): void { this.settings.reactionManaRefund = 0.20; }
  enableShiftFlow(): void { this.settings.shiftGain = 1; }
  strengthenWoodHealing(): void {
    this.settings.woodHealingMultiplier = 1.25;
    this.settings.woodFullHealthShield = 0.04;
  }
  strengthenFireEarthShelter(): void {
    this.settings.lotusHpRatio = 0.03;
    this.settings.earthShieldMultiplier = 1.25;
    this.settings.earthReduction = 0.20;
  }
  strengthenRiverCleansing(): void {
    this.settings.riverCleanseCount = 3;
    this.settings.riverMpRatio = 0.17;
    this.settings.riverControlResistance = 0.30;
  }
  healOnGeneration(): void { this.settings.generationHealRatio = 0.02; }
  shieldOnOvercoming(): void { this.settings.overcomingShieldRatio = 0.03; }
  enableThreeTalents(): void { this.settings.threeTalents = true; }
  openScroll(): void { this.settings.hetuMainBonus = 0.35; }
  retainNumber(): void { this.settings.hetuRetain = true; }
  enableInnerOuter(): void { this.settings.innerOuter = true; }
  drawFirstLine(): void {
    this.settings.hetuMainBonus += 0.25;
    this.settings.hetuReactionValueBonus = 0.25;
  }
  grantEndlessLife(): void {
    this.settings.hetuHpRatio += 0.07;
    this.settings.hetuMpRatio += 0.06;
    this.settings.hetuRetain = true;
  }
  returnEscapedOne(): void { this.settings.nonLandingSlotBonus = 0.08; }
}

export class LuoshuBuildFacade extends TianyanBuildFacade {
  observeSealGap(): void { this.settings.observeSealDamageBonus = 0.08; }
  enableFirstChange(): void { this.settings.firstChange = true; }
  quickenShift(): void {
    this.settings.shiftCost = 10;
    this.settings.shiftCooldown = 1;
  }
  reverseTwoPalaces(): void {
    this.settings.shiftSteps = 2;
    this.settings.shiftReactionBonus = 0.20;
  }
  strengthenFlameFlow(): void {
    this.settings.wildfireBonus = 0.60;
    this.settings.vaporizeRatio = 0.95;
    this.settings.meltMetalAttackReduction = 0.35;
  }
  strengthenMountainWood(): void {
    this.settings.lavaDotCoefficient *= 1.30;
    this.settings.quagmireRatio = 0.50;
    this.settings.rootCollapseMagicDefReduction = 0.35;
  }
  strengthenMetalWater(): void {
    this.settings.forgeEdgeBypass = 0.50;
    this.settings.coldSpringSlow = 0.50;
    this.settings.severMeridianRatio = 0.50;
  }
  lockPosition(): void {
    this.settings.controlHitBonus = 0.15;
    this.settings.quagmireResistSlow = 0.35;
    this.settings.severResistMagicAttackReduction = 0.25;
  }
  exploitWeakness(): void { this.settings.exploitWeaknessBonus = 0.15; }
  dispelTruth(): void { this.settings.dispelOnOvercoming = true; }
  enableChainControl(): void { this.settings.chainControl = true; }
  enableShatterSeal(): void { this.settings.shatterSeal = true; }
  preserveMiscalculation(): void { this.settings.saveError = true; }
  grantNineChanges(): void {
    this.settings.luoshuFollowUpRatio = 1;
    this.settings.luoshuDebuffBonus = 0.35;
  }
  guestBecomesHost(): void { this.settings.luoshuRetain = true; }
  enableHeavenEnds(): void { this.settings.heavenEnds = true; }
}
