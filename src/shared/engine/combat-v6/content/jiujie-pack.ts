import { formatContentPackErrors } from '@shared/lib/content-pack-errors';
import { z } from 'zod';
import {
  FormulaFamily,
  SkillTag,
  type SkillDef,
  type StatusDef,
} from '../core';
import { validateSectExpressions } from './authoring-expressions';
import raw from './data/jiujie-combat.json';
import { sectSkillLearning } from './skill-learning';
import type { SectSkillDefV6 } from './types';
import {
  jjEffect,
  jjExpr,
  jjHook,
  jjId,
  jjModifier,
  jjStatus,
  jjTargeting,
} from './jiujie-shapes';

export const JiujieCombatShape = z.strictObject({
  $schema: z.string().optional(),
  formatVersion: z.literal(1),
  contentRevision: z.number().int().positive(),
  baseSkillIds: z.array(jjId).min(1),
  skills: z
    .array(
      z.strictObject({
        id: jjId,
        name: z.string().min(1),
        school: z.literal('jiujie'),
        description: z.string().min(1),
        costMp: jjExpr.optional(),
        costHp: jjExpr.optional(),
        sealBase: z.number().optional(),
        requirement: jjExpr.optional(),
        resourceCosts: z
          .array(
            z.strictObject({ resourceId: z.string().min(1), amount: jjExpr }),
          )
          .optional(),
        cooldownRounds: z.number().int().positive().optional(),
        initialCooldownRounds: z.number().int().nonnegative().optional(),
        tags: z.array(z.enum(SkillTag)).min(1),
        formula: z.enum(FormulaFamily).optional(),
        targeting: jjTargeting,
        effects: z.array(jjEffect),
        successEffects: z.array(jjEffect).optional(),
        hooks: z.array(jjHook).optional(),
        modifiers: z.array(jjModifier).optional(),
      }),
    )
    .min(1),
  statuses: z.array(jjStatus).min(1),
  resources: z
    .array(
      z.strictObject({
        id: jjId,
        name: z.string().min(1),
        current: z.number().int().nonnegative(),
        max: z.number().int().positive().nullable(),
      }),
    )
    .min(1),
});
export function loadJiujieCombat(data: unknown) {
  const result = JiujieCombatShape.superRefine((pack, ctx) => {
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
      if (r.max !== null && r.current > r.max) issue(['resources', r.id], '初始值超过上限');
    for (const skill of pack.skills) {
      try {
        sectSkillLearning(skill.id);
      } catch {
        issue(['skills', skill.id], '缺少学习关系');
      }
    }
    validateJiujieReferences(pack, new Set(all), issue);
    validateSectExpressions(pack, issue);
  }).safeParse(data);
  if (!result.success)
    throw new Error(
      formatContentPackErrors(
        'content/data/jiujie-combat.json',
        data,
        result.error.issues,
      ),
    );
  return result.data;
}
export function validateJiujieReferences(
  data: unknown,
  ids: Set<string>,
  issue: (path: (string | number)[], message: string) => void,
  path: (string | number)[] = [],
) {
  if (Array.isArray(data)) {
    data.forEach((v, i) =>
      validateJiujieReferences(v, ids, issue, [...path, i]),
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
        ref.startsWith('jiujie.') &&
        !ids.has(ref)
      )
        issue([...path, key], '引用不存在：' + ref);
    validateJiujieReferences(value, ids, issue, [...path, key]);
  }
}
export function compileJiujieCombat(
  pack: ReturnType<typeof loadJiujieCombat>,
) {
  const skills: SectSkillDefV6[] = pack.skills.map((definition) => ({
    ...sectSkillLearning(definition.id),
    kind: definition.tags.includes('passive') ? 'passive' : 'active',
    definition: definition satisfies SkillDef,
  }));
  const skill = (id: string): SectSkillDefV6 => {
    const found = skills.find((s) => s.definition.id === id);
    if (!found) throw new Error('jiujie-combat: 技能引用不存在：' + id);
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
export const JIUJIE_COMBAT = compileJiujieCombat(
  loadJiujieCombat(raw),
);
