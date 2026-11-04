import { z } from 'zod';
import { ATTR_NAMES } from '@daoyou/combat-core/constants';
import { SkillTag, TargetSide } from '@daoyou/combat-core/enums';
import { formatContentPackErrors } from '@daoyou/game-domain/content-pack-errors';
import type { SectPathDefV6, SectSkillDefV6 } from '@daoyou/game-domain/combat';
import { validateSectExpressions } from './authoring-expressions.js';
import { sectSkillLearning } from './skill-learning.js';
import { XIAOYUE_COMBAT, validateXiaoyueReferences } from './xiaoyue-pack.js';
import { xyHook, xyId, xyModifier } from './xiaoyue-shapes.js';
import raw from './data/xiaoyue-paths.json' with { type: 'json' };

export const XiaoyuePathsPackShape = z.strictObject({
  $schema: z.string().optional(), formatVersion: z.literal(1), contentRevision: z.number().int().positive(),
  passives: z.array(z.strictObject({ id: xyId, name: z.string().min(1), description: z.string().min(1), hooks: z.array(xyHook).optional(), modifiers: z.array(xyModifier).optional() })).min(1),
  paths: z.array(z.strictObject({
    id: xyId, name: z.string().min(1), description: z.string().min(1), requiresConnectedNodes: z.literal(true),
    foundationPassives: z.array(xyId), grantSkills: z.array(xyId), revokeSkillIds: z.array(xyId), resources: z.array(xyId),
    nodes: z.array(z.strictObject({
      id: xyId, name: z.string().min(1), description: z.string().min(1),
      layer: z.number().int().min(1).max(7), slot: z.number().int().min(1).max(3), automatic: z.boolean().optional(),
      passives: z.array(xyId).optional(), grantSkills: z.array(xyId).optional(),
      panel: z.array(z.strictObject({ attr: z.enum(ATTR_NAMES), mode: z.enum(['add', 'multiply']), value: z.number().finite() })).optional(),
    })).length(21),
  })).length(2),
});

export function loadXiaoyuePathsPack(data: unknown) {
  const parsed = XiaoyuePathsPackShape.superRefine((pack, ctx) => {
    const issue = (path: (string | number)[], message: string) => ctx.addIssue({ code: 'custom', path, message });
    const entries = [...pack.passives, ...pack.paths, ...pack.paths.flatMap(path => path.nodes)];
    if (new Set(entries.map(entry => entry.id)).size !== entries.length) issue([], '重复 ID');
    const all = new Set([...entries.map(entry => entry.id), ...XIAOYUE_COMBAT.skills.map(skill => skill.definition.id), ...XIAOYUE_COMBAT.statuses.map(status => status.id)]);
    validateXiaoyueReferences(pack, all, issue);
    const used = new Set(pack.paths.flatMap(path => [...path.foundationPassives, ...path.nodes.flatMap(node => node.passives ?? [])]));
    for (const passive of pack.passives) {
      if (!used.has(passive.id)) issue(['passives', passive.id], '被动未引用');
      try { sectSkillLearning(passive.id); } catch { issue(['passives', passive.id], '缺少学习关系'); }
      // A small number of nodes are read directly by a base skill or the path foundation.
      const formulaDriven = JSON.stringify([XIAOYUE_COMBAT.skills, pack.passives]).includes(`known.${passive.id}`);
      if (!passive.hooks?.length && !passive.modifiers?.length && !formulaDriven) issue(['passives', passive.id], '被动缺少实际效果');
    }
    for (const path of pack.paths) {
      if (!['xiaoyue.path.blood', 'xiaoyue.path.bond'].includes(path.id)) issue(['paths', path.id], '仅允许百相化形与灵兽同契两道途');
      if (new Set(path.nodes.map(node => `${node.layer}.${node.slot}`)).size !== 21) issue(['paths', path.id], '层级槽位重复');
      if (path.nodes.some(node => Boolean(node.automatic) !== (node.layer === 7 && node.slot !== 2))) issue(['paths', path.id], '末端奖励位置不正确');
      for (const node of path.nodes) {
        if (node.id !== `xiaoyue.node.${path.id.split('.').at(-1)}.${node.layer}.${node.slot}`) issue(['paths', path.id, node.id], '节点 ID 与道途坐标不符');
        if (!node.passives?.length && !node.grantSkills?.length && !node.panel?.length) issue(['paths', path.id, node.id], '经脉节点缺少实际效果');
      }
    }
    validateSectExpressions(pack, issue);
  }).safeParse(data);
  if (!parsed.success) throw new Error(formatContentPackErrors('content/data/xiaoyue-paths.json', data, parsed.error.issues));
  return parsed.data;
}

export function compileXiaoyuePathsPack(pack: ReturnType<typeof loadXiaoyuePathsPack>): [SectPathDefV6, SectPathDefV6] {
  const passives = new Map(pack.passives.map(passive => [passive.id, {
    ...sectSkillLearning(passive.id), kind: 'passive', definition: { ...passive, school: 'xiaoyue', tags: [SkillTag.Passive], targeting: { side: TargetSide.Self }, effects: [] },
  } satisfies SectSkillDefV6]));
  const paths = pack.paths.map(path => ({
    ...path, resources: [], foundationPassives: path.foundationPassives.map(id => passives.get(id)!),
    grantSkills: path.grantSkills.map(XIAOYUE_COMBAT.skill),
    nodes: path.nodes.map(node => ({ ...node, pathId: path.id, layer: node.layer as 1 | 2 | 3 | 4 | 5 | 6 | 7,
      slot: node.slot as 1 | 2 | 3, passives: node.passives?.map(id => passives.get(id)!), grantSkills: node.grantSkills?.map(XIAOYUE_COMBAT.skill) })),
  }));
  return [paths[0], paths[1]];
}

export const XIAOYUE_PATHS = compileXiaoyuePathsPack(loadXiaoyuePathsPack(raw));
