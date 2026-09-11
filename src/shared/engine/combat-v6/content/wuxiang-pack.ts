import { formatContentPackErrors } from '@shared/lib/content-pack-errors';
import { z } from 'zod';
import { ATTR_NAMES, EffectType, SkillTag, StatusCategory, StatusFlag, TargetMode, TargetSide, type SkillDef, type StatusDef } from '../core';
import { validateSectExpressions } from './authoring-expressions';
import { sectSkillLearning } from './skill-learning';
import type { SectSkillDefV6 } from './types';
import raw from './data/wuxiang-combat.json';

const id = z.string().regex(/^wuxiang\.[a-z][a-z0-9_.]*$/);
const name = z.string().min(1).max(80);
const number = z.number().min(0).max(1000000);
const expression = z.union([number, z.string().min(1).max(200)]);
const targeting = z.strictObject({ side: z.enum(TargetSide), mode: z.enum(TargetMode).optional(), count: expression.optional(), includeDowned: z.boolean().optional() });
const condition = z.strictObject({ requireAbsentStatusIds: z.array(id).optional(), requireStatusIds: z.array(id).optional() });
const effect = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal(EffectType.Heal), power: expression }),
  z.strictObject({ type: z.literal(EffectType.RemoveWound), power: expression }),
  z.strictObject({ type: z.literal(EffectType.SpellHit), coeff: number, power: expression, defenseIgnore: number.max(1).optional() }),
  z.strictObject({ type: z.literal(EffectType.ApplyBarrier), id, kind: id, name, power: expression, duration: number.int().min(1).max(99) }),
  z.strictObject({ type: z.literal(EffectType.Dispel), categories: z.array(z.enum(StatusCategory)), maxCount: number.int().min(1).max(99), excludeStatusFlags: z.array(z.enum(StatusFlag)) }),
  z.strictObject({ type: z.literal(EffectType.Revive), hpRatio: number.max(1), when: condition }),
  z.strictObject({ type: z.literal(EffectType.SkipNextAction) }),
  z.strictObject({ type: z.literal(EffectType.ApplyStatus), statusId: id, duration: number.int().min(1).max(99), self: z.boolean().optional() }),
  z.strictObject({ type: z.literal(EffectType.ModifyResource), resourceId: id, amount: number, when: condition.optional() }),
]);
export const WuxiangCombatPackShape = z.strictObject({
  $schema: z.string().optional(), formatVersion: z.literal(1), contentRevision: z.number().int().positive(),
  baseSkillIds: z.array(id).min(1),
  skills: z.array(z.strictObject({
    id, name, school: z.literal('wuxiang'),
    costHp: expression.optional(), costMp: expression.optional(),
    requireHpRatio: number.max(1).optional(),
    resourceRequirements: z.array(z.strictObject({ resourceId: id, min: number })).optional(),
    resourceCosts: z.array(z.strictObject({ resourceId: id, amount: number })).optional(),
    tags: z.array(z.enum(SkillTag)).min(1), formula: z.literal('spell').optional(),
    splash: z.strictObject({ perTarget: number.max(1), floor: number.max(1) }).optional(),
    targeting, effects: z.array(effect).min(1), successEffects: z.array(effect).optional(),
  })).min(1),
  statuses: z.array(z.strictObject({
    id, name, kind: id, category: z.enum(StatusCategory),
    blocksAction: z.boolean().optional(), dispellable: z.boolean().optional(),
    damageTakenPhysical: number.max(10).optional(), damageTakenSpell: number.max(10).optional(),
    attrMods: z.partialRecord(z.enum(ATTR_NAMES), expression).optional(),
  })).min(1),
  resources: z.array(z.strictObject({ id, name, current: number.int(), max: number.int().positive() })).min(1),
});
export function loadWuxiangCombatPack(data: unknown) {
  const result = WuxiangCombatPackShape.superRefine((pack, ctx) => {
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
      skill.resourceCosts?.forEach((r, j) => {
        const found = resource(r.resourceId, ['skills', i, skill.id, 'resourceCosts', j]);
        if (found && r.amount > found.max) issue(['skills', i, skill.id, 'resourceCosts', j, 'amount'], '消耗超过资源上限');
      });
      [...skill.effects, ...(skill.successEffects ?? [])].forEach((e, j) => {
        const path = ['skills', i, skill.id, 'effects', j];
        if (e.type === EffectType.ApplyStatus && !pack.statuses.some(s => s.id === e.statusId)) issue([...path, 'statusId'], '状态引用不存在：' + e.statusId);
        if (e.type === EffectType.ModifyResource) resource(e.resourceId, [...path, 'resourceId']);
        if ('when' in e) {
          for (const id of [...(e.when?.requireStatusIds ?? []), ...(e.when?.requireAbsentStatusIds ?? [])])
            if (!pack.statuses.some(s => s.id === id)) issue([...path, 'when'], '状态条件引用不存在：' + id);
        }
      });
    });
    validateSectExpressions(pack, issue);
  }).safeParse(data);
  if (!result.success) throw new Error(formatContentPackErrors('content/data/wuxiang-combat.json', data, result.error.issues));
  return data as z.infer<typeof WuxiangCombatPackShape>;
}
export function compileWuxiangCombatPack(pack: ReturnType<typeof loadWuxiangCombatPack>) {
  const skills: SectSkillDefV6[] = pack.skills.map(definition => ({ ...sectSkillLearning(definition.id), kind: 'active', definition: definition satisfies SkillDef }));
  const skill = (id: string): SectSkillDefV6 => {
    const found = skills.find(s => s.definition.id === id);
    if (!found) throw new Error('content/data/wuxiang-combat.json: skills.' + id + ': 引用不存在');
    return found;
  };
  return { skills, baseSkills: pack.baseSkillIds.map(skill), skill, statuses: pack.statuses satisfies StatusDef[], resources: pack.resources };
}
export const WUXIANG_COMBAT = compileWuxiangCombatPack(loadWuxiangCombatPack(raw));
