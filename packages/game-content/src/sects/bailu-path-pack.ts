import { z } from 'zod';
import { ATTR_NAMES } from '@daoyou/combat-core/constants';
import { SkillTag, TargetSide } from '@daoyou/combat-core/enums';
import { formatContentPackErrors } from '@daoyou/game-domain/content-pack-errors';
import type { SectPathDefV6, SectSkillDefV6 } from '@daoyou/game-domain/combat';
import { validateSectExpressions } from './authoring-expressions.js';
import { BAILU_COMBAT, validateBailuReferences } from './bailu-pack.js';
import { blHook, blId, blModifier } from './bailu-shapes.js';
import { sectSkillLearning } from './skill-learning.js';
import raw from './data/bailu-paths.json' with { type: 'json' };

export const BailuPathsPackShape = z.strictObject({
  $schema: z.string().optional(), formatVersion: z.literal(1), contentRevision: z.number().int().positive(),
  passives: z.array(z.strictObject({ id: blId, name: z.string().min(1), description: z.string().min(1), hooks: z.array(blHook).optional(), modifiers: z.array(blModifier).optional() })).min(1),
  paths: z.array(z.strictObject({
    id: blId, name: z.string().min(1), description: z.string().min(1), requiresConnectedNodes: z.literal(true),
    foundationPassives: z.array(blId), grantSkills: z.array(blId),
    nodes: z.array(z.strictObject({
      id: blId, name: z.string().min(1), description: z.string().min(1), layer: z.number().int().min(1).max(7), slot: z.number().int().min(1).max(3), automatic: z.boolean().optional(),
      passives: z.array(blId).optional(), grantSkills: z.array(blId).optional(),
      panel: z.array(z.strictObject({ attr: z.enum(ATTR_NAMES), mode: z.enum(['add', 'multiply']), value: z.number().finite() })).optional(),
      patches: z.array(z.strictObject({ skillId: blId, operation: z.literal('setCooldownRounds'), value: z.number().int().positive() })).optional(),
    })).length(21),
  })).length(2),
});

export function loadBailuPathsPack(data: unknown) {
  const result = BailuPathsPackShape.superRefine((pack, ctx) => {
    const issue = (path: (string | number)[], message: string) => ctx.addIssue({ code: 'custom', path, message });
    const ids = [...pack.passives, ...pack.paths, ...pack.paths.flatMap(path => path.nodes)].map(entry => entry.id);
    if (new Set(ids).size !== ids.length) issue([], '重复 ID');
    const all = new Set([...ids, ...BAILU_COMBAT.skills.map(skill => skill.definition.id), ...BAILU_COMBAT.statuses.map(status => status.id)]);
    validateBailuReferences(pack, all, issue);
    const used = new Set(pack.paths.flatMap(path => [...path.foundationPassives, ...path.nodes.flatMap(node => node.passives ?? [])]));
    for (const passive of pack.passives) {
      if (!used.has(passive.id)) issue(['passives', passive.id], '被动未引用');
      try { sectSkillLearning(passive.id); } catch { issue(['passives', passive.id], '缺少技能学习关系'); }
      if (!passive.modifiers?.length && !passive.hooks?.length) issue(['passives', passive.id], '被动缺少实际效果');
    }
    for (const path of pack.paths) {
      if (new Set(path.nodes.map(node => node.layer + '.' + node.slot)).size !== 21) issue(['paths', path.id], '层级槽位重复');
      if (path.nodes.some(node => Boolean(node.automatic) !== (node.layer === 7 && node.slot !== 2))) issue(['paths', path.id], '末端奖励位置不正确');
      for (const node of path.nodes) if (!node.passives?.length && !node.grantSkills?.length && !node.panel?.length && !node.patches?.length) issue(['paths', path.id, node.id], '经脉节点缺少实际效果');
    }
    validateSectExpressions(pack, issue);
  }).safeParse(data);
  if (!result.success) throw new Error(formatContentPackErrors('content/data/bailu-paths.json', data, result.error.issues));
  return result.data;
}

export function compileBailuPathsPack(pack: ReturnType<typeof loadBailuPathsPack>): [SectPathDefV6, SectPathDefV6] {
  const passives = new Map(pack.passives.map(passive => [passive.id, {
    ...sectSkillLearning(passive.id), kind: 'passive', definition: { ...passive, tags: [SkillTag.Passive], targeting: { side: TargetSide.Self }, effects: [] },
  } satisfies SectSkillDefV6]));
  const paths = pack.paths.map(path => ({
    ...path, foundationPassives: path.foundationPassives.map(id => passives.get(id)!), grantSkills: path.grantSkills.map(BAILU_COMBAT.skill),
    nodes: path.nodes.map(node => ({ ...node, pathId: path.id, layer: node.layer as 1 | 2 | 3 | 4 | 5 | 6 | 7, slot: node.slot as 1 | 2 | 3, passives: node.passives?.map(id => passives.get(id)!), grantSkills: node.grantSkills?.map(BAILU_COMBAT.skill) })),
  }));
  return [paths[0], paths[1]];
}
export const BAILU_PATHS = compileBailuPathsPack(loadBailuPathsPack(raw));
