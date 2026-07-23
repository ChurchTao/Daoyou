export interface WuxiangBuildSettings {
  buddhistCostBonus: number;
  buddhistShieldRatio: number;
  mirrorGuestExtraKarma: boolean;
  mirrorReflectPerLayer: number;
  mirrorVowReduction: number;
  mirrorTideReduction: number;
  mirrorDoorLayers: number;
  mirrorObserveReduction: number;
  mirrorSkandhasKarmaLayers: number;
  mirrorReedReduction: number;
  mirrorDemonReduction: number;
  mirrorFreePresent: boolean;
  mirrorFormlessKarmaLayers: number;
  mirrorFormlessCostBonus: number;
  mirrorFullReflectBonus: number;
  mirrorPresentAttackBonus: number;
  mirrorPresentShieldBonus: number;
  mirrorPresentHealRatio: number;
  mirrorFullDamageReduction: number;
  mirrorSecondPresent: boolean;
  mirrorFormlessWarRefund: number;
  demonThresholdShield: boolean;
  demonTideShieldRatio: number;
  demonHeartGapBonus: number;
  demonTideDamageBonus: number;
  demonThirdHitThreshold: number;
  demonObserveReduction: number;
  demonCleanseCount: number;
  demonReedReduction: number;
  demonFirstThought: boolean;
  demonSecondShore: boolean;
  demonEntryShieldRatio: number;
  demonControlThreshold: boolean;
  demonLowHpHealThreshold: boolean;
  demonExitShieldRatio: number;
  demonOneFurnace: boolean;
  demonLifestealCap: number;
  demonHasPublicReduction: boolean;
  demonLookBack: boolean;
}

export const MIRROR_BUILD_FACADE = Symbol('wuxiang-mirror-build');
export const DEMON_BUILD_FACADE = Symbol('wuxiang-demon-build');

export function createWuxiangBuildSettings(): WuxiangBuildSettings {
  return {
    buddhistCostBonus: 0,
    buddhistShieldRatio: 0,
    mirrorGuestExtraKarma: false,
    mirrorReflectPerLayer: 0.03,
    mirrorVowReduction: 0.10,
    mirrorTideReduction: 0.15,
    mirrorDoorLayers: 3,
    mirrorObserveReduction: 0.35,
    mirrorSkandhasKarmaLayers: 1,
    mirrorReedReduction: 0.40,
    mirrorDemonReduction: 0.20,
    mirrorFreePresent: false,
    mirrorFormlessKarmaLayers: 0,
    mirrorFormlessCostBonus: 0,
    mirrorFullReflectBonus: 0,
    mirrorPresentAttackBonus: 0,
    mirrorPresentShieldBonus: 0,
    mirrorPresentHealRatio: 0,
    mirrorFullDamageReduction: 0,
    mirrorSecondPresent: false,
    mirrorFormlessWarRefund: 0,
    demonThresholdShield: false,
    demonTideShieldRatio: 0.10,
    demonHeartGapBonus: 0.15,
    demonTideDamageBonus: 0.20,
    demonThirdHitThreshold: 0.45,
    demonObserveReduction: 0.40,
    demonCleanseCount: 1,
    demonReedReduction: 0.20,
    demonFirstThought: false,
    demonSecondShore: false,
    demonEntryShieldRatio: 0,
    demonControlThreshold: false,
    demonLowHpHealThreshold: false,
    demonExitShieldRatio: 0,
    demonOneFurnace: false,
    demonLifestealCap: 0.08,
    demonHasPublicReduction: true,
    demonLookBack: false,
  };
}

abstract class WuxiangBuildFacade {
  constructor(readonly settings: WuxiangBuildSettings) {}

  strengthenBuddhistBody(): void {
    this.settings.buddhistCostBonus = 0.01;
    this.settings.buddhistShieldRatio = 0.02;
  }
}

export class MirrorBuildFacade extends WuxiangBuildFacade {
  addGuestKarma(): void { this.settings.mirrorGuestExtraKarma = true; }
  strengthenKarmaReflection(): void { this.settings.mirrorReflectPerLayer = 0.04; }
  strengthenHeartVow(): void { this.settings.mirrorVowReduction = 0.18; }
  strengthenTideGuard(): void { this.settings.mirrorTideReduction = 0.25; }
  addFourthKarmaDoor(): void { this.settings.mirrorDoorLayers = 4; }
  strengthenObserveGuard(): void { this.settings.mirrorObserveReduction = 0.50; }
  gainTwoKarmaOnDispel(): void { this.settings.mirrorSkandhasKarmaLayers = 2; }
  strengthenReedGuard(): void { this.settings.mirrorReedReduction = 0.50; }
  strengthenDemonGuard(): void { this.settings.mirrorDemonReduction = 0.30; }
  grantFreeFirstPresent(): void { this.settings.mirrorFreePresent = true; }
  strengthenFormlessKarma(): void {
    this.settings.mirrorFormlessKarmaLayers = 2;
    this.settings.mirrorFormlessCostBonus = 0.02;
  }
  addFullKarmaReflection(): void { this.settings.mirrorFullReflectBonus = 0.05; }
  strengthenPresent(): void {
    this.settings.mirrorPresentAttackBonus = 0.20;
    this.settings.mirrorPresentShieldBonus = 0.04;
  }
  healOnPaidPresent(): void { this.settings.mirrorPresentHealRatio = 0.02; }
  reduceDamageAtFullKarma(): void { this.settings.mirrorFullDamageReduction = 0.10; }
  addSecondFormlessPresent(): void { this.settings.mirrorSecondPresent = true; }
  refundWarAfterFormless(): void { this.settings.mirrorFormlessWarRefund = 2; }
}

export class DemonBuildFacade extends WuxiangBuildFacade {
  addThresholdShield(): void { this.settings.demonThresholdShield = true; }
  strengthenTideShield(): void { this.settings.demonTideShieldRatio = 0.15; }
  strengthenHeartGap(): void { this.settings.demonHeartGapBonus = 0.25; }
  strengthenTideDamage(): void { this.settings.demonTideDamageBonus = 0.30; }
  raiseThirdHitThreshold(): void { this.settings.demonThirdHitThreshold = 0.55; }
  strengthenObserveGuard(): void { this.settings.demonObserveReduction = 0.50; }
  addCleanse(): void { this.settings.demonCleanseCount = 2; }
  strengthenReedGuard(): void { this.settings.demonReedReduction = 0.30; }
  grantFirstThought(): void { this.settings.demonFirstThought = true; }
  healAfterDemonSkill(): void { this.settings.demonSecondShore = true; }
  shieldOnDemonEntry(): void { this.settings.demonEntryShieldRatio = 0.06; }
  grantLowHpControlImmunity(): void { this.settings.demonControlThreshold = true; }
  healAtCriticalHp(): void { this.settings.demonLowHpHealThreshold = true; }
  shieldOnDemonExit(): void { this.settings.demonExitShieldRatio = 0.06; }
  strengthenFormlessLayers(): void { this.settings.demonOneFurnace = true; }
  tradeGuardForLifesteal(): void {
    this.settings.demonLifestealCap = 0.12;
    this.settings.demonHasPublicReduction = false;
  }
  healAfterCrossing(): void { this.settings.demonLookBack = true; }
}
