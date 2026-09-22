import { z } from 'zod';
import { DamageKind, DamageOrigin, EffectType, HookAim, HookName, SkillTag, StatusCategory, StatusHit, TargetMode, TargetSide, UnitKind } from '../core';

export const ydId = z.string().regex(/^youdu\.[a-z][a-z0-9_.]*$/);
const ref = z.string().min(1);
export const ydExpr = z.union([z.number().finite(), z.string().min(1).max(300)]);
export const ydTargeting = z.strictObject({
  side: z.enum(TargetSide), mode: z.enum(TargetMode).optional(), count: ydExpr.optional(),
  requireKind: z.enum(UnitKind).optional(), includeDowned: z.boolean().optional(), onlyDowned: z.boolean().optional(), requireRevivable: z.boolean().optional(),
});
export const ydWhen = z.strictObject({
  skillIds: z.array(ref).optional(), skillTags: z.array(z.enum(SkillTag)).optional(),
  requireKind: z.enum(DamageKind).optional(), damageOrigins: z.array(z.enum(DamageOrigin)).optional(),
  pvp: z.boolean().optional(), teamUniqueTag: ref.optional(), targetEnemy: z.boolean().optional(),
  actionKilledTarget: z.boolean().optional(),
  sourceStanding: z.boolean().optional(), actionSucceeded: z.boolean().optional(), sourceTags: z.array(ref).optional(),
  targetDowned: z.boolean().optional(), targetDead: z.boolean().optional(), foeKind: z.enum(UnitKind).optional(), excludeFoeKinds: z.array(z.enum(UnitKind)).optional(),
  targetStatusKinds: z.array(ref).optional(), targetAbsentStatusKinds: z.array(ref).optional(), primaryTargetStatusKinds: z.array(ref).optional(),
  targetOwnedStatus: z.strictObject({ kind: ref, appliedThisRound: z.boolean().optional() }).optional(),
  enemyStatusCount: z.strictObject({ kind: ref, min: z.number().int().nonnegative() }).optional(),
  requireStatusIds: z.array(ydId).optional(), requireAbsentStatusIds: z.array(ydId).optional(),
  removedStatusKind: ref.optional(), statusRemoveReason: z.literal('dispel').optional(),
  originalResourceCostMax: z.number().nonnegative().optional(), oncePerActionTarget: z.boolean().optional(),
  initialTargetStatusKinds: z.array(ref).optional(), sourceInitialStatusIds: z.array(ydId).optional(),
  targetSlot: z.literal('primary').optional(),
});
export const ydModifier = z.strictObject({
  when: ydWhen.optional(), damageBonus: ydExpr.optional(), damageAdd: ydExpr.optional(),
  damageTakenAdd: ydExpr.optional(), damageTakenBonus: ydExpr.optional(),
  critChanceAdd: ydExpr.optional(), critMultiplierAdd: ydExpr.optional(), defenseIgnoreAdd: ydExpr.optional(),
  physicalAttackAdd: ydExpr.optional(), physicalFuryChanceAdd: ydExpr.optional(), sealResistanceAdd: ydExpr.optional(),
  sealChanceAdd: ydExpr.optional(), statusDurationAdd: z.strictObject({ statusId: ydId, amount: ydExpr }).optional(),
  ignoreSealStatusKinds: z.array(ref).optional(),
  bypassImmunity: z.strictObject({ statusKinds: z.array(ref), passiveIds: z.array(ref) }).optional(),
});
const common = { when: ydWhen.optional(), targeting: ydTargeting.optional() };
export const ydEffect = z.discriminatedUnion('type', [
  z.strictObject({ ...common, type: z.literal(EffectType.FixedHit), power: ydExpr, percentageDamage: z.boolean().optional() }),
  z.strictObject({ ...common, type: z.literal(EffectType.PhysicalHit), coeff: z.number().nonnegative(), resultFactors: z.array(z.number().nonnegative()).optional(), power: ydExpr.optional(), cannotMiss: z.boolean().optional() }),
  z.strictObject({ ...common, type: z.literal(EffectType.ApplyStatus), statusId: ydId, duration: ydExpr, self: z.boolean().optional(), hit: z.enum(StatusHit).optional() }),
  z.strictObject({ ...common, type: z.literal(EffectType.RemoveStatus), statusIds: z.array(ydId) }),
  z.strictObject({ ...common, type: z.literal(EffectType.Dispel), categories: z.array(z.enum(StatusCategory)), maxCount: ydExpr.optional(), random: z.boolean().optional(), schoolOnly: z.boolean().optional() }),
  z.strictObject({ ...common, type: z.literal(EffectType.Revive), hpRatio: z.number().min(0).max(1) }),
  z.strictObject({ ...common, type: z.literal(EffectType.Wound), power: ydExpr }),
  z.strictObject({ ...common, type: z.literal(EffectType.DamageMp), power: ydExpr }),
  z.strictObject({ ...common, type: z.literal(EffectType.Heal), power: ydExpr }),
  z.strictObject({ ...common, type: z.literal(EffectType.RestoreHp), power: ydExpr }),
  z.strictObject({ ...common, type: z.literal(EffectType.LoseHp), power: ydExpr }),
  z.strictObject({ ...common, type: z.literal(EffectType.ModifyCooldown), skillId: ydId, amount: ydExpr }),
  z.strictObject({ ...common, type: z.literal(EffectType.ModifyResource), resourceId: ref, amount: ydExpr }),
]);
export const ydHook = z.strictObject({
  on: z.enum(HookName), sourceIsSelf: z.boolean().optional(), targetIsSelf: z.boolean().optional(),
  aim: z.enum(HookAim).optional(), targeting: ydTargeting.optional(), chance: ydExpr.optional(),
  when: ydWhen.optional(), effects: z.array(ydEffect).min(1),
});
