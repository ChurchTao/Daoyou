import { getRealmStageRank } from '@shared/config/realmProgression';
import { REALM_ORDER, type RealmStage, type RealmType } from '@shared/types/constants';
import { LINGXIAO_ABILITY_BY_ID, LINGXIAO_METHOD_BY_ID } from './lingxiao';
import { getMinimumRealmStageForMethodLevel, isAbilityUnlocked } from './progression';
import type {
  CultivatorSectState,
  LingxiaoAbilityId,
  LingxiaoMethodId,
  SectAbilityEffectDefinition,
  SectAbilityRole,
  SectAbilitySlots,
  SectMethodMilestoneDefinition,
} from './types';

export type MethodMilestoneStatus = 'unlocked' | 'next' | 'locked';

export interface ResolvedMethodMilestone extends SectMethodMilestoneDefinition {
  status: MethodMilestoneStatus;
  missingRequirements: string[];
}

const METHOD_MILESTONE_REALM_FALLBACK: [RealmType, RealmStage] = ['炼气', '初期'];

function meetsRealm(
  realm: RealmType,
  stage: RealmStage,
  minRealm?: RealmType,
  minStage?: RealmStage,
) {
  if (!minRealm || !minStage) return true;
  return getRealmStageRank(realm, stage) >= getRealmStageRank(minRealm, minStage);
}

export function resolveMethodMilestones(args: {
  methodId: LingxiaoMethodId;
  sect: CultivatorSectState;
  realm?: RealmType;
  stage?: RealmStage;
}): ResolvedMethodMilestone[] {
  const method = LINGXIAO_METHOD_BY_ID.get(args.methodId);
  if (!method) return [];
  const currentLevel = args.sect.methods[args.methodId] ?? 0;
  const realm = args.realm ?? METHOD_MILESTONE_REALM_FALLBACK[0];
  const stage = args.stage ?? METHOD_MILESTONE_REALM_FALLBACK[1];
  const firstUnreachedIndex = method.milestones.findIndex((node) => currentLevel < node.level);

  return method.milestones.map((node, index) => {
    const missingRequirements: string[] = [];
    if (currentLevel < node.level) missingRequirements.push(`${method.name}${node.level}级`);
    if (!meetsRealm(realm, stage, node.minRealm, node.minRealmStage)) {
      missingRequirements.push(`${node.minRealm}${node.minRealmStage}`);
    }
    if (node.requiredPathId && args.sect.pathId !== node.requiredPathId) {
      missingRequirements.push('选择快剑道');
    }
    for (const [methodId, level] of Object.entries(node.requiredMethods ?? {})) {
      if ((args.sect.methods[methodId as LingxiaoMethodId] ?? 0) < (level ?? 0)) {
        missingRequirements.push(`${LINGXIAO_METHOD_BY_ID.get(methodId as LingxiaoMethodId)?.name ?? methodId}${level}级`);
      }
    }

    return {
      ...node,
      missingRequirements,
      status: missingRequirements.length === 0
        ? 'unlocked'
        : index === firstUnreachedIndex
          ? 'next'
          : 'locked',
    };
  });
}

export const SWIFT_MERIDIAN_STAGES = [
  { layer: 1 as const, label: '第一层', realm: '筑基' as const, stage: '初期' as const },
  { layer: 2 as const, label: '第二层', realm: '筑基' as const, stage: '圆满' as const },
  { layer: 3 as const, label: '第三层', realm: '金丹' as const, stage: '圆满' as const },
  { layer: 4 as const, label: '第四层', realm: '元婴' as const, stage: '圆满' as const },
  { layer: 5 as const, label: '第五层', realm: '化神' as const, stage: '中期' as const },
  { layer: 'ultimate' as const, label: '终式', realm: '化神' as const, stage: '圆满' as const },
];

export function getSwiftMeridianProgress(args: {
  realm: RealmType;
  stage: RealmStage;
  methods: CultivatorSectState['methods'];
}) {
  const currentRank = getRealmStageRank(args.realm, args.stage);
  const realmOpenStages = SWIFT_MERIDIAN_STAGES.filter(
    (item) => currentRank >= getRealmStageRank(item.realm, item.stage),
  );
  const ordinaryOpenLayers = realmOpenStages
    .filter((item): item is (typeof SWIFT_MERIDIAN_STAGES)[number] & { layer: 1 | 2 | 3 | 4 | 5 } => item.layer !== 'ultimate')
    .map((item) => item.layer);
  const ultimateRealmMet = currentRank >= getRealmStageRank('化神', '圆满');
  const ultimateMissingMethods = (['lingxiao-canon', 'swift-sword-canon'] as const)
    .filter((methodId) => (args.methods[methodId] ?? 0) < 100);
  const nextStage = SWIFT_MERIDIAN_STAGES.find(
    (item) => currentRank < getRealmStageRank(item.realm, item.stage),
  );

  return {
    ordinaryOpenLayers,
    highestOpenLayer: ordinaryOpenLayers[ordinaryOpenLayers.length - 1] ?? null,
    nextStage: nextStage ?? null,
    ultimateRealmMet,
    ultimateMissingMethods,
    ultimateAvailable: ultimateRealmMet && ultimateMissingMethods.length === 0,
  };
}

