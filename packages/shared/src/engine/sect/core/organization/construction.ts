export const SECT_CONSTRUCTION_DONATION_OPTIONS = [
  { spiritStones: 10_000, constructionPoints: 1, contribution: 1 },
  { spiritStones: 50_000, constructionPoints: 5, contribution: 3 },
  { spiritStones: 100_000, constructionPoints: 10, contribution: 5 },
  { spiritStones: 200_000, constructionPoints: 20, contribution: 10 },
  { spiritStones: 400_000, constructionPoints: 40, contribution: 20 },
] as const;

export type SectConstructionDonationAmount =
  (typeof SECT_CONSTRUCTION_DONATION_OPTIONS)[number]['spiritStones'];

export interface SectConstructionDonationOption {
  spiritStones: SectConstructionDonationAmount;
  constructionPoints: number;
  contribution: number;
}

export const SECT_FACILITY_UPGRADE_TARGETS = {
  2: 250,
  3: 500,
  4: 900,
  5: 1_500,
} as const;

export function quoteSectConstructionDonation(
  spiritStones: number,
): SectConstructionDonationOption {
  const option = SECT_CONSTRUCTION_DONATION_OPTIONS.find(
    (candidate) => candidate.spiritStones === spiritStones,
  );
  if (!option) throw new Error('建设灵石档位无效');
  return option;
}

export function getSectFacilityUpgradeTarget(
  currentLevel: number,
  maxLevel = 5,
): number | null {
  if (!Number.isSafeInteger(currentLevel) || currentLevel < 0)
    throw new Error('设施等级无效');
  if (currentLevel >= maxLevel) return null;
  const target =
    SECT_FACILITY_UPGRADE_TARGETS[
      (currentLevel + 1) as keyof typeof SECT_FACILITY_UPGRADE_TARGETS
    ];
  if (!target) throw new Error('设施升级目标不存在');
  return target;
}

export function applySectFacilityConstruction(input: {
  level: number;
  progress: number;
  maxLevel: number;
  upgradeable: boolean;
  constructionPoints: number;
  upgradeTarget?: (currentLevel: number) => number | null;
}): { level: number; progress: number; upgraded: boolean } {
  if (!input.upgradeable) throw new Error('该设施不可建设');
  if (
    !Number.isSafeInteger(input.progress) ||
    input.progress < 0 ||
    !Number.isSafeInteger(input.constructionPoints) ||
    input.constructionPoints <= 0
  )
    throw new Error('设施建设进度无效');
  if (input.level >= input.maxLevel) throw new Error('该设施已满级');

  let level = input.level;
  let progress = input.progress + input.constructionPoints;
  while (level < input.maxLevel) {
    const target = input.upgradeTarget
      ? input.upgradeTarget(level)
      : getSectFacilityUpgradeTarget(level, input.maxLevel);
    if (target === null || progress < target) break;
    if (!Number.isSafeInteger(target) || target <= 0)
      throw new Error('设施升级目标无效');
    progress -= target;
    level += 1;
  }
  if (level >= input.maxLevel) progress = 0;
  return { level, progress, upgraded: level > input.level };
}
