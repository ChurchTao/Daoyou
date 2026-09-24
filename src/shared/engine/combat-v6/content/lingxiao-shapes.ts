import { z } from 'zod';
import { ATTR_NAMES, EffectType, HookAim, HookName, SkillTag, StatusCategory, TargetMode, UnitKind } from '../core';

export const lxId = z.string().regex(/^lingxiao\.[a-z][a-z0-9_.]*$/);
const ref = z.string().min(1);
const n = z.number().nonnegative();
export const lxExpr = z.union([z.number(), z.string().min(1).max(300)]);
export const lxWhen = z.strictObject({
  skillIds: z.array(ref).optional(), skillTags: z.array(z.enum(SkillTag)).optional(),
  requireKind: z.literal('physical').optional(), pvp: z.boolean().optional(),
  teamUniqueTag: ref.optional(), targetEnemy: z.boolean().optional(),
  targetHasStandingPet: z.boolean().optional(), actionSucceeded: z.boolean().optional(),
  actionKilledTarget: z.boolean().optional(), sourceInitialHpRatioMin: n.max(1).optional(),
  sourceStanding: z.boolean().optional(), sourceTags: z.array(ref).optional(),
  sourceHasBarrier: z.boolean().optional(), requireStatusIds: z.array(lxId).optional(),
  requireAbsentStatusIds: z.array(lxId).optional(), foeKind: z.enum(UnitKind).optional(),
  oncePerRound: z.boolean().optional(), oncePerBattle: z.boolean().optional(),
  sourceResource: z.strictObject({ id: lxId, min: n.optional(), max: n.optional() }).optional(),
});
export const lxModifier = z.strictObject({
  when: lxWhen.optional(), teamAura: ref.optional(),
  damageBonus: lxExpr.optional(), damageAdd: lxExpr.optional(), physicalAttackAdd: lxExpr.optional(),
  critChanceAdd: lxExpr.optional(), critMultiplierAdd: lxExpr.optional(), defenseIgnoreAdd: lxExpr.optional(),
  protectedDamageBonus: lxExpr.optional(), ignoreProtection: z.boolean().optional(),
  splash: z.strictObject({ factor: n.max(1), count: lxExpr }).optional(),
  mirrorToTargetPet: z.boolean().optional(), recoverySkipChance: lxExpr.optional(),
  waiveHpCostAndRequirement: z.boolean().optional(), hpRequirement: z.strictObject({ min: n.max(1) }).optional(),
  targetCountAdd: lxExpr.optional(), physicalHitsAdd: n.int().max(10).optional(),
  resetCooldownOnKill: z.boolean().optional(), ignoreReviveBlock: z.boolean().optional(),
});
export const lxEffect = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal(EffectType.PhysicalHit), hits: n.int().min(1).max(20).optional(), coeff: z.union([n, z.array(n)]), resultFactors: z.array(n).optional(), power: lxExpr.optional(), when: lxWhen.optional() }),
  z.strictObject({ type: z.literal(EffectType.ApplyStatus), statusId: lxId, duration: lxExpr, self: z.boolean().optional(), storeTarget: z.boolean().optional(), hit: z.enum(['always', 'seal']).optional(), when: lxWhen.optional() }),
  z.strictObject({ type: z.literal(EffectType.ModifyResource), resourceId: ref, amount: lxExpr, mode: z.enum(['set', 'add']).optional(), when: lxWhen.optional() }),
  z.strictObject({ type: z.literal(EffectType.SkipNextAction), when: lxWhen.optional() }),
  z.strictObject({ type: z.literal(EffectType.RestoreHp), power: lxExpr, when: lxWhen.optional() }),
  z.strictObject({ type: z.literal(EffectType.ApplyBarrier), untilBattleEnd: z.boolean().optional(), id: lxId, kind: lxId, name: ref, power: lxExpr, duration: lxExpr, when: lxWhen.optional() }),
  z.strictObject({ type: z.literal(EffectType.RemoveStatus), statusIds: z.array(lxId), when: lxWhen.optional() }),
  z.strictObject({ type: z.literal(EffectType.Dispel), categories: z.array(z.enum(StatusCategory)), maxCount: lxExpr.optional(), random: z.boolean().optional(), when: lxWhen.optional() }),
]);
export const lxHook = z.strictObject({
  on: z.enum(HookName), sourceIsSelf: z.boolean().optional(), targetIsSelf: z.boolean().optional(),
  aim: z.enum(HookAim).optional(), aimCount: lxExpr.optional(), aimMode: z.enum(TargetMode).optional(),
  when: lxWhen.optional(), chance: lxExpr.optional(), effects: z.array(lxEffect).min(1),
});
export const lxPanel = z.array(z.strictObject({ attr: z.enum(ATTR_NAMES), mode: z.enum(['add', 'multiply']), value: n }));
