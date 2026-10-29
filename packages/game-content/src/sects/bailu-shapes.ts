import { z } from 'zod';
import { ATTR_NAMES } from '@daoyou/combat-core/constants';
import { CommandPolicy, CommandType, DamageKind, DamageOrigin, EffectType, HookAim, HookName, SkillTag, StatusCategory, StatusHit, TargetMode, TargetSide, UnitKind } from '@daoyou/combat-core/enums';
import type { SkillEffect } from '@daoyou/combat-core/types';

export const blId = z.string().regex(/^bailu\.[a-z][a-z0-9_.]*$/);
const ref = z.string().min(1);
export const blExpr = z.union([z.number().finite(), z.string().min(1).max(2000)]);
export const blTargeting = z.strictObject({
  side: z.enum(TargetSide), mode: z.enum(TargetMode).optional(), count: blExpr.optional(),
  maxSelected: z.number().int().positive().optional(), extraCount: blExpr.optional(), extraChance: blExpr.optional(),
  secondaryOwnedStatusKind: ref.optional(), fillPriority: z.literal('delayedRevivalThenSpeed').optional(), reserveExtraCost: z.boolean().optional(),
  fillPriorityPassives: z.array(z.array(ref).min(1)).optional(),
  requireKind: z.enum(UnitKind).optional(), requireStatusKinds: z.array(ref).optional(),
  includeDowned: z.boolean().optional(), includeDead: z.boolean().optional(), onlyDowned: z.boolean().optional(),
});
export const blWhen = z.strictObject({
  expression: blExpr.optional(), skillIds: z.array(ref).optional(), skillTags: z.array(z.enum(SkillTag)).optional(),
  excludeSkillTags: z.array(z.enum(SkillTag)).optional(), requireKind: z.enum(DamageKind).optional(), damageOrigins: z.array(z.enum(DamageOrigin)).optional(),
  resolvedStatusIds: z.array(ref).optional(), resolvedStatusKinds: z.array(ref).optional(), statusResults: z.array(z.enum(['applied', 'miss', 'immune', 'rejected', 'intercepted'])).optional(), statusHit: z.enum(StatusHit).optional(),
  targetEnemy: z.boolean().optional(), targetDowned: z.boolean().optional(), targetDead: z.boolean().optional(), targetHasStandingPet: z.boolean().optional(),
  targetHasNegativeSpellResistance: z.boolean().optional(),
  sourceStanding: z.boolean().optional(), actionSucceeded: z.boolean().optional(), actionKilledTarget: z.boolean().optional(),
  targetSlot: z.enum(['primary', 'secondary', 'all', 'normal']).optional(), foeKind: z.enum(UnitKind).optional(), foeTags: z.array(ref).optional(),
  teamUniqueTag: ref.optional(), sourceHpRatioBelow: z.number().optional(), targetHpRatioBelow: z.number().optional(),
  targetStatusKinds: z.array(ref).optional(), targetAbsentStatusKinds: z.array(ref).optional(),
  targetOwnedStatus: z.strictObject({ kind: ref, appliedThisRound: z.boolean().optional() }).optional(),
  requireStatusIds: z.array(ref).optional(), requireAbsentStatusIds: z.array(ref).optional(),
  targetStatusCategories: z.array(z.enum(StatusCategory)).optional(), targetAbsentStatusCategories: z.array(z.enum(StatusCategory)).optional(),
  oncePerRound: z.boolean().optional(), oncePerBattle: z.boolean().optional(), oncePerActionTarget: z.boolean().optional(),
  rootActionOnly: z.boolean().optional(), excludeSpellRepeat: z.boolean().optional(),
});
export const blModifier = z.strictObject({
  when: blWhen.optional(), damageBonus: blExpr.optional(), damageResultFactor: blExpr.optional(),
  damageTakenBonus: blExpr.optional(), allDamageTakenBonus: blExpr.optional(),
  sealChanceAdd: blExpr.optional(), sealChanceFactor: blExpr.optional(), sealChanceCeilAdd: blExpr.optional(),
  sealHitAdd: blExpr.optional(),
  sealAlwaysHit: z.boolean().optional(), bypassNegativeSpellResistance: z.boolean().optional(),
  bypassImmunity: z.strictObject({ statusKinds: z.array(ref), passiveIds: z.array(ref) }).optional(),
  critChanceAdd: blExpr.optional(), defenseIgnoreAdd: blExpr.optional(), targetCountAdd: blExpr.optional(),
  statusDurationAdd: z.strictObject({ statusId: blId, amount: blExpr }).optional(),
});
const common = { when: blWhen.optional(), targeting: blTargeting.optional() };
export const blEffect: z.ZodType<SkillEffect> = z.lazy(() => z.discriminatedUnion('type', [
  z.strictObject({ ...common, type: z.literal(EffectType.InvokeSkill), skillId: blId }),
  z.strictObject({ ...common, type: z.literal(EffectType.SpellHit), coeff: z.number(), power: blExpr.optional(), defenseIgnore: blExpr.optional() }),
  z.strictObject({ ...common, type: z.literal(EffectType.ApplyStatus), statusId: blId, duration: blExpr, self: z.boolean().optional(), hit: z.enum(StatusHit).optional(), chanceFactor: blExpr.optional() }),
  z.strictObject({ ...common, type: z.literal(EffectType.RemoveStatus), statusIds: z.array(blId).optional(), kinds: z.array(ref).optional(), ownedOnly: z.boolean().optional() }),
  z.strictObject({ ...common, type: z.literal(EffectType.ModifyStatusDuration), kinds: z.array(ref), amount: blExpr, ownedOnly: z.boolean().optional() }),
  z.strictObject({ ...common, type: z.literal(EffectType.ModifyFact), key: z.string().regex(/^bailu_[a-z0-9_]+$/), value: blExpr }),
  z.strictObject({ ...common, type: z.literal(EffectType.ModifyResource), resourceId: ref, amount: blExpr }),
  z.strictObject({ ...common, type: z.literal(EffectType.RestoreHp), power: blExpr, revive: z.boolean().optional(), gainCounter: ref.optional() }),
  z.strictObject({ ...common, type: z.literal(EffectType.Heal), power: blExpr, fixedBase: z.boolean().optional(), includeHealPower: z.boolean().optional() }),
  z.strictObject({ ...common, type: z.literal(EffectType.RestoreMp), power: blExpr }),
  z.strictObject({ ...common, type: z.literal(EffectType.DamageMp), power: blExpr }),
  z.strictObject({ ...common, type: z.literal(EffectType.RemoveWound), power: blExpr }),
  z.strictObject({ ...common, type: z.literal(EffectType.LoseHp), power: blExpr }),
  z.strictObject({ ...common, type: z.literal(EffectType.ModifyStrike), factor: blExpr.optional(), add: blExpr.optional() }),
  z.strictObject({ ...common, type: z.literal(EffectType.RandomBranch), branchId: ref, chance: blExpr, successEffects: z.array(blEffect), failureEffects: z.array(blEffect) }),
]));
export const blHook = z.strictObject({
  on: z.enum(HookName), sourceIsSelf: z.boolean().optional(), targetIsSelf: z.boolean().optional(), sourceIsOwnedPet: z.boolean().optional(),
  effectSource: z.literal('eventSource').optional(),
  effectSkill: z.literal('eventSkill').optional(),
  aim: z.enum(HookAim).optional(), targeting: blTargeting.optional(), chance: blExpr.optional(), when: blWhen.optional(),
  limitConsumption: z.enum(['onAttempt', 'onSuccess']).optional(), effects: z.array(blEffect).min(1),
});
export const blStatus = z.strictObject({
  id: blId, name: z.string().min(1), kind: ref, school: z.literal('bailu'), category: z.enum(StatusCategory),
  blocksAction: z.boolean().optional(), blocksSpell: z.boolean().optional(), blocksDamagingSpells: z.boolean().optional(), blocksPhysical: z.boolean().optional(), blocksArts: z.boolean().optional(),
  blocksNonArtSkills: z.boolean().optional(), blockedCommands: z.array(z.enum(CommandType)).optional(), commandPolicy: z.enum(CommandPolicy).optional(),
  interceptHostileAction: z.boolean().optional(), breakOnDamage: z.boolean().optional(), breakOnDamageAbove: z.number().nonnegative().optional(),
  attrMods: z.partialRecord(z.enum(ATTR_NAMES), blExpr).optional(), modifiers: z.array(blModifier).optional(), snapshotModifiers: z.boolean().optional(),
  persistWhenDowned: z.boolean().optional(), sourceBound: z.boolean().optional(), dispellable: z.boolean().optional(), untilBattleEnd: z.boolean().optional(),
  expireSameRound: z.boolean().optional(), extendable: z.boolean().optional(),
  onExpire: z.strictObject({ statusId: blId, duration: z.number().int().positive() }).optional(),
});
