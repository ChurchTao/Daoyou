import { formatContentPackErrors } from '@shared/lib/content-pack-errors';
import { z } from 'zod';
import raw from './data/skill-learning.json';
import { SECT_METHODS } from './method-pack';
import type { SectDefinitionV6 } from './types';

export const SectSkillLearningShape = z.strictObject({
  $schema: z.string().optional(),
  formatVersion: z.literal(1),
  contentRevision: z.number().int().positive(),
  skills: z.record(z.string().regex(/^[a-z]+\.(skill|passive)\.[a-z0-9_.]+$/), z.strictObject({
    sourceMethodId: z.string().min(1),
    unlockMethodLevel: z.number().int().min(0).max(180),
  })),
});
export function loadSectSkillLearning(data: unknown) {
  const methods = new Set(Object.values(SECT_METHODS).flatMap(entries => entries.map(m => m.id)));
  const result = SectSkillLearningShape.superRefine((pack, ctx) => {
    for (const [id, rule] of Object.entries(pack.skills)) {
      if (!methods.has(rule.sourceMethodId) || rule.sourceMethodId.split('.')[0] !== id.split('.')[0])
        ctx.addIssue({ code: 'custom', path: ['skills', id, 'sourceMethodId'], message: '必须引用同宗门已有心法' });
    }
  }).safeParse(data);
  if (!result.success) throw new Error(formatContentPackErrors('content/data/skill-learning.json', data, result.error.issues));
  return result.data;
}
export const SECT_SKILL_LEARNING = loadSectSkillLearning(raw);
export function sectSkillLearning(id: string, pack = SECT_SKILL_LEARNING) {
  const rule = pack.skills[id];
  if (!rule) throw new Error('content/data/skill-learning.json: skills.' + id + ': 缺少技能归属与解锁配置');
  return rule;
}

export function validateSectSkillLearningContent(definitions: SectDefinitionV6[]) {
  const ids = new Set(definitions.flatMap(d => [
    ...d.skills, ...d.paths.flatMap(p => [
      ...(p.foundationPassives ?? []), ...(p.grantSkills ?? []),
      ...p.nodes.flatMap(n => [...(n.passives ?? []), ...(n.grantSkills ?? [])]),
    ]),
  ]).map(skill => skill.definition.id));
  for (const id of Object.keys(SECT_SKILL_LEARNING.skills)) {
    if (!ids.has(id)) throw new Error('content/data/skill-learning.json: skills.' + id + ': 引用的技能不存在');
  }
  for (const id of ids) sectSkillLearning(id);
}