export function isSwiftMeridianLayerAvailable(
  layer: 1 | 2 | 3 | 4 | 5 | 'ultimate',
  progress: ReturnType<typeof getSwiftMeridianProgress>,
) {
  return layer === 'ultimate'
    ? progress.ultimateAvailable
    : progress.ordinaryOpenLayers.includes(layer);
}

export interface LingxiaoAbilityDetail {
  id: LingxiaoAbilityId;
  name: string;
  baseName: string;
  swiftName?: string;
  role: SectAbilityRole;
  summary: string;
  unlocked: boolean;
  unlockRequirements: string[];
  manaCost: number;
  manaWeight: number;
  cooldown: number;
  effect: SectAbilityEffectDefinition;
  totalDamageCoefficient?: number;
  notes: string[];
}

function mergeEffect(
  base: SectAbilityEffectDefinition,
  override?: SectAbilityEffectDefinition,
): SectAbilityEffectDefinition {
  return { ...base, ...(override ?? {}) };
}

export function projectLingxiaoAbilityDetail(args: {
  abilityId: LingxiaoAbilityId;
  sect: CultivatorSectState;
  realm: RealmType;
}): LingxiaoAbilityDetail {
  const definition = LINGXIAO_ABILITY_BY_ID.get(args.abilityId);
  if (!definition) throw new Error(`未知凌霄神通: ${args.abilityId}`);
  const swift = args.sect.pathId === 'swift-sword';
  const activeNodes = new Set(
    args.sect.meridianLoadouts.find((loadout) => loadout.slot === args.sect.activeMeridianSlot)?.nodeIds ?? [],
  );
  const effect = mergeEffect(definition.baseEffect, swift ? definition.swiftEffect : undefined);
  const templateMultiplier = swift
    ? 1 + (args.sect.methods['swift-sword-canon'] ?? 0) * 0.0008
    : 1;
  const notes: string[] = [];
  let cooldown = definition.cooldown;

  if (args.abilityId === 'linked-edge' && activeNodes.has('swift-split-light')) {
    effect.hits = 5;
    effect.damageCoefficient = 0.27;
    effect.momentumGain = 3;
    notes.push('分光：改为五段，总倍率1.35。');
  }
  if (args.abilityId === 'linked-edge' && activeNodes.has('swift-stacking-waves')) {
    notes.push('叠浪：完整命中后，追风式冷却减少1回合。');
  }
  if (args.abilityId === 'turning-body' && activeNodes.has('swift-returning-swallow')) {
    effect.counterCoefficient = 0.825;
    effect.swordMarkLayers = 1;
    notes.push('回燕：反击伤害提高50%，并施加1层剑痕。');
  }
  if (args.abilityId === 'turning-body' && activeNodes.has('swift-unending-wind')) {
    effect.swordMarkLayers = 1;
    effect.shieldCoefficient = 0.4;
    notes.push('回风不息：反击附加剑痕与护盾。');
  }
  if (args.abilityId === 'breaking-edge') {
    const sheathing = activeNodes.has('swift-sheathing');
    effect.damageCoefficient = sheathing ? 0.8 : 1;
    effect.momentumDamageCoefficient = sheathing ? 0.2 : 0.25;
    effect.swordMarkDamageCoefficient = activeNodes.has('swift-mountain-breaking') ? 0.18 : 0.1;
    if (activeNodes.has('swift-shadow-line')) {
      effect.damageCoefficient = 2.5;
      effect.momentumDamageCoefficient = undefined;
      effect.momentumRequired = 6;
      effect.forcedCritical = true;
      cooldown += 1;
      notes.push('绝影一线：满6剑势单次强击并强制暴击。');
    } else {
      notes.push(`每点已消耗剑势追加${sheathing ? '0.20' : '0.25'}物攻倍率。`);
    }
    if (activeNodes.has('swift-mountain-breaking')) notes.push('破岳一线：剑痕附伤提高且无视防御。');
    if (activeNodes.has('swift-life-chasing')) {
      effect.lowHpBonusCoefficient = activeNodes.has('swift-shadow-line') ? 0.75 : 0.3;
      notes.push('追命一线：目标低于25%气血时伤害提高。');
    }
    if (sheathing) notes.push('归鞘一线：返还1剑势并获得0.5物攻护盾。');
    if (activeNodes.has('swift-still-tide')) {
      effect.damageCoefficient *= 1.2;
      notes.push('静潮：满足蓄势条件时收束伤害提高20%。');
    }
  }

  const unlockRequirements = [`${LINGXIAO_METHOD_BY_ID.get(definition.unlock.methodId)?.name}${definition.unlock.level}级`];
  const minimumRealm = getMinimumRealmStageForMethodLevel(definition.unlock.level);
  unlockRequirements.push(`${minimumRealm.realm}${minimumRealm.stage}`);
  if (definition.unlock.primaryMethodLevel) unlockRequirements.push(`《凌霄剑典》${definition.unlock.primaryMethodLevel}级`);
  if (definition.unlock.pathId) unlockRequirements.push('选择快剑道');
  const baseMana = 8 + 4 * REALM_ORDER[args.realm];
  const scaledCoefficient = effect.damageCoefficient === undefined
    ? undefined
    : effect.damageCoefficient * templateMultiplier;
  if (scaledCoefficient !== undefined) effect.damageCoefficient = scaledCoefficient;
  if (effect.counterCoefficient !== undefined) effect.counterCoefficient *= templateMultiplier;
  if (effect.momentumDamageCoefficient !== undefined) effect.momentumDamageCoefficient *= templateMultiplier;
  if (effect.lowHpBonusCoefficient !== undefined) effect.lowHpBonusCoefficient *= templateMultiplier;

  return {
    id: definition.id,
    name: swift ? definition.swiftName ?? definition.baseName : definition.baseName,
    baseName: definition.baseName,
    swiftName: definition.swiftName,
    role: definition.role,
    summary: definition.description,
    unlocked: isAbilityUnlocked(definition.id, args.sect),
    unlockRequirements,
    manaCost: Math.round(baseMana * definition.manaWeight),
    manaWeight: definition.manaWeight,
    cooldown,
    effect,
    totalDamageCoefficient: effect.damageCoefficient === undefined
      ? undefined
      : effect.damageCoefficient * (effect.hits ?? 1),
    notes,
  };
}

