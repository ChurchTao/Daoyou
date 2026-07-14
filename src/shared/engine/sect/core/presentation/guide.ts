import { getRealmStageRank } from '@shared/config/realmProgression';
import type { RealmStage, RealmType } from '@shared/types/constants';
import type {
  CultivatorSectState,
  SectAbilityId,
  SectAbilitySlots,
  SectDefinition,
  SectHeartMethodDefinition,
  SectMethodMilestoneDefinition,
} from '../domain';

export type MethodMilestoneStatus = 'unlocked' | 'next' | 'locked';

export interface ResolvedMethodMilestone extends SectMethodMilestoneDefinition {
  status: MethodMilestoneStatus;
  missingRequirements: string[];
}

export function resolveMethodMilestones(args: {
  definition: SectDefinition;
  methodId: string;
  sect: CultivatorSectState;
  realm: RealmType;
  stage: RealmStage;
}): ResolvedMethodMilestone[] {
  const method = args.definition.methods.find(
    (entry) => entry.id === args.methodId,
  );
  if (!method) return [];
  const level = args.sect.methods[method.id] ?? 0;
  const firstUnreached = method.milestones.findIndex(
    (entry) => level < entry.level,
  );
  return method.milestones.map((milestone, index) => {
    const missingRequirements: string[] = [];
    if (level < milestone.level)
      missingRequirements.push(`${method.name}${milestone.level}级`);
    if (
      milestone.minRealm &&
      milestone.minRealmStage &&
      getRealmStageRank(args.realm, args.stage) <
        getRealmStageRank(milestone.minRealm, milestone.minRealmStage)
    ) {
      missingRequirements.push(
        `${milestone.minRealm}${milestone.minRealmStage}`,
      );
    }
    for (const [methodId, requiredLevel] of Object.entries(
      milestone.requiredMethods ?? {},
    )) {
      if ((args.sect.methods[methodId] ?? 0) < requiredLevel) {
        missingRequirements.push(
          `${args.definition.methods.find((entry) => entry.id === methodId)?.name ?? methodId}${requiredLevel}级`,
        );
      }
    }
    return {
      ...milestone,
      missingRequirements,
      status:
        missingRequirements.length === 0
          ? 'unlocked'
          : index === firstUnreached
            ? 'next'
            : 'locked',
    };
  });
}

export function describeMethodBenefit(
  method: SectHeartMethodDefinition,
  level: number,
): string {
  if (!method.modifierPerLevel)
    return method.perLevelDescription ?? '统摄宗门传承';
  const value = method.modifierPerLevel.value * level * 100;
  const labels: Record<string, string> = {
    atk: '物理攻击',
    speed: '身法',
    accuracy: '命中',
    maxHp: '气血上限',
    maxMp: '法力上限',
  };
  const label = labels[method.modifierPerLevel.attrType] ?? '属性';
  return `${label}提高${value.toFixed(2).replace(/\.00$/, '')}${method.modifierPerLevel.type === 'fixed' ? '个百分点' : '%'}`;
}

export function createAbilitySlots(
  loadout: readonly (SectAbilityId | null)[],
): SectAbilitySlots {
  return Array.from(
    { length: 4 },
    (_, index) => loadout[index] ?? null,
  ) as SectAbilitySlots;
}

export function assignAbilityToSlot(
  slots: SectAbilitySlots,
  selectedSlot: number,
  abilityId: SectAbilityId,
): SectAbilitySlots {
  const next = createAbilitySlots(slots);
  const existingIndex = next.indexOf(abilityId);
  if (existingIndex >= 0 && existingIndex !== selectedSlot) {
    [next[existingIndex], next[selectedSlot]] = [
      next[selectedSlot] ?? null,
      abilityId,
    ];
  } else next[selectedSlot] = abilityId;
  return next;
}

export function clearAbilitySlot(
  slots: SectAbilitySlots,
  selectedSlot: number,
): SectAbilitySlots {
  const next = createAbilitySlots(slots);
  next[selectedSlot] = null;
  return next;
}

export function fillFirstEmptyAbilitySlots(
  slots: SectAbilitySlots,
  unlockedAbilityIds: SectAbilityId[],
): SectAbilitySlots {
  const next = createAbilitySlots(slots);
  for (const abilityId of unlockedAbilityIds) {
    if (next.includes(abilityId)) continue;
    const empty = next.indexOf(null);
    if (empty < 0) break;
    next[empty] = abilityId;
  }
  return next;
}

export function validateAbilitySlots(args: {
  slots: SectAbilitySlots;
  unlockedActiveAbilityIds: SectAbilityId[];
}) {
  const abilityIds = args.slots.filter(
    (ability): ability is string => ability !== null,
  );
  if (new Set(abilityIds).size !== abilityIds.length)
    return {
      valid: false as const,
      reason: '同一神通不能重复装配。',
      abilityIds,
    };
  if (abilityIds.some((id) => !args.unlockedActiveAbilityIds.includes(id)))
    return {
      valid: false as const,
      reason: '配置中包含尚未解锁的神通。',
      abilityIds,
    };
  return { valid: true as const, reason: undefined, abilityIds };
}
