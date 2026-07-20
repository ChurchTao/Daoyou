import { isPillSpec } from '@shared/lib/consumables';
import type { ConsumableSpec } from '@shared/types/consumable';
import { QUALITY_ORDER, type Quality } from '@shared/types/constants';
import type { RealmStage, RealmType } from '@shared/types/constants';
import {
  StandardSectRules,
  type CultivatorSectState,
  type SectAbilitySlots,
  type SectDefinition,
} from '../domain';
import {
  assertMethodTrainingTarget,
  isAbilityUnlocked,
  validateMeridianNodeIds,
} from '../progression/progression';
import { createAbilitySlots } from '../presentation/abilityLoadout';
import {
  realmMeetsSectRank,
  type SectRankRequirement,
} from '../domain/organization';

export interface PromotionCandidateFacts {
  realm: RealmType;
  stage: RealmStage;
  contribution: number;
  dailyCompletions: number;
  completedTaskTags: ReadonlySet<string>;
}

export class PromotionRequirementSpecification {
  violations(
    candidate: PromotionCandidateFacts,
    requirement: SectRankRequirement,
  ): Array<{ code: string; message: string }> {
    const violations: Array<{ code: string; message: string }> = [];
    if (!realmMeetsSectRank(candidate.realm, candidate.stage, requirement.minRealm))
      violations.push({ code: 'realm', message: `境界达到${requirement.minRealm}` });
    if (candidate.contribution < requirement.contribution)
      violations.push({
        code: 'contribution',
        message: `当前贡献达到${requirement.contribution}`,
      });
    if (
      requirement.dailyCompletions &&
      candidate.dailyCompletions < requirement.dailyCompletions
    )
      violations.push({
        code: 'daily_completions',
        message: `完成宗门日常 ${candidate.dailyCompletions}/${requirement.dailyCompletions}`,
      });
    for (const required of requirement.requiredTaskTags ?? [])
      if (!candidate.completedTaskTags.has(required.tag))
        violations.push({ code: `task:${required.tag}`, message: required.label });
    return violations;
  }
}

export interface ItemDeliveryRequirement {
  quantity: number;
  minQuality: Quality;
  pillFamily?: string;
}

export interface DeliverySpecification<TCandidate> {
  violations(candidate: TCandidate, requirement: ItemDeliveryRequirement): string[];
}

export class PillDeliverySpecification
  implements DeliverySpecification<{ quality: string; quantity: number; spec: unknown }>
{
  violations(
    candidate: { quality: string; quantity: number; spec: unknown },
    requirement: ItemDeliveryRequirement,
  ): string[] {
    const violations: string[] = [];
    if (!isPillSpec(candidate.spec as ConsumableSpec)) violations.push('所选物品不是有效丹药');
    if ((QUALITY_ORDER[candidate.quality as Quality] ?? -1) < QUALITY_ORDER[requirement.minQuality])
      violations.push('丹药品质不足');
    if (candidate.quantity < requirement.quantity) violations.push('丹药数量不足');
    if (
      requirement.pillFamily &&
      isPillSpec(candidate.spec as ConsumableSpec) &&
      (candidate.spec as ConsumableSpec & { family?: string }).family !== requirement.pillFamily
    )
      violations.push('丹药类型不符合委托要求');
    return violations;
  }
}

export class ArtifactDeliverySpecification
  implements DeliverySpecification<{ quality: string; isEquipped: boolean }>
{
  violations(
    candidate: { quality: string; isEquipped: boolean },
    requirement: ItemDeliveryRequirement,
  ): string[] {
    const violations: string[] = [];
    if (candidate.isEquipped) violations.push('已装备法宝不能提交');
    if ((QUALITY_ORDER[candidate.quality as Quality] ?? -1) < QUALITY_ORDER[requirement.minQuality])
      violations.push('法宝品阶不足');
    if (requirement.quantity !== 1) violations.push('每次只能提交一件法宝');
    return violations;
  }
}

export class MaterialDeliverySpecification
  implements DeliverySpecification<{ rank: string; quantity: number }>
{
  violations(
    candidate: { rank: string; quantity: number },
    requirement: ItemDeliveryRequirement,
  ): string[] {
    const violations: string[] = [];
    if ((QUALITY_ORDER[candidate.rank as Quality] ?? -1) < QUALITY_ORDER[requirement.minQuality])
      violations.push('材料品质不足');
    if (candidate.quantity < requirement.quantity) violations.push('材料数量不足');
    return violations;
  }
}

export class MethodTrainingSpecification {
  assert(
    candidate: Parameters<typeof assertMethodTrainingTarget>[0],
  ): void {
    assertMethodTrainingTarget(candidate);
  }
}

export class MeridianLoadoutSpecification {
  validate(
    candidate: Parameters<typeof validateMeridianNodeIds>[0],
  ): string[] {
    return validateMeridianNodeIds(candidate);
  }
}

export class AbilityLoadoutSpecification {
  validate(
    definition: SectDefinition,
    sect: CultivatorSectState,
    rawSlots: Array<string | null>,
  ): SectAbilitySlots {
    if (rawSlots.length !== StandardSectRules.activeAbilitySlotCount)
      throw new Error('神通栏必须包含四个固定槽位');
    const slots = createAbilitySlots(rawSlots as SectAbilitySlots);
    const ids = slots.filter((id): id is string => id !== null);
    if (new Set(ids).size !== ids.length)
      throw new Error('神通栏不能包含重复神通');
    if (
      ids.some((id) => {
        const ability = definition.abilities.find((entry) => entry.id === id);
        return (
          ability?.kind !== 'active' ||
          !isAbilityUnlocked(definition, id, sect)
        );
      })
    )
      throw new Error('神通栏包含未解锁或非宗门神通');
    return slots;
  }
}