export function createAbilitySlots(
  loadout: readonly (LingxiaoAbilityId | null)[],
): SectAbilitySlots {
  return Array.from({ length: 4 }, (_, index) => loadout[index] ?? null) as SectAbilitySlots;
}

export function assignAbilityToSlot(
  slots: SectAbilitySlots,
  selectedSlot: number,
  abilityId: LingxiaoAbilityId,
): SectAbilitySlots {
  const next = createAbilitySlots(slots);
  const existingIndex = next.indexOf(abilityId);
  if (existingIndex >= 0 && existingIndex !== selectedSlot) {
    [next[existingIndex], next[selectedSlot]] = [next[selectedSlot] ?? null, abilityId];
  } else {
    next[selectedSlot] = abilityId;
  }
  return next as SectAbilitySlots;
}

export function clearAbilitySlot(slots: SectAbilitySlots, selectedSlot: number): SectAbilitySlots {
  const next = createAbilitySlots(slots);
  next[selectedSlot] = null;
  return next;
}

export function fillFirstEmptyAbilitySlots(
  slots: SectAbilitySlots,
  unlockedAbilityIds: LingxiaoAbilityId[],
): SectAbilitySlots {
  const next = createAbilitySlots(slots);
  for (const abilityId of unlockedAbilityIds) {
    if (next.includes(abilityId)) continue;
    const emptySlot = next.indexOf(null);
    if (emptySlot < 0) break;
    next[emptySlot] = abilityId;
  }
  return next;
}

export function validateAbilitySlots(args: {
  slots: SectAbilitySlots;
  unlockedActiveAbilityIds: LingxiaoAbilityId[];
}) {
  const abilityIds = args.slots.filter((ability): ability is LingxiaoAbilityId => ability !== null);
  if (new Set(abilityIds).size !== abilityIds.length) {
    return { valid: false as const, reason: '同一神通不能重复装配。', abilityIds };
  }
  if (abilityIds.some((abilityId) => !args.unlockedActiveAbilityIds.includes(abilityId))) {
    return { valid: false as const, reason: '配置中包含尚未解锁的神通。', abilityIds };
  }
  return { valid: true as const, reason: undefined, abilityIds };
}
