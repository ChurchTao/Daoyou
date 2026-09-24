import { formatContentPackErrors } from '@shared/lib/content-pack-errors';
import { z } from 'zod';
import { ATTR_NAMES, SkillTag, TargetSide } from '../core';
import { validateSectExpressions } from './authoring-expressions';
import raw from './data/jiujie-paths.json';
import { sectSkillLearning } from './skill-learning';
import type { SectPathDefV6, SectSkillDefV6 } from './types';
import { JIUJIE_COMBAT, validateJiujieReferences } from './jiujie-pack';
import { jjHook, jjId, jjModifier } from './jiujie-shapes';

export const JiujiePathsShape = z.strictObject({
  $schema: z.string().optional(),
  formatVersion: z.literal(1),
  contentRevision: z.number().int().positive(),
  passives: z.array(
    z.strictObject({
      id: jjId,
      name: z.string().min(1),
      description: z.string().optional(),
      hooks: z.array(jjHook).optional(),
      modifiers: z.array(jjModifier).optional(),
      innate: z.strictObject({ negativeSpellResistance: z.number().min(0).max(1) }).optional(),
    }),
  ),
  paths: z
    .array(
      z.strictObject({
        id: jjId,
        name: z.string().min(1),
        requiresConnectedNodes: z.literal(true),
        unitTags: z.array(z.string()).optional(),
        foundationPassives: z.array(jjId),
        grantSkills: z.array(jjId),
        resources: z.array(jjId),
        nodes: z
          .array(
            z.strictObject({
              id: jjId,
              name: z.string().min(1),
              layer: z.number().int().min(1).max(7),
              slot: z.number().int().min(1).max(3),
              description: z.string().min(1),
              patches: z
                .array(
                  z.strictObject({
                    skillId: jjId,
                    operation: z.literal('setCooldownRounds'),
                    value: z.number().int().positive(),
                  }),
                )
                .optional(),
              automatic: z.boolean().optional(),
              passives: z.array(jjId).optional(),
              grantSkills: z.array(jjId).optional(),
              revokeSkillIds: z.array(jjId).optional(),
              panel: z
                .array(
                  z.strictObject({
                    attr: z.enum(ATTR_NAMES),
                    mode: z.enum(['add', 'multiply']),
                    value: z.number().finite(),
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
export function loadJiujiePaths(data: unknown) {
  const result = JiujiePathsShape.superRefine((pack, ctx) => {
    const issue = (path: (string | number)[], message: string) =>
      ctx.addIssue({ code: 'custom', path, message });
    const own = [
      ...pack.passives,
      ...pack.paths,
      ...pack.paths.flatMap((p) => p.nodes),
    ].map((x) => x.id);
    if (new Set(own).size !== own.length) issue([], '重复 ID');
    const all = new Set([
      ...own,
      ...JIUJIE_COMBAT.skills.map((s) => s.definition.id),
      ...JIUJIE_COMBAT.statuses.map((s) => s.id),
      ...JIUJIE_COMBAT.resources.map((r) => r.id),
    ]);
    validateJiujieReferences(pack, all, issue);
    const used = new Set(
      pack.paths.flatMap((p) => [
        ...p.foundationPassives,
        ...p.nodes.flatMap((n) => n.passives ?? []),
      ]),
    );
    for (const p of pack.passives) {
      if (!used.has(p.id)) issue(['passives', p.id], '被动未引用');
      try {
        sectSkillLearning(p.id);
      } catch {
        issue(['passives', p.id], '缺少学习关系');
      }
    }
    for (const p of pack.paths) {
      if (new Set(p.nodes.map((n) => n.layer + '.' + n.slot)).size !== 21)
        issue(['paths', p.id], '层级槽位重复');
      if (
        p.nodes.filter((n) => n.automatic).length !== 2 ||
        p.nodes.some(
          (n) => Boolean(n.automatic) !== (n.layer === 7 && n.slot !== 2),
        )
      )
        issue(['paths', p.id], '末端奖励位置不正确');
    }
    validateSectExpressions(pack, issue);
  }).safeParse(data);
  if (!result.success)
    throw new Error(
      formatContentPackErrors(
        'content/data/jiujie-paths.json',
        data,
        result.error.issues,
      ),
    );
  return result.data;
}
export function compileJiujiePaths(
  pack: ReturnType<typeof loadJiujiePaths>,
): [SectPathDefV6, SectPathDefV6] {
  const passives = new Map(
    pack.passives.map((p) => [
      p.id,
      {
        ...sectSkillLearning(p.id),
        kind: 'passive',
        definition: {
          ...p,
          tags: [SkillTag.Passive],
          targeting: { side: TargetSide.Self },
          effects: [],
        },
      } satisfies SectSkillDefV6,
    ]),
  );
  const paths = pack.paths.map((p) => ({
    ...p,
    foundationPassives: p.foundationPassives.map((id) => passives.get(id)!),
    grantSkills: p.grantSkills.map(JIUJIE_COMBAT.skill),
    resources: p.resources.map((id) =>
      JIUJIE_COMBAT.resources.find((r) => r.id === id)!,
    ),
    nodes: p.nodes.map((n) => ({
      ...n,
      layer: n.layer as 1 | 2 | 3 | 4 | 5 | 6 | 7,
      slot: n.slot as 1 | 2 | 3,
      pathId: p.id,
      passives: n.passives?.map((id) => passives.get(id)!),
      grantSkills: n.grantSkills?.map(JIUJIE_COMBAT.skill),
    })),
  }));
  return [paths[0], paths[1]];
}
export const JIUJIE_PATHS = compileJiujiePaths(loadJiujiePaths(raw));
