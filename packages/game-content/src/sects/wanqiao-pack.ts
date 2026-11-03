import { z } from 'zod';
import { formatContentPackErrors } from '@daoyou/game-domain/content-pack-errors';
import { FormulaFamily, SkillTag } from '@daoyou/combat-core/enums';
import type { SkillDef, StatusDef } from '@daoyou/combat-core/types';
import type { SectSkillDefV6 } from '@daoyou/game-domain/combat';
import { validateSectExpressions } from './authoring-expressions.js';
import { sectSkillLearning } from './skill-learning.js';
import { wqEffect, wqHook, wqId, wqModifier, wqStatus, wqTargeting } from './wanqiao-shapes.js';
import raw from './data/wanqiao-combat.json' with { type: 'json' };
import rawPaths from './data/wanqiao-paths.json' with { type: 'json' };

const cost = z.union([z.number().finite().nonnegative(), z.string().min(1).max(2000)]);
export const WanqiaoCombatPackShape = z.strictObject({
  $schema: z.string().optional(), formatVersion: z.literal(1), contentRevision: z.number().int().positive(),
  baseSkillIds: z.array(wqId).min(1),
  resources: z.array(z.strictObject({ id: wqId, name: z.string().min(1), current: z.number().int().nonnegative(), max: z.number().int().positive() })).length(1),
  skills: z.array(z.strictObject({
    id: wqId, name: z.string().min(1), school: z.literal('wanqiao'), description: z.string().min(1),
    tags: z.array(z.enum(SkillTag)).min(1), targeting: wqTargeting, effects: z.array(wqEffect),
    successEffects: z.array(wqEffect).optional(), costMp: cost.optional(), costHp: cost.optional(),
    requireHpRatio: z.number().min(0).max(1).optional(),
    resourceRequirements: z.array(z.strictObject({ resourceId: wqId, min: z.number().int().nonnegative() })).optional(),
    cooldownRounds: z.number().int().positive().optional(), initialCooldownRounds: z.number().int().nonnegative().optional(),
    formula: z.enum(FormulaFamily).optional(),
    schoolTerm: z.strictObject({ quad: z.number().finite().optional(), linear: z.number().finite().optional(), intercept: z.number().finite().optional() }).optional(),
    splash: z.strictObject({ perTarget: z.number().min(0).max(1), floor: z.number().min(0).max(1) }).optional(),
    modifiers: z.array(wqModifier).optional(), hooks: z.array(wqHook).optional(),
  })).min(1),
  statuses: z.array(wqStatus).min(1),
});

export function validateWanqiaoReferences(data: unknown, ids: Set<string>, issue: (path: (string | number)[], message: string) => void, path: (string | number)[] = []): void {
  if (typeof data === 'string') {
    for (const match of data.matchAll(/\b(?:known|knownSkillLevel)\.(wanqiao\.(?:skill|passive)\.[a-z0-9_.]+)/g)) {
      if (!ids.has(match[1])) issue(path, '引用不存在：' + match[1]);
    }
    return;
  }
  if (Array.isArray(data)) { data.forEach((value, i) => validateWanqiaoReferences(value, ids, issue, [...path, i])); return; }
  if (!data || typeof data !== 'object') return;
  for (const [key, value] of Object.entries(data)) {
    const refs = ['skillId', 'statusId', 'resourceId'].includes(key) ? [value] : ['skillIds', 'statusIds', 'dotStatusIds', 'resources', 'foundationPassives', 'grantSkills', 'passives', 'revokeSkillIds'].includes(key) && Array.isArray(value) ? value : [];
    for (const ref of refs) if (typeof ref === 'string' && ref.startsWith('wanqiao.') && !ids.has(ref)) issue([...path, key], '引用不存在：' + ref);
    validateWanqiaoReferences(value, ids, issue, [...path, key]);
  }
}

export function loadWanqiaoCombatPack(data: unknown) {
  const result = WanqiaoCombatPackShape.superRefine((pack, ctx) => {
    const issue = (path: (string | number)[], message: string) => ctx.addIssue({ code: 'custom', path, message });
    const entries = [...pack.skills, ...pack.statuses, ...pack.resources];
    const ids = new Set(entries.map(entry => entry.id));
    if (ids.size !== entries.length) issue([], '重复 ID');
    if (new Set(pack.baseSkillIds).size !== pack.baseSkillIds.length) issue(['baseSkillIds'], '重复技能引用');
    for (const id of pack.baseSkillIds) if (!pack.skills.some(skill => skill.id === id)) issue(['baseSkillIds'], '技能引用不存在：' + id);
    for (const resource of pack.resources) if (resource.current > resource.max) issue(['resources', resource.id], '初始资源超过上限');
    for (const skill of pack.skills) {
      try { sectSkillLearning(skill.id); } catch { issue(['skills', skill.id], '缺少技能学习关系'); }
      if (!skill.effects.length && !skill.modifiers?.length && !skill.hooks?.length) issue(['skills', skill.id], '技能缺少实际效果');
    }
    validateWanqiaoReferences(pack, new Set([...ids, ...rawPaths.passives.map(passive => passive.id)]), issue);
    validateSectExpressions(pack, issue);
  }).safeParse(data);
  if (!result.success) throw new Error(formatContentPackErrors('content/data/wanqiao-combat.json', data, result.error.issues));
  return result.data;
}

export function compileWanqiaoCombatPack(pack: ReturnType<typeof loadWanqiaoCombatPack>) {
  const skills: SectSkillDefV6[] = pack.skills.map(definition => ({ ...sectSkillLearning(definition.id), kind: definition.tags.includes(SkillTag.Passive) ? 'passive' : 'active', definition: definition satisfies SkillDef }));
  const skill = (id: string): SectSkillDefV6 => {
    const found = skills.find(entry => entry.definition.id === id);
    if (!found) throw new Error('wanqiao-combat: 技能引用不存在：' + id);
    return found;
  };
  return { skills, baseSkills: pack.baseSkillIds.map(skill), skill, resources: pack.resources, statuses: pack.statuses satisfies StatusDef[] };
}

export const WANQIAO_COMBAT = compileWanqiaoCombatPack(loadWanqiaoCombatPack(raw));
