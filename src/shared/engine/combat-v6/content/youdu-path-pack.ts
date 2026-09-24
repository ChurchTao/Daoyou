import { ydHook as hook, ydModifier } from './youdu-shapes';
import { formatContentPackErrors } from '@shared/lib/content-pack-errors';
import { z } from 'zod';
import { ATTR_NAMES, SkillTag, TargetSide } from '../core';
import { sectSkillLearning } from './skill-learning';
import { YOUDU_COMBAT } from './youdu-pack';
import { validateSectExpressions } from './authoring-expressions';
import type { SectPathDefV6, SectSkillDefV6 } from './types';
import raw from './data/youdu-paths.json';

const id = z.string().regex(/^youdu\.[a-z][a-z0-9_.]*$/);
const ids = z.array(id);
const number = z.number().min(0).max(10000);
const expression = z.union([number, z.string().min(1).max(200)]);
const text = z.string().min(1).max(200);
const panel = z.array(z.strictObject({ attr: z.enum(ATTR_NAMES), mode: z.enum(['add', 'multiply']), value: number }));
const patch = z.discriminatedUnion('operation', [
  z.strictObject({ skillId: id, operation: z.literal('includeDownedTargets'), value: z.boolean() }),
  z.strictObject({ skillId: id, operation: z.literal('setStatusDuration'), statusId: id, value: expression }),
  z.strictObject({ skillId: id, operation: z.literal('replaceStatusId'), from: id, to: id }),
]);
export const YouduPathsPackShape = z.strictObject({
  $schema: z.string().optional(), formatVersion: z.literal(1),
  contentRevision: z.number().int().positive(),
  passives: z.array(z.strictObject({ id, name: text, description: text.optional(), hooks: z.array(hook).optional(), modifiers: z.array(ydModifier).optional() })).min(1),
  paths: z.array(z.strictObject({
    id, name: text, requiresConnectedNodes: z.boolean(), revokeSkillIds: ids.optional(), foundationPassives: ids, grantSkills: ids.optional(),
    nodes: z.array(z.strictObject({
      id, name: text, layer: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5), z.literal(6), z.literal(7)]),
      slot: z.union([z.literal(1), z.literal(2), z.literal(3)]), description: text,
      automatic: z.boolean().optional(), revokeSkillIds: ids.optional(), panel: panel.optional(), patches: z.array(patch).optional(),
      passives: ids.optional(), grantSkills: ids.optional(),
    })).length(21),
  })).length(2),
});

export function loadYouduPathsPack(data: unknown) {
  const result = YouduPathsPackShape.superRefine((pack, ctx) => {
    const issue = (path: (string | number)[], message: string) => ctx.addIssue({ code: 'custom', path, message });
    const all = new Set<string>();
    const passiveIds = new Set(pack.passives.map(p => p.id));
    const usedPassives = new Set<string>();
    const statusIds = new Set(YOUDU_COMBAT.statuses.map(s => s.id));
    const statusKinds = new Set(YOUDU_COMBAT.statuses.map(s => s.kind));
    function unique(id: string, path: (string | number)[]) {
      if (all.has(id)) issue(path, '重复 ID：' + id);
      all.add(id);
    }
    function references(value: unknown, path: (string | number)[]) {
      if (Array.isArray(value)) { value.forEach((v, i) => references(v, [...path, i])); return; }
      if (!value || typeof value !== 'object') return;
      for (const [key, child] of Object.entries(value)) {
        const check = (ids: string[], valid: (id: string) => boolean) => {
          for (const id of ids) if (!valid(id)) issue([...path, key], '引用不存在：' + id);
        };
        const skillExists = (id: string) => { if (id === 'dao_equipment.skill.diefeng') return true; try { YOUDU_COMBAT.skill(id); return true; } catch { return false; } };
        if (['statusId', 'from', 'to'].includes(key)) check([child as string], id => statusIds.has(id));
        if (['statusIds', 'requireStatusIds'].includes(key)) check(child as string[], id => statusIds.has(id));
        if (['targetStatusKinds', 'targetAbsentStatusKinds', 'primaryTargetStatusKinds'].includes(key)) check(child as string[], id => statusKinds.has(id) || id === 'beast.poison');
        if (key === 'skillId') check([child as string], skillExists);
        if (['skillIds', 'grantSkills'].includes(key)) check(child as string[], skillExists);
        if (['foundationPassives', 'passives'].includes(key) && Array.isArray(child) && child.every(v => typeof v === 'string')) {
          check(child, id => passiveIds.has(id));
          child.forEach(id => usedPassives.add(id));
        }
        references(child, [...path, key]);
      }
    }
    pack.passives.forEach((passive, i) => {
      unique(passive.id, ['passives', i, 'id']);
      try { sectSkillLearning(passive.id); } catch { issue(['passives', i, passive.id], '缺少学习关系'); }
    });
    pack.paths.forEach((path, i) => {
      unique(path.id, ['paths', i, 'id']);
      const slots = new Set<string>();
      path.nodes.forEach((node, j) => {
        unique(node.id, ['paths', i, 'nodes', j, 'id']);
        const key = node.layer + '.' + node.slot;
        if (slots.has(key)) issue(['paths', i, 'nodes', j], '层级槽位重复：' + node.id);
        slots.add(key);

      });
    });
    references(pack, []);
    for (const id of passiveIds) if (!usedPassives.has(id)) issue(['passives', id], '被动未被任何流派或节点引用');
    validateSectExpressions(pack, issue);
  }).safeParse(data);
  if (!result.success) throw new Error(formatContentPackErrors('content/data/youdu-paths.json', data, result.error.issues));
  return data as z.infer<typeof YouduPathsPackShape>;
}

export function compileYouduPaths(pack: ReturnType<typeof loadYouduPathsPack>): [SectPathDefV6, SectPathDefV6] {
  const passives = new Map(pack.passives.map(p => [p.id, {
    ...sectSkillLearning(p.id), kind: 'passive',
    definition: { id: p.id, name: p.name, description: p.description, tags: [SkillTag.Passive], targeting: { side: TargetSide.Self }, effects: [], hooks: p.hooks, modifiers: p.modifiers },
  } satisfies SectSkillDefV6]));
  const passive = (id: string) => passives.get(id)!;
  const paths = pack.paths.map(path => ({
    ...path, foundationPassives: path.foundationPassives.map(passive),
    grantSkills: path.grantSkills?.map(YOUDU_COMBAT.skill),
    nodes: path.nodes.map(node => {
      const { id, name, passives: passiveRefs, grantSkills: grantRefs, ...rest } = node;
      const compiled = { id, name, pathId: path.id, ...rest };
      return { ...compiled,
        ...(passiveRefs ? { passives: passiveRefs.map(passive) } : {}),
        ...(grantRefs ? { grantSkills: grantRefs.map(YOUDU_COMBAT.skill) } : {}),
      };
    }),
  }));
  return [paths[0], paths[1]];
}
export const YOUDU_PATHS = compileYouduPaths(loadYouduPathsPack(raw));
