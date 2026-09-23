import { z } from 'zod';
import { ATTR_NAMES, EffectType, HookName, HookAim, StatusCategory, StatusHit, StatusFlag, TargetMode, TargetSide, DamageKind, DamageOrigin } from '../core';

export const tyId = z.string().regex(/^tianyan\.[a-z][a-z0-9_.]*$/);
export const tyExpr = z.union([z.number().finite(), z.string().min(1).max(4000)]);
export const tyElement = z.enum(['wood', 'fire', 'earth', 'metal', 'water']);
export const tyTarget = z.strictObject({ side: z.enum(TargetSide), mode: z.enum(TargetMode).optional(), count: tyExpr.optional() });
export const tyWhen = z.strictObject({
  expression: tyExpr.optional(), requireStatusIds: z.array(tyId).optional(), sourceInitialStatusIds: z.array(tyId).optional(),
  skillIds: z.array(tyId).optional(), requireKind: z.enum(DamageKind).optional(), damageOrigins: z.array(z.enum(DamageOrigin)).optional(),
  targetSlot: z.enum(['primary', 'secondary']).optional(), sourceHasBarrier: z.boolean().optional(), targetHasBarrier: z.boolean().optional(),
  sourceHpRatioBelow: z.number().optional(), targetHpRatioAbove: z.number().optional(), targetStatusIds: z.array(tyId).optional(),
});
export const tyModifier = z.strictObject({ when: tyWhen.optional(), damageBonus: tyExpr.optional(), defenseIgnoreAdd: tyExpr.optional(), barrierDamageBonus: tyExpr.optional(), damageTakenBonus: tyExpr.optional(), sealChanceAdd: tyExpr.optional() });
const common = { when: tyWhen.optional(), targeting: tyTarget.optional() };
export const tyEffect = z.discriminatedUnion('type', [
  z.strictObject({ ...common, type: z.literal(EffectType.SpellHit), coeff: z.number(), power: tyExpr, defenseIgnore: tyExpr.optional() }),
  z.strictObject({ ...common, type: z.literal(EffectType.ApplyStatus), statusId: tyId, duration: tyExpr, hit: z.enum(StatusHit).optional() }),
  z.strictObject({ ...common, type: z.literal(EffectType.ApplyBarrier), id: tyId, kind: tyId, name: z.string(), power: tyExpr, duration: tyExpr }),
  z.strictObject({ ...common, type: z.literal(EffectType.Heal), power: tyExpr, includeHealPower: z.boolean().optional() }),
  z.strictObject({ ...common, type: z.literal(EffectType.RestoreMp), power: tyExpr }),
  z.strictObject({ ...common, type: z.literal(EffectType.Dispel), categories: z.array(z.enum(StatusCategory)), maxCount: tyExpr, excludeStatusFlags: z.array(z.enum(StatusFlag)).optional() }),
  z.strictObject({ ...common, type: z.literal(EffectType.EmitMechanic), mechanicId: tyId, name: z.string() }),
]);
export const tyHook = z.strictObject({ on: z.enum(HookName), sourceIsSelf: z.boolean().optional(), targetIsSelf: z.boolean().optional(), aim: z.enum(HookAim).optional(), when: tyWhen.optional(), effects: z.array(tyEffect) });
export const tyStatus = z.strictObject({
  id: tyId, name: z.string(), kind: tyId, category: z.enum(StatusCategory), school: z.literal('tianyan'),
  untilBattleEnd: z.boolean().optional(), persistWhenDowned: z.boolean().optional(), dispellable: z.boolean().optional(), extendable: z.boolean().optional(),
  blocksSpell: z.boolean().optional(), consumeAfterDamagingAction: z.boolean().optional(), expireSameRound: z.boolean().optional(),
  attrMods: z.partialRecord(z.enum(ATTR_NAMES), tyExpr).optional(), speedMod: tyExpr.optional(),
  damageTakenPhysical: z.number().optional(), damageTakenSpell: z.number().optional(), damageDealtPhysical: z.number().optional(), damageDealtSpell: z.number().optional(),
  ticks: z.literal('roundEnd').optional(), healingPerRound: tyExpr.optional(),
  onTick: z.strictObject({ type: z.literal('dot'), ratioOfMaxHp: z.number(), hpCap: tyExpr }).optional(),
});
