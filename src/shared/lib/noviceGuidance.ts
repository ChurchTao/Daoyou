import { REALM_ORDER, type RealmType } from '@shared/types/constants';
import type { Consumable, Cultivator } from '@shared/types/cultivator';

export const TUTORIAL_TASK_ORDER = [
  'tutorial_starter_supply',
  'tutorial_first_alchemy',
  'tutorial_first_dungeon',
] as const;

export const NOVICE_GUARD_ARTIFACT_NAME = '入门护身玉佩';
export const NOVICE_EQUIPMENT = [
  { slot: 'weapon', name: '入门青竹剑' },
  { slot: 'armor', name: '入门护身布甲' },
  { slot: 'accessory', name: NOVICE_GUARD_ARTIFACT_NAME },
] as const;
export const NOVICE_DUNGEON_RESOURCE_THRESHOLD = 80;

export interface NoviceReadinessResource {
  current: number;
  max: number;
}

export interface NoviceDungeonReadinessInput {
  cultivator: Cultivator;
  selectedNodeRealm?: RealmType | null;
  hp: NoviceReadinessResource;
  mp: NoviceReadinessResource;
  isFirstDungeonTutorialActive: boolean;
}

export interface NoviceDungeonReadiness {
  shouldBlock: boolean;
  reasons: string[];
  hints: string[];
  hpPercent: number;
  mpPercent: number;
  hasNoviceGuardArtifact: boolean;
  hasEquippedNoviceGuard: boolean;
  missingNoviceEquipmentNames: string[];
  unequippedNoviceEquipmentNames: string[];
  hasFullNoviceEquipment: boolean;
  hasEquippedFullNoviceEquipment: boolean;
  hasRecoveryPill: boolean;
}

function toPercent(resource: NoviceReadinessResource): number {
  const max = Math.max(1, Math.floor(resource.max));
  const current = Math.max(0, Math.min(max, Math.floor(resource.current)));
  return Math.floor((current / max) * 100);
}

function isRecoveryPill(consumable: Consumable): boolean {
  if (consumable.quantity <= 0 || consumable.spec.kind !== 'pill') {
    return false;
  }

  return consumable.spec.operations.some(
    (operation) =>
      operation.type === 'restore_resource' &&
      (operation.resource === 'hp' || operation.resource === 'mp'),
  );
}

export function hasClaimedTutorialReward(task: {
  metadata?: { rewardClaimedAt?: string };
  snapshot?: { rewardClaimedAt?: string };
}): boolean {
  return Boolean(task.snapshot?.rewardClaimedAt ?? task.metadata?.rewardClaimedAt);
}

export function getNoviceEquipmentState(cultivator: Cultivator): {
  missingNames: string[];
  unequippedNames: string[];
  hasFullSet: boolean;
  hasEquippedFullSet: boolean;
} {
  const missingNames: string[] = [];
  const unequippedNames: string[] = [];

  for (const equipment of NOVICE_EQUIPMENT) {
    const artifact = cultivator.inventory.artifacts.find(
      (candidate) => candidate.name === equipment.name,
    );

    if (!artifact?.id) {
      missingNames.push(equipment.name);
      continue;
    }

    if (cultivator.equipped[equipment.slot] !== artifact.id) {
      unequippedNames.push(equipment.name);
    }
  }

  return {
    missingNames,
    unequippedNames,
    hasFullSet: missingNames.length === 0,
    hasEquippedFullSet: missingNames.length === 0 && unequippedNames.length === 0,
  };
}

export function evaluateNoviceReadiness(
  input: NoviceDungeonReadinessInput,
): NoviceDungeonReadiness {
  const { cultivator, selectedNodeRealm, isFirstDungeonTutorialActive } = input;
  const hpPercent = toPercent(input.hp);
  const mpPercent = toPercent(input.mp);
  const noviceGuardArtifact = cultivator.inventory.artifacts.find(
    (artifact) => artifact.name === NOVICE_GUARD_ARTIFACT_NAME,
  );
  const hasNoviceGuardArtifact = Boolean(noviceGuardArtifact);
  const hasEquippedNoviceGuard = Boolean(
    noviceGuardArtifact?.id &&
      cultivator.equipped.accessory === noviceGuardArtifact.id,
  );
  const noviceEquipmentState = getNoviceEquipmentState(cultivator);
  const hasRecoveryPill = cultivator.inventory.consumables.some(isRecoveryPill);
  const reasons: string[] = [];
  const hints: string[] = [];

  if (!isFirstDungeonTutorialActive) {
    return {
      shouldBlock: false,
      reasons,
      hints,
      hpPercent,
      mpPercent,
      hasNoviceGuardArtifact,
      hasEquippedNoviceGuard,
      missingNoviceEquipmentNames: noviceEquipmentState.missingNames,
      unequippedNoviceEquipmentNames: noviceEquipmentState.unequippedNames,
      hasFullNoviceEquipment: noviceEquipmentState.hasFullSet,
      hasEquippedFullNoviceEquipment: noviceEquipmentState.hasEquippedFullSet,
      hasRecoveryPill,
    };
  }

  if (
    selectedNodeRealm &&
    REALM_ORDER[selectedNodeRealm] > REALM_ORDER[cultivator.realm]
  ) {
    reasons.push(
      `当前秘境要求${selectedNodeRealm}，高于你的${cultivator.realm}境界。`,
    );
    hints.push('先回地图选择不高于自身境界的低危秘境。');
  }

  if (hpPercent < NOVICE_DUNGEON_RESOURCE_THRESHOLD) {
    reasons.push(`气血仅 ${hpPercent}%，低于首次探秘建议值。`);
    hints.push('先去灵眼之泉调息，或服用疗伤丹后再出发。');
  }

  if (mpPercent < NOVICE_DUNGEON_RESOURCE_THRESHOLD) {
    reasons.push(`法力仅 ${mpPercent}%，低于首次探秘建议值。`);
    hints.push('先去灵眼之泉调息，或服用回元丹后再出发。');
  }

  if (!noviceEquipmentState.hasFullSet) {
    hints.push(
      `尚未找到完整入门装备：${noviceEquipmentState.missingNames.join('、')}，可回任务中心确认入门供给奖励。`,
    );
  } else if (!noviceEquipmentState.hasEquippedFullSet) {
    hints.push(
      `建议先去储物袋穿戴${noviceEquipmentState.unequippedNames.join('、')}，但也可以直接开始低危探秘。`,
    );
  }

  if (!hasRecoveryPill) {
    hints.push('若还没有恢复丹，可先在炼丹房完成第一炉疗伤丹。');
  }

  return {
    shouldBlock: reasons.length > 0,
    reasons,
    hints: [...new Set(hints)],
    hpPercent,
    mpPercent,
    hasNoviceGuardArtifact,
    hasEquippedNoviceGuard,
    missingNoviceEquipmentNames: noviceEquipmentState.missingNames,
    unequippedNoviceEquipmentNames: noviceEquipmentState.unequippedNames,
    hasFullNoviceEquipment: noviceEquipmentState.hasFullSet,
    hasEquippedFullNoviceEquipment: noviceEquipmentState.hasEquippedFullSet,
    hasRecoveryPill,
  };
}
