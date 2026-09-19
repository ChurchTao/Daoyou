import { formatContentPackErrors } from '@shared/lib/content-pack-errors';
import { z } from 'zod';
import { ATTR_NAMES, DamageKind, DamageOrigin, EffectType, HookAim, HookName, SkillTag, TargetSide } from '../core';
import { JIUJIE_COMBAT } from './jiujie-pack';
import { sectSkillLearning } from './skill-learning';
import { validateSectExpressions } from './authoring-expressions';
import type { MeridianNodeDefV6, SectPathDefV6, SectSkillDefV6 } from './types';
import raw from './data/jiujie-paths.json';

const id = z.string().regex(/^jiujie\.[a-z][a-z0-9_.]*$/);
const ids = z.array(id);
const number = z.number().min(0).max(10000);
const ratio = number.max(1);
const expression = z.union([number, z.string().min(1).max(200)]);
const text = z.string().min(1).max(200);
const duration = number.int().min(1).max(99);
const panel = z.array(z.strictObject({ attr: z.enum(ATTR_NAMES), mode: z.enum(['add', 'multiply']), value: number }));
const effect = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal(EffectType.SpellHit), coeff: number, power: expression, when: z.strictObject({ targetSlot: z.literal('primary') }) }),
  z.strictObject({ type: z.literal(EffectType.ApplyStatus), statusId: id, duration, when: z.strictObject({ targetSlot: z.literal('primary') }) }),
]);
const hook = z.strictObject({
  on: z.enum([HookName.OnHitCalc, HookName.OnCritRoll, HookName.OnDefenseIgnoreCalc, HookName.AfterHit]),
  sourceIsSelf: z.boolean(), requireKind: z.enum(DamageKind).optional(), aim: z.enum(HookAim).optional(),
  when: z.strictObject({
    skillIds: ids, damageOrigins: z.array(z.enum(DamageOrigin)), requireKind: z.enum(DamageKind).optional(),
    targetHpRatioBelow: ratio.optional(), targetStatusKinds: ids.optional(),
    targetStatusStack: z.strictObject({ kind: id, min: number.int().min(1), max: number.int().min(1).optional() }).optional(),
  }),
  effects: z.array(z.discriminatedUnion('type', [
    z.strictObject({ type: z.literal(EffectType.ModifyStrike), factor: expression }),
    z.strictObject({ type: z.enum([EffectType.ModifyChance, EffectType.ModifyDefenseIgnore]), add: ratio }),
    z.strictObject({ type: z.literal(EffectType.RestoreHp), power: expression, maxGainPerAction: expression }),
  ])).min(1),
});
const patch = z.discriminatedUnion('operation', [
  z.strictObject({ skillId: id, operation: z.enum(['addSealBase', 'setSealBase']), value: number.max(100) }),
  z.strictObject({ skillId: id, operation: z.enum(['multiplyCostMp', 'multiplySpellCoefficients']), value: number }),
  z.strictObject({ skillId: id, operation: z.literal('setStatusDuration'), statusId: id, value: duration }),
  z.strictObject({ skillId: id, operation: z.literal('replaceStatusId'), from: id, to: id }),
  z.strictObject({ skillId: id, operation: z.literal('setRandomBranchChance'), branchId: id, value: ratio }),
  z.strictObject({ skillId: id, operation: z.literal('setRandomBranchFixedPower'), branchId: id, value: expression }),
  z.strictObject({ skillId: id, operation: z.literal('setTargetCount'), value: expression }),
  z.strictObject({ skillId: id, operation: z.literal('setSplash'), perTarget: ratio, floor: ratio }),
  z.strictObject({ skillId: id, operation: z.literal('appendEffect'), effect }),
]);
export const JiujiePathsShape = z.strictObject({
  $schema: z.string().optional(), formatVersion: z.literal(1), contentRevision: z.number().int().positive(),
  passives: z.array(z.strictObject({ id, name: text, hooks: z.array(hook).min(1) })).min(1),
  paths: z.array(z.strictObject({
    id, name: text, panel: panel.optional(), foundationPassives: ids, patches: z.array(patch), grantSkills: ids, resources: z.array(z.never()),
    nodes: z.array(z.strictObject({
      id, name: text, layer: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5), z.literal(6), z.literal(7)]),
      slot: z.union([z.literal(1), z.literal(2), z.literal(3)]), description: text, panel, patches: z.array(patch), passives: ids, grantSkills: ids,
    })).length(21),
  })).length(2),
});

