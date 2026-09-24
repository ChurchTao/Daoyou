import { formatContentPackErrors } from '@shared/lib/content-pack-errors';
import { z } from 'zod';
import {
  FormulaFamily,
  SkillTag,
  type SkillDef,
  type StatusDef,
} from '../core';
import { validateSectExpressions } from './authoring-expressions';
import raw from './data/wuxiang-combat.json';
import { sectSkillLearning } from './skill-learning';
import type { SectSkillDefV6 } from './types';
import {
  wxEffect,
  wxExpr,
  wxHook,
  wxId,
  wxModifier,
  wxStatus,
  wxTargeting,
} from './wuxiang-shapes';

export const WuxiangCombatPackShape = z.strictObject({
  $schema: z.string().optional(),
  formatVersion: z.literal(1),
  contentRevision: z.number().int().positive(),
  baseSkillIds: z.array(wxId).min(1),
  skills: z
    .array(
      z.strictObject({
        id: wxId,
        name: z.string().min(1),
        school: z.literal('wuxiang'),
        description: z.string().min(1),
        costMp: wxExpr.optional(),
        requirement: wxExpr.optional(),
        resourceCosts: z
          .array(
            z.strictObject({ resourceId: z.string().min(1), amount: wxExpr }),
          )
          .optional(),
        cooldownRounds: z.number().int().positive().optional(),
        initialCooldownRounds: z.number().int().nonnegative().optional(),
        tags: z.array(z.enum(SkillTag)).min(1),
        formula: z.enum(FormulaFamily).optional(),
        targeting: wxTargeting,
        effects: z.array(wxEffect),
        successEffects: z.array(wxEffect).optional(),
        hooks: z.array(wxHook).optional(),
        modifiers: z.array(wxModifier).optional(),
      }),
    )
    .min(1),
  statuses: z.array(wxStatus).min(1),
  resources: z
    .array(
      z.strictObject({
        id: wxId,
        name: z.string().min(1),
        current: z.number().int().nonnegative(),
        max: z.number().int().positive(),
      }),
    )
    .min(1),
});
export function loadWuxiangCombatPack(data: unknown) {
  const result = WuxiangCombatPackShape.superRefine((pack, ctx) => {
    const issue = (path: (string | number)[], message: string) =>
      ctx.addIssue({ code: 'custom', path, message });
    const all = [...pack.skills, ...pack.statuses, ...pack.resources].map(
      (x) => x.id,
    );
    if (new Set(all).size !== all.length) issue([], '重复 ID');
    for (const id of pack.baseSkillIds)
      if (!pack.skills.some((s) => s.id === id))
        issue(['baseSkillIds'], '技能引用不存在：' + id);
    if (new Set(pack.baseSkillIds).size !== pack.baseSkillIds.length)
      issue(['baseSkillIds'], '重复技能引用');
    for (const r of pack.resources)
      if (r.current > r.max) issue(['resources', r.id], '初始值超过上限');
    for (const skill of pack.skills) {
      try {
        sectSkillLearning(skill.id);
      } catch {
        issue(['skills', skill.id], '缺少学习关系');
      }
    }
    validateWuxiangReferences(pack, new Set(all), issue);
    validateSectExpressions(pack, issue);
  }).safeParse(data);
  if (!result.success)
    throw new Error(
      formatContentPackErrors(
        'content/data/wuxiang-combat.json',
        data,
        result.error.issues,
      ),
    );
  return result.data;
}
export function validateWuxiangReferences(
  data: unknown,
  ids: Set<string>,
  issue: (path: (string | number)[], message: string) => void,
  path: (string | number)[] = [],
) {
  if (Array.isArray(data)) {
    data.forEach((v, i) =>
      validateWuxiangReferences(v, ids, issue, [...path, i]),
    );
    return;
  }
  if (!data || typeof data !== 'object') return;
  for (const [key, value] of Object.entries(data)) {
    const refs = ['statusId', 'skillId', 'resourceId'].includes(key)
      ? [value]
      : [
            'statusIds',
            'requireStatusIds',
            'requireAbsentStatusIds',
            'grantSkills',
            'foundationPassives',
            'resources',
            'passives',
          ].includes(key) &&
          Array.isArray(value) &&
          value.every((v) => typeof v === 'string')
        ? value
        : [];
    for (const ref of refs)
      if (
        typeof ref === 'string' &&
        ref.startsWith('wuxiang.') &&
        !ids.has(ref)
      )
        issue([...path, key], '引用不存在：' + ref);
    validateWuxiangReferences(value, ids, issue, [...path, key]);
  }
}
export function compileWuxiangCombatPack(
  pack: ReturnType<typeof loadWuxiangCombatPack>,
) {
  const skills: SectSkillDefV6[] = pack.skills.map((definition) => ({
    ...sectSkillLearning(definition.id),
    kind: definition.tags.includes('passive') ? 'passive' : 'active',
    definition: definition satisfies SkillDef,
  }));
  const skill = (id: string): SectSkillDefV6 => {
    const found = skills.find((s) => s.definition.id === id);
    if (!found) throw new Error('wuxiang-combat: 技能引用不存在：' + id);
    return found;
  };
  return {
    skills,
    baseSkills: pack.baseSkillIds.map(skill),
    skill,
    statuses: pack.statuses satisfies StatusDef[],
    resources: pack.resources,
  };
}
export const WUXIANG_COMBAT = compileWuxiangCombatPack(
  loadWuxiangCombatPack(raw),
);
