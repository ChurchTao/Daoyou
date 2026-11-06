import { z } from 'zod';
import { ATTR_NAMES } from '@daoyou/combat-core/constants';
import { DamageKind, DamageOrigin, EffectType, HookAim, HookName, SkillTag, StatusCategory, StatusFlag, StatusHit, TargetMode, TargetSide, UnitKind } from '@daoyou/combat-core/enums';
import type { SkillEffect } from '@daoyou/combat-core/types';

export const xyId = z.string().regex(/^xiaoyue\.[a-z][a-z0-9_.]*$/);
export const xyExpr = z.union([z.number().finite(), z.string().min(1).max(2000)]);
const ref = z.string().min(1);
export const xyTargeting = z.strictObject({
  side: z.enum(TargetSide), mode: z.enum(TargetMode).optional(), count: xyExpr.optional(),
  maxSelected: z.number().int().positive().optional(), requireKind: z.enum(UnitKind).optional(),
  requireKinds: z.array(z.enum(UnitKind)).optional(), requireOwnedPet: z.boolean().optional(),
  includeDowned: z.boolean().optional(), onlyDowned: z.boolean().optional(),
});
export const xyWhen = z.strictObject({
  expression: xyExpr.optional(), skillIds: z.array(ref).optional(), requireKind: z.enum(DamageKind).optional(),
  damageOrigins: z.array(z.enum(DamageOrigin)).optional(), foeKind: z.enum(UnitKind).optional(),
  sourceKind: z.enum(UnitKind).optional(), sourceStanding: z.boolean().optional(),
  retaliationDamage: z.boolean().optional(),
  rootActionOnly: z.boolean().optional(), excludeSpellRepeat: z.boolean().optional(),
  sourceHasStandingPet: z.boolean().optional(), sourceOwnedPetStatusKinds: z.array(ref).optional(),
  targetOwnerStatusKinds: z.array(ref).optional(), targetStatusFromSourceOwnerKinds: z.array(ref).optional(),
  targetHasSeal: z.boolean().optional(), targetEnemy: z.boolean().optional(),
  targetOwnedStatus: z.strictObject({ kind: ref, appliedThisRound: z.boolean().optional() }).optional(),
  targetAbsentStatusKinds: z.array(ref).optional(), targetSlot: z.enum(['primary', 'secondary', 'all', 'normal']).optional(),
  sourceHpRatioBelow: z.number().min(0).max(1).optional(), requireStatusKinds: z.array(ref).optional(),
  oncePerBattle: z.boolean().optional(), oncePerRound: z.boolean().optional(), oncePerRoundTarget: z.boolean().optional(),
  oncePerActionTarget: z.boolean().optional(), pvp: z.boolean().optional(), teamUniqueTag: ref.optional(),
  petEntryKind: z.enum(['initial', 'switch']).optional(), actionSucceeded: z.boolean().optional(),
  statusRemoveReason: ref.optional(), removedStatusKind: ref.optional(), statusRemovedByAlly: z.boolean().optional(),
  removedStatusWasSeal: z.boolean().optional(),
  removedStatusFlags: z.array(z.enum(StatusFlag)).optional(), resolvedStatusKinds: z.array(ref).optional(),
  statusResults: z.array(z.enum(['applied', 'miss', 'immune', 'rejected', 'intercepted'])).optional(),
  excludeFoeKinds: z.array(z.enum(UnitKind)).optional(),
});
export const xyModifier = z.strictObject({
  when: xyWhen.optional(), teamAura: ref.optional(), ownedPetAura: z.boolean().optional(),
  damageBonus: xyExpr.optional(), damageResultFactor: xyExpr.optional(), allDamageTakenBonus: xyExpr.optional(),
  physicalAttackAdd: xyExpr.optional(), physicalDefenseAdd: xyExpr.optional(), magicDefenseAdd: xyExpr.optional(),
  hitAdd: xyExpr.optional(), critChanceAdd: xyExpr.optional(),
  targetCountAdd: xyExpr.optional(), recoverySkipChance: xyExpr.optional(), sealChanceAdd: xyExpr.optional(),
  sealChanceCeilTakenAdd: xyExpr.optional(), ignoreProtection: z.boolean().optional(),
  statusDurationAdd: z.strictObject({ statusId: xyId, amount: xyExpr }).optional(),
  deferFatalRetaliation: z.boolean().optional(),
});
const common = { when: xyWhen.optional(), targeting: xyTargeting.optional() };
export const xyEffect: z.ZodType<SkillEffect> = z.lazy(() => z.discriminatedUnion('type', [
  z.strictObject({ ...common, type: z.literal(EffectType.PhysicalHit), hits: xyExpr.optional(), coeff: z.union([z.number(), z.array(z.number())]).optional() }),
  z.strictObject({ ...common, type: z.literal(EffectType.ApplyStatus), statusId: xyId, duration: xyExpr, self: z.boolean().optional(), hit: z.enum(StatusHit).optional() }),
  z.strictObject({ ...common, type: z.literal(EffectType.RemoveStatus), statusIds: z.array(xyId), ownedOnly: z.boolean().optional() }),
  z.strictObject({ ...common, type: z.literal(EffectType.SkipNextAction) }),
  z.strictObject({ ...common, type: z.literal(EffectType.ModifyFact), key: z.string().regex(/^xiaoyue_[a-z0-9_]+$/), value: xyExpr }),
  z.strictObject({ ...common, type: z.literal(EffectType.ModifyStatusDuration), kinds: z.array(xyId), amount: xyExpr }),
  z.strictObject({ ...common, type: z.literal(EffectType.RandomBranch), branchId: ref, chance: xyExpr, successEffects: z.array(xyEffect), failureEffects: z.array(xyEffect) }),
  z.strictObject({ ...common, type: z.literal(EffectType.RestoreHp), power: xyExpr, allowFatal: z.boolean().optional(), maxGainPerRound: xyExpr.optional() }),
  z.strictObject({ ...common, type: z.literal(EffectType.RestoreMp), power: xyExpr }),
  z.strictObject({ ...common, type: z.literal(EffectType.Revive), hpRatio: xyExpr, ownedPetHpCostRatio: xyExpr }),
  z.strictObject({ ...common, type: z.literal(EffectType.ApplyBarrier), id: xyId, kind: ref, name: ref, power: xyExpr, duration: xyExpr, maxPower: xyExpr.optional() }),
  z.strictObject({ ...common, type: z.literal(EffectType.ModifyStrike), factor: xyExpr.optional(), finalAdd: xyExpr.optional() }),
  z.strictObject({ ...common, type: z.literal(EffectType.LoseHp), power: xyExpr }),
  z.strictObject({ ...common, type: z.literal(EffectType.EmitMechanic), mechanicId: xyId, name: ref }),
])) as z.ZodType<SkillEffect>;
export const xyHook = z.strictObject({
  on: z.enum(HookName), effects: z.array(xyEffect).min(1),
  sourceIsSelf: z.boolean().optional(), sourceIsOwnedPet: z.boolean().optional(), sourceIsEnemy: z.boolean().optional(),
  targetIsSelf: z.boolean().optional(), targetIsOwnedPet: z.boolean().optional(),
  effectSource: z.literal('eventSource').optional(), aim: z.enum(HookAim).optional(),
  chance: xyExpr.optional(), requireKind: z.enum(DamageKind).optional(), retaliation: z.boolean().optional(),
  limitConsumption: z.enum(['onSuccess', 'onAttempt']).optional(), when: xyWhen.optional(),
});
export const xyStatus = z.strictObject({
  id: xyId, kind: xyId, name: ref, school: z.literal('xiaoyue'), category: z.enum(StatusCategory),
  description: ref, dispellable: z.boolean().optional(), sourceBound: z.boolean().optional(),
  maxStacks: z.number().int().positive().optional(), isSeal: z.boolean().optional(), blocksAction: z.boolean().optional(),
  blockedSkillSchools: z.array(z.literal('xiaoyue')).optional(), expireSameRound: z.boolean().optional(),
  onExpire: z.strictObject({ statusId: xyId, duration: z.number().int().positive() }).optional(),
  attrMods: z.partialRecord(z.enum(ATTR_NAMES), xyExpr).optional(), modifiers: z.array(xyModifier).optional(),
  persistWhenBenched: z.boolean().optional(), persistWhenDowned: z.boolean().optional(), untilBattleEnd: z.boolean().optional(),
});
export const xyTags = z.array(z.enum(SkillTag)).min(1);