export function loadJiujiePaths(data: unknown) {
  const result = JiujiePathsShape.superRefine((pack, ctx) => {
    const issue = (path: (string | number)[], message: string) => ctx.addIssue({ code: 'custom', path, message });
    const all = new Set<string>();
    const passiveIds = new Set(pack.passives.map(p => p.id));
    const usedPassives = new Set<string>();
    const statuses = new Set(JIUJIE_COMBAT.statuses.map(s => s.id));
    const kinds = new Set(JIUJIE_COMBAT.statuses.map(s => s.kind));
    const skills = new Set(JIUJIE_COMBAT.skills.map(s => s.definition.id));
    const unique = (id: string, path: (string | number)[]) => { if (all.has(id)) issue(path, '重复 ID：' + id); all.add(id); };
    function walk(value: unknown, path: (string | number)[]) {
      if (Array.isArray(value)) { value.forEach((v, i) => walk(v, [...path, i])); return; }
      if (!value || typeof value !== 'object') return;
      const record = value as Record<string, unknown>;
      for (const [key, child] of Object.entries(value)) {
        const check = (values: string[], allowed: Set<string>) => { for (const id of values) if (!allowed.has(id)) issue([...path, key], '引用不存在：' + id); };
        if (['statusId', 'from', 'to'].includes(key)) check([child as string], statuses);
        if (key === 'targetStatusKinds') check(child as string[], kinds);
        if (key === 'targetStatusStack') {
          const stack = child as { kind: string; min: number; max?: number };
          check([stack.kind], kinds);
          const maximum = Math.max(...JIUJIE_COMBAT.statuses.filter(s => s.kind === stack.kind).map(s => s.maxStacks ?? 1));
          if (stack.min > maximum || (stack.max !== undefined && (stack.max > maximum || stack.max < stack.min))) issue([...path, key], '状态层数条件无效');
        }
        if (key === 'skillId') check([child as string], skills);
        if (['skillIds', 'grantSkills'].includes(key)) check(child as string[], skills);
        if (key === 'branchId' && skills.has(record.skillId as string)) {
          const skill = JIUJIE_COMBAT.skill(record.skillId as string).definition;
          if (!skill.effects.some(e => e.type === EffectType.RandomBranch && e.branchId === child)) issue([...path, key], '技能概率分支不存在：' + child);
        }
        if (['passives', 'foundationPassives'].includes(key) && Array.isArray(child) && child.every(v => typeof v === 'string')) {
          check(child, passiveIds); child.forEach(id => usedPassives.add(id));
        }
        walk(child, [...path, key]);
      }
    }
    pack.passives.forEach((p, i) => { unique(p.id, ['passives', i, 'id']); try { sectSkillLearning(p.id); } catch { issue(['passives', i, p.id], '缺少学习关系'); } });
    pack.paths.forEach((p, i) => {
      unique(p.id, ['paths', i, 'id']);
      const slots = new Set<string>();
      p.nodes.forEach((n, j) => {
        unique(n.id, ['paths', i, 'nodes', j, 'id']);
        const slot = n.layer + '.' + n.slot;
        if (slots.has(slot)) issue(['paths', i, 'nodes', j, n.id], '层级槽位重复');
        slots.add(slot);
      });
    });
    walk(pack, []);
    for (const id of passiveIds) if (!usedPassives.has(id)) issue(['passives', id], '被动未被引用');
    validateSectExpressions(pack, issue);
  }).safeParse(data);
  if (!result.success) throw new Error(formatContentPackErrors('content/data/jiujie-paths.json', data, result.error.issues));
  return data as z.infer<typeof JiujiePathsShape>;
}
export function compileJiujiePaths(pack: ReturnType<typeof loadJiujiePaths>): [SectPathDefV6, SectPathDefV6] {
  const passives = new Map(pack.passives.map(p => [p.id, {
    ...sectSkillLearning(p.id), kind: 'passive',
    definition: { id: p.id, name: p.name, tags: [SkillTag.Passive], targeting: { side: TargetSide.Self }, effects: [], hooks: p.hooks },
  } satisfies SectSkillDefV6]));
  const passive = (id: string) => passives.get(id)!;
  const paths = pack.paths.map(path => ({
    id: path.id, name: path.name, ...(path.panel ? { panel: path.panel } : {}),
    nodes: path.nodes.map(node => {
      const { id, name, ...rest } = node;
      return { id, name, pathId: path.id, ...rest, passives: node.passives.map(passive), grantSkills: node.grantSkills.map(JIUJIE_COMBAT.skill) } satisfies MeridianNodeDefV6;
    }),
    foundationPassives: path.foundationPassives.map(passive), patches: path.patches,
    grantSkills: path.grantSkills.map(JIUJIE_COMBAT.skill), resources: path.resources,
  } satisfies SectPathDefV6));
  return [paths[0], paths[1]];
}
export const JIUJIE_PATHS = compileJiujiePaths(loadJiujiePaths(raw));
