import { formatContentPackErrors } from '@shared/lib/content-pack-errors';
import { z } from 'zod';
import { ATTR_NAMES, EffectType, SkillTag, StatusCategory, StatusHit, StatusTick, TargetMode, TargetSide, TickKind, type SkillDef, type StatusDef } from '../core';
import { validateSectExpressions } from './authoring-expressions';
import { sectSkillLearning } from './skill-learning';
import type { SectSkillDefV6 } from './types';
import raw from './data/youdu-combat.json';

const text = z.string().min(1).max(80).regex(/\S/);
const id = z.string().regex(/^youdu\.[a-z][a-z0-9_.]*$/);
const scalar = z.number().min(-1_000_000).max(1_000_000).multipleOf(0.000001);
const expression = z.union([scalar, z.string().min(1).max(200)]);
const ratio = z.number().min(0).max(1).multipleOf(0.000001);
const targeting = z.strictObject({
  side: z.enum(TargetSide), mode: z.enum(TargetMode).optional(),
  count: expression.optional(), includeDowned: z.boolean().optional(),
});
const effects = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal(EffectType.FixedHit), power: expression }),
  z.strictObject({ type: z.literal(EffectType.Wound), power: expression }),
  z.strictObject({ type: z.literal(EffectType.Heal), power: expression, targeting: targeting.optional() }),
  z.strictObject({ type: z.literal(EffectType.PhysicalHit), coeff: scalar.nonnegative(), power: expression.optional(), cannotMiss: z.boolean().optional(), defenseIgnore: ratio.optional() }),
  z.strictObject({ type: z.literal(EffectType.ApplyStatus), statusId: id, duration: expression, hit: z.enum(StatusHit).optional(), self: z.boolean().optional() }),
  z.strictObject({ type: z.literal(EffectType.SkipNextAction) }),
]);
export const YouduCombatPackShape = z.strictObject({
  $schema: z.string().optional(), formatVersion: z.literal(1),
  contentRevision: z.number().int().positive(),
  baseSkillIds: z.array(id).min(1),
  skills: z.array(z.strictObject({
    id, name: text, school: z.literal('youdu'),
    costMp: expression.optional(), costHp: expression.optional(),
    tags: z.array(z.enum(SkillTag)).min(1),
    formula: z.literal('fixed').optional(), sealBase: scalar.nonnegative().optional(),
    targeting, effects: z.array(effects).min(1),
  })).min(1),
  statuses: z.array(z.strictObject({
    id, name: text, kind: id, category: z.enum(StatusCategory),
    ticks: z.enum(StatusTick).optional(),
    onTick: z.strictObject({ type: z.literal(TickKind.Dot), ratioOfMaxHp: ratio }).optional(),
    speedMod: expression.optional(),
    attrMods: z.partialRecord(z.enum(ATTR_NAMES), expression).optional(),
    blocksRevive: z.boolean().optional(), persistWhenDowned: z.boolean().optional(),
    blocksAction: z.boolean().optional(),
  })).min(1),
});
export function loadYouduCombatPack(data: unknown) {
  const result = YouduCombatPackShape.superRefine((pack, ctx) => {
    const issue = (path: (string | number)[], message: string) => ctx.addIssue({ code: 'custom', path, message });
    const allIds = new Set<string>();
    for (const [section, entries] of [['skills', pack.skills], ['statuses', pack.statuses]] as const) {
      entries.forEach((entry, i) => {
        if (allIds.has(entry.id)) issue([section, i, 'id'], '重复 ID：' + entry.id);
        allIds.add(entry.id);
      });
    }
    pack.baseSkillIds.forEach((id, i, ids) => {
      if (!pack.skills.some(s => s.id === id) || ids.indexOf(id) !== i) issue(['baseSkillIds', i], '技能引用不存在或重复：' + id);
    });
    pack.skills.forEach((skill, i) => {
      try { sectSkillLearning(skill.id); } catch { issue(['skills', i, skill.id], '缺少技能学习关系'); }
      skill.effects.forEach((effect, j) => {
        if (effect.type === EffectType.ApplyStatus && !pack.statuses.some(s => s.id === effect.statusId))
          issue(['skills', i, skill.id, 'effects', j, 'statusId'], '状态引用不存在：' + effect.statusId);
      });
    });
    pack.statuses.forEach((status, i) => {
      if (!!status.onTick !== !!status.ticks) issue(['statuses', i, status.id, 'onTick'], '周期与周期效果必须同时定义');
    });
    validateSectExpressions(pack, issue);
  }).safeParse(data);
  if (!result.success) throw new Error(formatContentPackErrors('content/data/youdu-combat.json', data, result.error.issues));
  // 结构无转换；保留作者字段顺序，使迁移前后的快照序列化也一致。
  return data as z.infer<typeof YouduCombatPackShape>;
}

export function compileYouduCombatPack(pack: ReturnType<typeof loadYouduCombatPack>) {
  const skills: SectSkillDefV6[] = pack.skills.map(definition => ({
    ...sectSkillLearning(definition.id), kind: 'active', definition: definition satisfies SkillDef,
  }));
  const skill = (id: string): SectSkillDefV6 => {
    const found = skills.find(s => s.definition.id === id);
    if (!found) throw new Error('content/data/youdu-combat.json: skills.' + id + ': 引用不存在');
    return found;
  };
  return { baseSkills: pack.baseSkillIds.map(skill), skill, statuses: pack.statuses satisfies StatusDef[] };
}
export const YOUDU_COMBAT = compileYouduCombatPack(loadYouduCombatPack(raw));
