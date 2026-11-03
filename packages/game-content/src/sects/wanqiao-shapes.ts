import { z } from 'zod';
import { ATTR_NAMES } from '@daoyou/combat-core/constants';
import { DamageKind, DamageOrigin, EffectType, HookAim, HookName, StatusCategory, StatusHit, StatusTick, TickKind, TargetMode, TargetSide, UnitKind } from '@daoyou/combat-core/enums';
import type { SkillEffect } from '@daoyou/combat-core/types';

export const wqId = z.string().regex(/^wanqiao\.[a-z][a-z0-9_.]*$/);
const ref = z.string().min(1);
export const wqExpr = z.union([z.number().finite(), z.string().min(1).max(2000)]);
const chance = z.union([z.number().min(0).max(1), z.string().min(1).max(2000)]);
export const wqTargeting = z.strictObject({
  side: z.enum(TargetSide), mode: z.enum(TargetMode).optional(), count: wqExpr.optional(),
  maxSelected: z.number().int().positive().optional(), includeOwnedStatusKind: ref.optional(),
  ownedStatusStackLimit: z.strictObject({ kind: ref, max: z.number().int().positive() }).optional(),
});
export const wqWhen = z.strictObject({
  expression: wqExpr.optional(), skillIds: z.array(ref).optional(), requireKind: z.enum(DamageKind).optional(),
  damageOrigins: z.array(z.enum(DamageOrigin)).optional(), foeKind: z.enum(UnitKind).optional(),
  sourceStanding: z.boolean().optional(), actionSucceeded: z.boolean().optional(), oncePerBattle: z.boolean().optional(),
  oncePerActionTarget: z.boolean().optional(), dotStatusIds: z.array(ref).optional(),
  targetStatusKinds: z.array(ref).optional(), targetStatusCategories: z.array(z.enum(StatusCategory)).optional(),
  targetOwnedStatus: z.strictObject({ kind: ref, appliedThisRound: z.boolean().optional() }).optional(),
  sourceResource: z.strictObject({ id: ref, min: z.number().optional(), max: z.number().optional() }).optional(),
  removedStatusKind: ref.optional(), statusRemoveReason: ref.optional(),
});
export const wqModifier = z.strictObject({
  when: wqWhen.optional(), damageBonus: wqExpr.optional(), damageResultFactor: wqExpr.optional(),
  damageTakenBonus: wqExpr.optional(), allDamageTakenBonus: wqExpr.optional(),
  critChanceAdd: wqExpr.optional(), critMultiplierAdd: wqExpr.optional(),
});
const common = { when: wqWhen.optional(), targeting: wqTargeting.optional() };
export const wqEffect: z.ZodType<SkillEffect> = z.lazy(() => z.discriminatedUnion('type', [
  z.strictObject({ ...common, type: z.literal(EffectType.SpellHit), coeff: z.number(), power: wqExpr.optional(), resultFactors: z.array(z.number()).optional() }),
  z.strictObject({ ...common, type: z.literal(EffectType.FixedHit), power: wqExpr, origin: z.enum(DamageOrigin).optional() }),
  z.strictObject({ ...common, type: z.literal(EffectType.ApplyStatus), statusId: wqId, duration: wqExpr, self: z.boolean().optional(), hit: z.enum(StatusHit).optional() }),
  z.strictObject({ ...common, type: z.literal(EffectType.RemoveStatus), statusIds: z.array(wqId).optional(), ownedOnly: z.boolean().optional() }),
  z.strictObject({ ...common, type: z.literal(EffectType.ModifyFact), key: z.string().regex(/^wanqiao_[a-z0-9_]+$/), value: wqExpr }),
  z.strictObject({ ...common, type: z.literal(EffectType.ModifyResource), resourceId: wqId, amount: wqExpr, mode: z.enum(['add', 'set']).optional() }),
  z.strictObject({ ...common, type: z.literal(EffectType.Heal), power: wqExpr, fixedBase: z.boolean().optional(), includeHealPower: z.boolean().optional() }),
  z.strictObject({ ...common, type: z.literal(EffectType.RestoreHp), power: wqExpr }),
  z.strictObject({ ...common, type: z.literal(EffectType.Wound), power: wqExpr }),
  z.strictObject({ ...common, type: z.literal(EffectType.ApplyBarrier), id: wqId, kind: ref, name: z.string().min(1), power: wqExpr, duration: wqExpr }),
  z.strictObject({ ...common, type: z.literal(EffectType.ModifyStrike), factor: wqExpr.optional(), add: wqExpr.optional() }),
  z.strictObject({ ...common, type: z.literal(EffectType.Dispel), categories: z.array(z.enum(StatusCategory)), maxCount: wqExpr }),
  z.strictObject({ ...common, type: z.literal(EffectType.RandomBranch), branchId: ref, chance, successEffects: z.array(wqEffect), failureEffects: z.array(wqEffect) }),
]));
export const wqHook = z.strictObject({
  on: z.enum(HookName), sourceIsSelf: z.boolean().optional(), targetIsSelf: z.boolean().optional(),
  aim: z.enum(HookAim).optional(), when: wqWhen.optional(), effects: z.array(wqEffect).min(1),
});
export const wqStatus = z.strictObject({
  id: wqId, name: z.string().min(1), kind: ref, school: z.literal('wanqiao'), category: z.enum(StatusCategory),
  dispellable: z.boolean().optional(), untilBattleEnd: z.boolean().optional(), sourceBound: z.boolean().optional(),
  maxStacks: z.number().int().positive().optional(), ticks: z.enum(StatusTick).optional(),
  expireSameRound: z.boolean().optional(), snapshotModifiers: z.boolean().optional(),
  blocksAction: z.boolean().optional(), blocksNonArtSkills: z.boolean().optional(),
  mpShieldRatio: z.number().min(0).max(1).optional(),
  attrMods: z.partialRecord(z.enum(ATTR_NAMES), wqExpr).optional(), modifiers: z.array(wqModifier).optional(),
  onTick: z.strictObject({ type: z.enum(TickKind), hpPower: wqExpr }).optional(),
  onExpire: z.strictObject({ statusId: wqId, duration: z.number().int().positive() }).optional(),
});
