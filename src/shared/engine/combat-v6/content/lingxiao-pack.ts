import { formatContentPackErrors } from '@shared/lib/content-pack-errors';
import { z } from 'zod';
import { ATTR_NAMES, CommandPolicy, EffectType, SkillTag, StatusCategory, StatusHit, TargetMode, TargetSide, type SkillDef, type StatusDef } from '../core';
import { validateSectExpressions } from './authoring-expressions';
import { sectSkillLearning } from './skill-learning';
import type { SectSkillDefV6 } from './types';
import raw from './data/lingxiao-combat.json';

const id = z.string().regex(/^lingxiao\.[a-z][a-z0-9_.]*$/);
const name = z.string().min(1).max(80);
const number = z.number().min(0).max(1000000);
const expression = z.union([number, z.string().min(1).max(200)]);
const targeting = z.strictObject({ side: z.enum(TargetSide), mode: z.enum(TargetMode).optional(), count: expression.optional() });
const effect = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal(EffectType.PhysicalHit), hits: number.int().min(1).max(20).optional(), coeff: z.union([number, z.array(number).min(1).max(20)]), power: expression }),
  z.strictObject({ type: z.literal(EffectType.SkipNextAction) }),
  z.strictObject({ type: z.literal(EffectType.ApplyStatus), statusId: id, duration: number.int().min(1).max(99), self: z.boolean().optional(), storeTarget: z.boolean().optional(), hit: z.enum(StatusHit).optional() }),
  z.strictObject({ type: z.literal(EffectType.ModifyResource), resourceId: id, amount: number, mode: z.literal('set').optional() }),
]);
export const LingxiaoCombatPackShape = z.strictObject({
  $schema: z.string().optional(), formatVersion: z.literal(1), contentRevision: z.number().int().positive(),
  baseSkillIds: z.array(id).min(1),
  skills: z.array(z.strictObject({
    id, name, school: z.literal('lingxiao'),
    costHp: expression.optional(), costMp: expression.optional(),
    requireHpRatio: number.max(1).optional(),
    resourceRequirements: z.array(z.strictObject({ resourceId: id, min: number })).optional(),
    tags: z.array(z.enum(SkillTag)).min(1), sealBase: number.max(100).optional(),
    targeting, effects: z.array(effect).min(1),
  })).min(1),
  statuses: z.array(z.strictObject({
    id, name, kind: id, category: z.enum(StatusCategory),
    blocksAction: z.boolean().optional(), actFirst: z.boolean().optional(),
    commandPolicy: z.enum(CommandPolicy).optional(),
    attrMods: z.partialRecord(z.enum(ATTR_NAMES), expression).optional(),
    speedMod: expression.optional(),
  })).min(1),
  resources: z.array(z.strictObject({ id, name, current: number.int(), max: number.int().positive() })).min(1),
});
export function loadLingxiaoCombatPack(data: unknown) {
  const result = LingxiaoCombatPackShape.superRefine((pack, ctx) => {
    const issue = (path: (string | number)[], message: string) => ctx.addIssue({ code: 'custom', path, message });
    const ids = new Set<string>();
    for (const [key, entries] of [['skills', pack.skills], ['statuses', pack.statuses], ['resources', pack.resources]] as const) entries.forEach((entry, i) => {
      if (ids.has(entry.id)) issue([key, i, 'id'], '重复 ID：' + entry.id);
      ids.add(entry.id);
    });
    pack.baseSkillIds.forEach((id, i, ids) => {
      if (!pack.skills.some(s => s.id === id) || ids.indexOf(id) !== i) issue(['baseSkillIds', i], '引用不存在或重复：' + id);
    });
    const resource = (id: string, path: (string | number)[]) => {
      const found = pack.resources.find(r => r.id === id);
      if (!found) issue(path, '资源引用不存在：' + id);
      return found;
    };
    pack.resources.forEach((r, i) => { if (r.current > r.max) issue(['resources', i, r.id, 'current'], '初始值超过上限'); });
    pack.skills.forEach((skill, i) => {
      try { sectSkillLearning(skill.id); } catch { issue(['skills', i, skill.id], '缺少学习关系'); }
      skill.resourceRequirements?.forEach((r, j) => {
        const found = resource(r.resourceId, ['skills', i, skill.id, 'resourceRequirements', j]);
        if (found && r.min > found.max) issue(['skills', i, skill.id, 'resourceRequirements', j, 'min'], '门槛超过资源上限');
      });
      skill.effects.forEach((e, j) => {
        const path = ['skills', i, skill.id, 'effects', j];
        if (e.type === EffectType.ApplyStatus && !pack.statuses.some(s => s.id === e.statusId)) issue([...path, 'statusId'], '状态引用不存在：' + e.statusId);
        if (e.type === EffectType.ModifyResource) resource(e.resourceId, [...path, 'resourceId']);
        if (e.type === EffectType.PhysicalHit && Array.isArray(e.coeff) && e.coeff.length !== (e.hits ?? 1)) issue([...path, 'coeff'], '系数数量必须与伤害段数一致');
      });
    });
    validateSectExpressions(pack, issue);
  }).safeParse(data);
  if (!result.success) throw new Error(formatContentPackErrors('content/data/lingxiao-combat.json', data, result.error.issues));
  return data as z.infer<typeof LingxiaoCombatPackShape>;
}
export function compileLingxiaoCombatPack(pack: ReturnType<typeof loadLingxiaoCombatPack>) {
  const skills: SectSkillDefV6[] = pack.skills.map(definition => ({ ...sectSkillLearning(definition.id), kind: 'active', definition: definition satisfies SkillDef }));
  const skill = (id: string): SectSkillDefV6 => {
    const found = skills.find(s => s.definition.id === id);
    if (!found) throw new Error('content/data/lingxiao-combat.json: skills.' + id + ': 引用不存在');
    return found;
  };
  return { baseSkills: pack.baseSkillIds.map(skill), skill, statuses: pack.statuses satisfies StatusDef[], resources: pack.resources };
}
export const LINGXIAO_COMBAT = compileLingxiaoCombatPack(loadLingxiaoCombatPack(raw));
