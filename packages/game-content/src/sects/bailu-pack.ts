import { z } from 'zod';
import { formatContentPackErrors } from '@daoyou/game-domain/content-pack-errors';
import { FormulaFamily, SkillTag } from '@daoyou/combat-core/enums';
import type { SkillDef, StatusDef } from '@daoyou/combat-core/types';
import type { SectSkillDefV6 } from '@daoyou/game-domain/combat';
import { validateSectExpressions } from './authoring-expressions.js';
import { sectSkillLearning } from './skill-learning.js';
import { blEffect, blExpr, blHook, blId, blModifier, blStatus, blTargeting } from './bailu-shapes.js';
import raw from './data/bailu-combat.json' with { type: 'json' };

export const BailuCombatPackShape = z.strictObject({
  $schema: z.string().optional(), formatVersion: z.literal(1), contentRevision: z.number().int().positive(),
  baseSkillIds: z.array(blId).min(1),
  skills: z.array(z.strictObject({
    id: blId, name: z.string().min(1).max(80), school: z.literal('bailu'), description: z.string().min(1).max(1000),
    tags: z.array(z.enum(SkillTag)).min(1), targeting: blTargeting, effects: z.array(blEffect),
    costMp: blExpr.optional(), costHp: blExpr.optional(), requireHpRatio: z.number().min(0).max(1).optional(), requirement: blExpr.optional(),
    resourceCosts: z.array(z.strictObject({ resourceId: z.string().min(1), amount: blExpr })).optional(),
    cooldownRounds: z.number().int().positive().optional(), initialCooldownRounds: z.number().int().nonnegative().optional(),
    sealBase: z.number().min(0).max(100).optional(), sealChanceCeil: z.number().min(0).max(1).optional(),
    formula: z.enum(FormulaFamily).optional(), schoolTerm: z.strictObject({ quad: z.number().optional(), linear: z.number().optional(), intercept: z.number().optional() }).optional(),
    splash: z.strictObject({ perTarget: z.number().min(0).max(1), floor: z.number().min(0).max(1) }).optional(),
    modifiers: z.array(blModifier).optional(), hooks: z.array(blHook).optional(),
  })).min(1),
  statuses: z.array(blStatus).min(1),
});

export function validateBailuReferences(data: unknown, ids: Set<string>, issue: (path: (string | number)[], message: string) => void, path: (string | number)[] = []) {
  if (Array.isArray(data)) { data.forEach((value, i) => validateBailuReferences(value, ids, issue, [...path, i])); return; }
  if (!data || typeof data !== 'object') return;
  for (const [key, value] of Object.entries(data)) {
    const refs = ['skillId', 'statusId'].includes(key) ? [value] : ['skillIds', 'statusIds', 'resolvedStatusIds', 'requireStatusIds', 'requireAbsentStatusIds', 'grantSkills', 'foundationPassives', 'passives', 'revokeSkillIds'].includes(key) && Array.isArray(value) ? value : [];
    for (const ref of refs) if (typeof ref === 'string' && ref.startsWith('bailu.') && !ids.has(ref)) issue([...path, key], '引用不存在：' + ref);
    validateBailuReferences(value, ids, issue, [...path, key]);
  }
}

export function loadBailuCombatPack(data: unknown) {
  const result = BailuCombatPackShape.superRefine((pack, ctx) => {
    const issue = (path: (string | number)[], message: string) => ctx.addIssue({ code: 'custom', path, message });
    const ids = [...pack.skills, ...pack.statuses].map(entry => entry.id);
    if (new Set(ids).size !== ids.length) issue([], '重复 ID');
    for (const id of pack.baseSkillIds) if (!pack.skills.some(skill => skill.id === id)) issue(['baseSkillIds'], '技能引用不存在：' + id);
    if (new Set(pack.baseSkillIds).size !== pack.baseSkillIds.length) issue(['baseSkillIds'], '重复技能引用');
    for (const skill of pack.skills) {
      try { sectSkillLearning(skill.id); } catch { issue(['skills', skill.id], '缺少技能学习关系'); }
      if (!skill.effects.length && !skill.modifiers?.length && !skill.hooks?.length) issue(['skills', skill.id], '技能缺少实际效果');
    }
    validateBailuReferences(pack, new Set(ids), issue);
    validateSectExpressions(pack, issue);
  }).safeParse(data);
  if (!result.success) throw new Error(formatContentPackErrors('content/data/bailu-combat.json', data, result.error.issues));
  return result.data;
}

export function compileBailuCombatPack(pack: ReturnType<typeof loadBailuCombatPack>) {
  const skills: SectSkillDefV6[] = pack.skills.map(definition => ({ ...sectSkillLearning(definition.id), kind: definition.tags.includes(SkillTag.Passive) ? 'passive' : 'active', definition: definition satisfies SkillDef }));
  const skill = (id: string): SectSkillDefV6 => {
    const found = skills.find(entry => entry.definition.id === id);
    if (!found) throw new Error('bailu-combat: 技能引用不存在：' + id);
    return found;
  };
  return { skills, baseSkills: pack.baseSkillIds.map(skill), skill, statuses: pack.statuses satisfies StatusDef[] };
}
export const BAILU_COMBAT = compileBailuCombatPack(loadBailuCombatPack(raw));
