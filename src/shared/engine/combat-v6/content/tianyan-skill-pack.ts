import { formatContentPackErrors } from '@shared/lib/content-pack-errors';
import { z } from 'zod';
import { DamageOrigin, EffectType, SkillTag, StatusCategory, StatusHit, TargetMode, TargetSide, type SkillDef } from '../core';
import { TIANYAN_FOUNDATION } from './tianyan-foundation';
import { compileTianyanReactionEffects } from './tianyan-reactions';
import { sectSkillLearning } from './skill-learning';
import { validateSectExpressions } from './authoring-expressions';
import type { SectSkillDefV6 } from './types';
import raw from './data/tianyan-skills.json';

const id = z.string().regex(/^tianyan\.[a-z][a-z0-9_.]*$/);
const number = z.number().min(0).max(1000000);
const expression = z.union([number, z.string().min(1).max(200)]);
const name = z.string().min(1).max(80);
const targeting = z.strictObject({ side: z.enum(TargetSide), mode: z.enum(TargetMode).optional(), count: expression.optional(), requireStatusKinds: z.array(id).optional() });
const effect = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal(EffectType.SpellHit), coeff: number, power: expression, defenseIgnore: number.max(1).optional() }),
  z.strictObject({ type: z.literal(EffectType.FixedHit), power: expression, formula: z.literal('fixed'), origin: z.enum(DamageOrigin) }),
  z.strictObject({ type: z.enum([EffectType.Heal, EffectType.RemoveWound, EffectType.RestoreMp]), power: expression, targeting: targeting.optional() }),
  z.strictObject({ type: z.literal(EffectType.ApplyStatus), statusId: id, duration: number.int().min(1).max(99), hit: z.enum(StatusHit).optional() }),
  z.strictObject({ type: z.literal(EffectType.ApplyBarrier), id, kind: id, name, power: expression, duration: number.int().min(1).max(99), targeting: targeting.optional() }),
  z.strictObject({ type: z.literal(EffectType.Dispel), categories: z.array(z.enum(StatusCategory)), maxCount: number.int().min(1).max(99) }),
  z.strictObject({ type: z.enum([EffectType.CopyStatus, EffectType.RemoveStatus]), kinds: z.array(id), maxCount: number.int().min(1).max(99), targeting: targeting.optional() }),
  z.strictObject({ type: z.literal(EffectType.ModifyResource), resourceId: id, amount: number.int(), maxGainPerAction: number.int() }),
]);
export const TianyanSkillsShape = z.strictObject({
  $schema: z.string().optional(), formatVersion: z.literal(1), contentRevision: z.number().int().positive(),
  baseSkillIds: z.array(id).min(1),
  elemental: z.array(z.strictObject({
    element: z.enum(['wood', 'fire', 'earth', 'metal', 'water']), name, costMp: expression,
    coefficient: number, power: expression, sideEffects: z.array(effect),
    markDuration: number.int().min(1).max(99),
  })).length(5),
  skills: z.array(z.strictObject({
    id, name, school: z.literal('tianyan'), costMp: expression,
    resourceRequirements: z.array(z.strictObject({ resourceId: id, min: number })).optional(),
    resourceCosts: z.array(z.strictObject({ resourceId: id, amount: number })).optional(),
    tags: z.array(z.enum(SkillTag)).min(1), formula: z.literal('spell').optional(),
    sealBase: number.max(100).optional(), targeting, effects: z.array(effect).min(1),
  })).min(1),
});
export function loadTianyanSkills(data: unknown) {
  const result = TianyanSkillsShape.superRefine((pack, ctx) => {
    const issue = (path: (string | number)[], message: string) => ctx.addIssue({ code: 'custom', path, message });
    if (new Set(pack.elemental.map(e => e.element)).size !== 5) issue(['elemental'], '五行技能必须各出现一次');
    const ids = [...TIANYAN_FOUNDATION.elements.map(e => e.skillId), ...pack.skills.map(s => s.id)];
    if (new Set(ids).size !== ids.length) issue(['skills'], '技能 ID 重复');
    for (const id of ids) { try { sectSkillLearning(id); } catch { issue(['skills', id], '缺少学习关系'); } }
    pack.baseSkillIds.forEach((id, i, base) => { if (!ids.includes(id) || base.indexOf(id) !== i) issue(['baseSkillIds', i], '技能引用不存在或重复：' + id); });
    const kinds = new Set(TIANYAN_FOUNDATION.statuses.map(s => s.kind));
    function walk(value: unknown, path: (string | number)[]) {
      if (Array.isArray(value)) { value.forEach((v, i) => walk(v, [...path, i])); return; }
      if (!value || typeof value !== 'object') return;
      for (const [key, child] of Object.entries(value)) {
        if (key === 'statusId' && !TIANYAN_FOUNDATION.statuses.some(s => s.id === child)) issue([...path, key], '状态引用不存在：' + child);
        if (['kinds', 'requireStatusKinds'].includes(key)) for (const id of child as string[]) if (!kinds.has(id)) issue([...path, key], '状态类别不存在：' + id);
        if (key === 'resourceId') {
          const resource = TIANYAN_FOUNDATION.resources.find(r => r.id === child);
          if (!resource) issue([...path, key], '资源不存在：' + child);
          else for (const field of ['amount', 'min', 'maxGainPerAction']) {
            const amount = (value as Record<string, unknown>)[field];
            if (typeof amount === 'number' && amount > resource.max) issue([...path, field], '资源规则超过上限');
          }
        }
        walk(child, [...path, key]);
      }
    }
    walk(pack, []);
    validateSectExpressions(pack, issue);
  }).safeParse(data);
  if (!result.success) throw new Error(formatContentPackErrors('content/data/tianyan-skills.json', data, result.error.issues));
  return data as z.infer<typeof TianyanSkillsShape>;
}
export function compileTianyanSkills(pack: ReturnType<typeof loadTianyanSkills>) {
  const elemental: SkillDef[] = pack.elemental.map(entry => {
    const mapping = TIANYAN_FOUNDATION.elements.find(e => e.element === entry.element)!;
    return {
      id: mapping.skillId, name: entry.name, school: 'tianyan', costMp: entry.costMp,
      tags: [SkillTag.Spell], formula: 'spell', targeting: { side: TargetSide.Enemy, count: 1 },
      effects: [
        { type: EffectType.SpellHit, coeff: entry.coefficient, power: entry.power },
        ...entry.sideEffects, ...compileTianyanReactionEffects(entry.element),
        { type: EffectType.ApplyStatus, statusId: mapping.markId, duration: entry.markDuration },
      ],
    };
  });
  const skills: SectSkillDefV6[] = [...elemental, ...pack.skills].map(definition => ({ ...sectSkillLearning(definition.id), kind: 'active', definition }));
  const skill = (id: string) => {
    const found = skills.find(s => s.definition.id === id);
    if (!found) throw new Error('content/data/tianyan-skills.json: skills.' + id + ': 引用不存在');
    return found;
  };
  return { skills, skill, baseSkills: pack.baseSkillIds.map(skill) };
}
export const TIANYAN_SKILLS = compileTianyanSkills(loadTianyanSkills(raw));
