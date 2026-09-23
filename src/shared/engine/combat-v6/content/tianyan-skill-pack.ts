import { z } from 'zod';
import { formatContentPackErrors } from '@shared/lib/content-pack-errors';
import { SkillTag, type SkillDef } from '../core';
import { TIANYAN_FOUNDATION, validateTianyanReferences } from './tianyan-foundation';
import { compileTianyanReactionEffects, compileTianyanReactionModifiers } from './tianyan-reactions';
import { tyId, tyExpr, tyElement, tyTarget, tyEffect, tyModifier } from './tianyan-shapes';
import { sectSkillLearning } from './skill-learning';
import { validateSectExpressions } from './authoring-expressions';
import type { SectSkillDefV6 } from './types';
import raw from './data/tianyan-skills.json';
const skill = z.strictObject({ id: tyId, name: z.string().min(1), description: z.string().min(1), school: z.literal('tianyan'), costMp: tyExpr, cooldownRounds: z.number().int().nonnegative().optional(), requirement: tyExpr.optional(), tags: z.array(z.enum(SkillTag)), formula: z.literal('spell').optional(), sealBase: z.number().optional(), targeting: tyTarget, effects: z.array(tyEffect), successEffects: z.array(tyEffect).optional(), modifiers: z.array(tyModifier).optional() });
export const TianyanSkillsShape = z.strictObject({
  $schema: z.string().optional(), formatVersion: z.literal(1), contentRevision: z.number().int().positive(), baseSkillIds: z.array(tyId).length(7),
  elemental: z.array(z.strictObject({ element: tyElement, skill })).length(5), skills: z.array(skill),
});
export function loadTianyanSkills(data: unknown) {
  const result = TianyanSkillsShape.superRefine((pack, ctx) => {
    const issue = (path: (string | number)[], message: string) => ctx.addIssue({ code: 'custom', path, message });
    if (new Set(pack.elemental.map(e => e.element)).size !== 5) issue(['elemental'], '五行必须各出现一次');
    const ids = [...pack.elemental.map(e => e.skill.id), ...pack.skills.map(s => s.id)];
    if (new Set(ids).size !== ids.length) issue(['skills'], '重复 ID');
    pack.elemental.forEach(e => { if (TIANYAN_FOUNDATION.elements.find(m => m.element === e.element)?.skillId !== e.skill.id) issue(['elemental', e.element], '技能映射错误'); });
    for (const id of ids) { try { sectSkillLearning(id); } catch { issue(['skills', id], '缺少学习关系'); } }
    if (new Set(pack.baseSkillIds).size !== 7 || pack.baseSkillIds.some(id => !ids.includes(id))) issue(['baseSkillIds'], '基础技能引用不存在或重复');
    validateTianyanReferences(pack, new Set(TIANYAN_FOUNDATION.statuses.map(s => s.id)), issue);
    validateSectExpressions(pack, issue);
  }).safeParse(data);
  if (!result.success) throw new Error(formatContentPackErrors('content/data/tianyan-skills.json', data, result.error.issues));
  return result.data;
}
export function compileTianyanSkills(pack: ReturnType<typeof loadTianyanSkills>) {
  const elemental: SkillDef[] = pack.elemental.map(({ element, skill }) => ({
    ...structuredClone(skill),
    modifiers: [...(skill.modifiers ?? []), ...compileTianyanReactionModifiers(element)],
    effects: [...skill.effects, ...compileTianyanReactionEffects(element)],
    successEffects: [{ type: 'applyStatus', statusId: TIANYAN_FOUNDATION.elements.find(e => e.element === element)!.markId, duration: 1, targeting: { side: 'self' } }],
  }));
  const skills: SectSkillDefV6[] = [...elemental, ...pack.skills].map(definition => ({ ...sectSkillLearning(definition.id), kind: 'active', definition }));
  const skill = (id: string) => { const found = skills.find(s => s.definition.id === id); if (!found) throw new Error('未知天衍技能：' + id); return found; };
  return { skills, skill, baseSkills: pack.baseSkillIds.map(skill) };
}
export const TIANYAN_SKILLS = compileTianyanSkills(loadTianyanSkills(raw));
