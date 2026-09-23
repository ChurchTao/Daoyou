import { formatContentPackErrors } from '@shared/lib/content-pack-errors';
import { z } from 'zod';
import { ATTR_NAMES } from '../core';
import { validateSectExpressions } from './authoring-expressions';
import raw from './data/tianyan-paths.json';
import { sectSkillLearning } from './skill-learning';
import {
  TIANYAN_FOUNDATION,
  validateTianyanReferences,
} from './tianyan-foundation';
import { tyId, tyModifier } from './tianyan-shapes';
import { TIANYAN_SKILLS } from './tianyan-skill-pack';
import type { SectPathDefV6, SectSkillDefV6 } from './types';
export const TianyanPathsShape = z.strictObject({
  $schema: z.string().optional(),
  formatVersion: z.literal(1),
  contentRevision: z.number().int().positive(),
  passives: z.array(
    z.strictObject({
      id: tyId,
      name: z.string().min(1),
      description: z.string().min(1),
      modifiers: z.array(tyModifier).optional(),
    }),
  ),
  paths: z
    .array(
      z.strictObject({
        id: tyId,
        name: z.string().min(1),
        requiresConnectedNodes: z.literal(true),
        foundationPassives: z.array(tyId),
        nodes: z
          .array(
            z.strictObject({
              id: tyId,
              name: z.string().min(1),
              description: z.string().min(1),
              layer: z.number().int().min(1).max(7),
              slot: z.number().int().min(1).max(3),
              automatic: z.boolean().optional(),
              panel: z
                .array(
                  z.strictObject({
                    attr: z.enum(ATTR_NAMES),
                    mode: z.enum(['add', 'multiply']),
                    value: z.number().finite(),
                  }),
                )
                .optional(),
              passives: z.array(tyId),
              grantSkills: z.array(tyId).optional(),
              patches: z
                .array(
                  z.strictObject({
                    skillId: tyId,
                    operation: z.literal('setCooldownRounds'),
                    value: z.number().int().positive(),
                  }),
                )
                .optional(),
            }),
          )
          .length(21),
      }),
    )
    .length(2),
});
export function loadTianyanPaths(data: unknown) {
  const result = TianyanPathsShape.superRefine((pack, ctx) => {
    const issue = (path: (string | number)[], message: string) =>
      ctx.addIssue({ code: 'custom', path, message });
    const ids = [
      ...pack.passives,
      ...pack.paths,
      ...pack.paths.flatMap((p) => p.nodes),
    ].map((p) => p.id);
    if (new Set(ids).size !== ids.length) issue([], '重复 ID');
    const skills = new Set(TIANYAN_SKILLS.skills.map((s) => s.definition.id));
    const used = new Set<string>();
    pack.paths.forEach((p) => {
      if (new Set(p.nodes.map((n) => n.layer + '.' + n.slot)).size !== 21)
        issue(['paths', p.id], '层级槽位重复');
      if (p.nodes.some((n) => Boolean(n.automatic) !== (n.layer === 7 && n.slot !== 2)))
        issue(['paths', p.id], '末端奖励位置不正确');
      for (const id of [
        ...p.foundationPassives,
        ...p.nodes.flatMap((n) => n.passives),
      ]) {
        used.add(id);
        if (!pack.passives.some((s) => s.id === id))
          issue(['paths', p.id], '被动引用不存在：' + id);
      }
      for (const n of p.nodes)
        for (const id of [
          ...(n.grantSkills ?? []),
          ...(n.patches ?? []).map((p) => p.skillId),
        ])
          if (!skills.has(id)) issue(['paths', n.id], '技能引用不存在：' + id);
    });
    for (const p of pack.passives) {
      if (!used.has(p.id)) issue(['passives', p.id], '被动未引用');
      try {
        sectSkillLearning(p.id);
      } catch {
        issue(['passives', p.id], '缺少学习关系');
      }
    }
    validateTianyanReferences(
      pack,
      new Set(TIANYAN_FOUNDATION.statuses.map((s) => s.id)),
      issue,
    );
    validateSectExpressions(pack, issue);
  }).safeParse(data);
  if (!result.success)
    throw new Error(
      formatContentPackErrors(
        'content/data/tianyan-paths.json',
        data,
        result.error.issues,
      ),
    );
  return result.data;
}
export function compileTianyanPaths(
  pack: ReturnType<typeof loadTianyanPaths>,
): [SectPathDefV6, SectPathDefV6] {
  const passives = new Map(
    pack.passives.map((p) => [
      p.id,
      {
        ...sectSkillLearning(p.id),
        kind: 'passive',
        definition: {
          ...p,
          tags: ['passive'],
          targeting: { side: 'self' },
          effects: [],
        },
      } satisfies SectSkillDefV6,
    ]),
  );
  const paths = pack.paths.map((p) => ({
    ...p,
    foundationPassives: p.foundationPassives.map((id) => passives.get(id)!),
    nodes: p.nodes.map((n) => ({
      ...n,
      pathId: p.id,
      layer: n.layer as 1 | 2 | 3 | 4 | 5 | 6 | 7,
      slot: n.slot as 1 | 2 | 3,
      passives: n.passives.map((id) => passives.get(id)!),
      grantSkills: n.grantSkills?.map(TIANYAN_SKILLS.skill),
    })),
  }));
  return [paths[0], paths[1]];
}
export const TIANYAN_PATHS = compileTianyanPaths(loadTianyanPaths(raw));
