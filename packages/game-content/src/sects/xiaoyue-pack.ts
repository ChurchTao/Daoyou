import { z } from 'zod';
import { formatContentPackErrors } from '@daoyou/game-domain/content-pack-errors';
import { SkillTag } from '@daoyou/combat-core/enums';
import type { SkillDef, StatusDef } from '@daoyou/combat-core/types';
import type { SectSkillDefV6 } from '@daoyou/game-domain/combat';
import { validateSectExpressions } from './authoring-expressions.js';
import { sectSkillLearning } from './skill-learning.js';
import { xyEffect, xyExpr, xyHook, xyId, xyModifier, xyStatus, xyTags, xyTargeting } from './xiaoyue-shapes.js';
import raw from './data/xiaoyue-combat.json' with { type: 'json' };
import rawPaths from './data/xiaoyue-paths.json' with { type: 'json' };

export const XiaoyueCombatPackShape = z.strictObject({
  $schema: z.string().optional(), formatVersion: z.literal(1), contentRevision: z.number().int().positive(),
  baseSkillIds: z.array(xyId).min(1),
  skills: z.array(z.strictObject({
    id: xyId, name: z.string().min(1), school: z.literal('xiaoyue'), description: z.string().min(1),
    tags: xyTags, targeting: xyTargeting, effects: z.array(xyEffect),
    requirement: xyExpr.optional(), costMp: xyExpr.optional(), costHp: xyExpr.optional(),
    cooldownRounds: z.number().int().positive().optional(), initialCooldownRounds: z.number().int().nonnegative().optional(),
    recoveryStatusId: xyId.optional(), forbidRevivedRound: z.boolean().optional(), sealBase: z.number().min(0).max(100).optional(),
    modifiers: z.array(xyModifier).optional(), hooks: z.array(xyHook).optional(),
  })).min(1),
  statuses: z.array(xyStatus).min(1),
});

export function validateXiaoyueReferences(data: unknown, ids: Set<string>, issue: (path: (string | number)[], message: string) => void, path: (string | number)[] = []): void {
  if (typeof data === 'string') {
    for (const match of data.matchAll(/\b(?:known|knownSkillLevel)\.(xiaoyue\.(?:skill|passive)\.[a-z0-9_.]+)/g))
      if (!ids.has(match[1])) issue(path, '引用不存在：' + match[1]);
    for (const match of data.matchAll(/\b(?:hasStatus|statusRounds|targetStatusRounds|ownedTargetStatusStacks)\.(xiaoyue\.status\.[a-z0-9_.]+)/g))
      if (!ids.has(match[1])) issue(path, '引用不存在：' + match[1]);
    return;
  }
  if (Array.isArray(data)) { data.forEach((value, i) => validateXiaoyueReferences(value, ids, issue, [...path, i])); return; }
  if (!data || typeof data !== 'object') return;
  for (const [key, value] of Object.entries(data)) {
    const refs = ['skillId', 'statusId', 'resourceId'].includes(key) ? [value]
      : ['skillIds', 'statusIds', 'kinds', 'requireStatusKinds', 'sourceOwnedPetStatusKinds', 'targetOwnerStatusKinds', 'targetStatusFromSourceOwnerKinds', 'targetAbsentStatusKinds', 'resolvedStatusKinds', 'foundationPassives', 'grantSkills', 'passives'].includes(key) && Array.isArray(value) ? value : [];
    for (const ref of refs) if (typeof ref === 'string' && ref.startsWith('xiaoyue.') && !ids.has(ref)) issue([...path, key], '引用不存在：' + ref);
    if (key === 'kind' && path.at(-1) === 'targetOwnedStatus' && typeof value === 'string' && value.startsWith('xiaoyue.') && !ids.has(value))
      issue([...path, key], '引用不存在：' + value);
    validateXiaoyueReferences(value, ids, issue, [...path, key]);
  }
}

export function loadXiaoyueCombatPack(data: unknown) {
  const parsed = XiaoyueCombatPackShape.superRefine((pack, ctx) => {
    const issue = (path: (string | number)[], message: string) => ctx.addIssue({ code: 'custom', path, message });
    const entries = [...pack.skills, ...pack.statuses];
    const ids = new Set(entries.map(entry => entry.id));
    if (ids.size !== entries.length) issue([], '重复 ID');
    for (const id of pack.baseSkillIds) if (!pack.skills.some(skill => skill.id === id)) issue(['baseSkillIds'], '技能引用不存在：' + id);
    if (new Set(pack.baseSkillIds).size !== pack.baseSkillIds.length) issue(['baseSkillIds'], '重复技能引用');
    for (const skill of pack.skills) {
      try { sectSkillLearning(skill.id); } catch { issue(['skills', skill.id], '缺少学习关系'); }
      if (!skill.effects.length && !skill.modifiers?.length && !skill.hooks?.length) issue(['skills', skill.id], '技能缺少实际效果');
    }
    validateXiaoyueReferences(pack, new Set([...ids, ...rawPaths.passives.map(passive => passive.id)]), issue);
    validateSectExpressions(pack, issue);
  }).safeParse(data);
  if (!parsed.success) throw new Error(formatContentPackErrors('content/data/xiaoyue-combat.json', data, parsed.error.issues));
  return parsed.data;
}

export function compileXiaoyueCombatPack(pack: ReturnType<typeof loadXiaoyueCombatPack>) {
  const skills: SectSkillDefV6[] = pack.skills.map(definition => ({ ...sectSkillLearning(definition.id), kind: definition.tags.includes(SkillTag.Passive) ? 'passive' : 'active', definition: definition satisfies SkillDef }));
  const skill = (id: string): SectSkillDefV6 => {
    const found = skills.find(entry => entry.definition.id === id);
    if (!found) throw new Error('xiaoyue-combat: 技能引用不存在：' + id);
    return found;
  };
  return { skills, baseSkills: pack.baseSkillIds.map(skill), skill, statuses: pack.statuses satisfies StatusDef[] };
}

export const XIAOYUE_COMBAT = compileXiaoyueCombatPack(loadXiaoyueCombatPack(raw));
