import { formatContentPackErrors } from '@shared/lib/content-pack-errors';
import { z } from 'zod';
import { ATTR_NAMES, DamageOrigin, EffectType, HookName, SkillTag, TargetMode, TargetSide, type SkillEffect } from '../core';
import { TIANYAN_FOUNDATION } from './tianyan-foundation';
import { TIANYAN_SKILLS } from './tianyan-skill-pack';
import { sectSkillLearning } from './skill-learning';
import { validateSectExpressions } from './authoring-expressions';
import type { MeridianNodeDefV6, SectPathDefV6, SectSkillDefV6, SkillPatchV6 } from './types';
import raw from './data/tianyan-paths.json';

const id = z.string().regex(/^tianyan\.[a-z][a-z0-9_.]*$/);
const ids = z.array(id);
const number = z.number().min(0).max(10000);
const ratio = number.max(1);
const expression = z.union([number, z.string().min(1).max(200)]);
const text = z.string().min(1).max(200);
const duration = number.int().min(1).max(99);
const reactionKind = z.enum(['generate', 'overcome']);
const targeting = z.strictObject({ side: z.enum(TargetSide), mode: z.enum(TargetMode), count: number.int().positive() });
const effect = z.discriminatedUnion('type', [
  z.strictObject({ type: z.enum([EffectType.Heal, EffectType.RemoveWound]), power: expression, targeting: targeting.optional() }),
  z.strictObject({ type: z.literal(EffectType.ApplyBarrier), id, kind: id, name: text, power: expression, duration, targeting: targeting.optional() }),
  z.strictObject({ type: z.literal(EffectType.ModifyResource), resourceId: id, amount: number.int() }),
]);
const hookEffect = z.discriminatedUnion('type', [
  z.strictObject({ type: z.enum([EffectType.ModifyHeal, EffectType.ModifyBarrier, EffectType.ModifyStrike]), factor: number }),
  z.strictObject({ type: z.enum([EffectType.ModifyChance, EffectType.ModifyDefenseIgnore]), add: ratio }),
]);
const hook = z.strictObject({
  on: z.enum([HookName.OnHealCalc, HookName.OnBarrierCalc, HookName.OnHitCalc, HookName.OnDefenseIgnoreCalc, HookName.OnCritRoll]),
  sourceIsSelf: z.boolean(),
  when: z.strictObject({ skillIds: ids, targetStatusIds: ids.optional(), targetHpRatioBelow: ratio.optional(), targetHpRatioAbove: ratio.optional(), damageOrigins: z.array(z.enum(DamageOrigin)).optional() }),
  effects: z.array(hookEffect).min(1),
});
const patchShape = z.discriminatedUnion('operation', [
  z.strictObject({ operation: z.literal('appendReactionEffect'), kind: reactionKind, effect }),
  z.strictObject({ operation: z.literal('multiplyReactionPower'), kind: reactionKind.optional(), value: number }),
  z.strictObject({ operation: z.literal('setAllBarrierDuration'), value: duration }),
  z.strictObject({ skillId: id, operation: z.enum(['appendEffect', 'prependEffect']), effect }),
  z.strictObject({ skillId: id, operation: z.enum(['multiplyHealPower', 'multiplyBarrierPower', 'multiplyRestoreMpPower', 'multiplySpellCoefficients']), value: number }),
  z.strictObject({ skillId: id, operation: z.enum(['setDispelMaxCount', 'setCopyStatusDurationAdd']), value: number.int().min(1).max(99) }),
  z.strictObject({ skillId: id, operation: z.literal('setSealBase'), value: number.max(100) }),
  z.strictObject({ skillId: id, operation: z.literal('setStatusDuration'), statusId: id, value: duration }),
  z.strictObject({ skillId: id, operation: z.literal('setBarrierDuration'), barrierId: id, value: duration }),
  z.strictObject({ skillId: id, operation: z.literal('replaceStatusId'), from: id, to: id }),
  z.strictObject({ skillId: id, operation: z.literal('setEffectTargetCount'), effectType: z.literal(EffectType.CopyStatus), value: number.int().min(1).max(99) }),
]);
export const TianyanPathsShape = z.strictObject({
  $schema: z.string().optional(), formatVersion: z.literal(1), contentRevision: z.number().int().positive(),
  passives: z.array(z.strictObject({ id, name: text, hooks: z.array(hook).min(1) })).min(1),
  barrierDurationTargets: z.array(z.strictObject({ skillId: id, barrierId: id })).min(1),
  paths: z.array(z.strictObject({
    id, name: text, foundationPassives: ids, grantSkills: ids, resources: ids,
    nodes: z.array(z.strictObject({
      id, name: text, layer: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5), z.literal(6), z.literal(7)]),
      slot: z.union([z.literal(1), z.literal(2), z.literal(3)]), description: text,
      panel: z.array(z.strictObject({ attr: z.enum(ATTR_NAMES), mode: z.enum(['add', 'multiply']), value: number })).optional(),
      passives: ids.optional(), grantSkills: ids.optional(), patches: z.array(patchShape).optional(),
    })).length(21),
  })).length(2),
});

export function loadTianyanPaths(data: unknown) {
  const result = TianyanPathsShape.superRefine((pack, ctx) => {
    const issue = (path: (string | number)[], message: string) => ctx.addIssue({ code: 'custom', path, message });
    const all = new Set<string>();
    const passiveIds = new Set(pack.passives.map(p => p.id));
    const usedPassives = new Set<string>();
    const statuses = new Set(TIANYAN_FOUNDATION.statuses.map(s => s.id));
    const resources = new Set(TIANYAN_FOUNDATION.resources.map(r => r.id));
    const skills = new Set(TIANYAN_SKILLS.skills.map(s => s.definition.id));
    const barriers = new Set(TIANYAN_SKILLS.skills.flatMap(s => s.definition.effects.filter(e => e.type === EffectType.ApplyBarrier).map(e => e.id)));
    for (const path of pack.paths) for (const node of path.nodes) for (const patch of node.patches ?? [])
      if ('effect' in patch && patch.effect.type === EffectType.ApplyBarrier) barriers.add(patch.effect.id);
    const unique = (id: string, path: (string | number)[]) => { if (all.has(id)) issue(path, '重复 ID：' + id); all.add(id); };
    function walk(value: unknown, path: (string | number)[]) {
      if (Array.isArray(value)) { value.forEach((v, i) => walk(v, [...path, i])); return; }
      if (!value || typeof value !== 'object') return;
      for (const [key, child] of Object.entries(value)) {
        const check = (values: string[], allowed: Set<string>) => { for (const id of values) if (!allowed.has(id)) issue([...path, key], '引用不存在：' + id); };
        if (['statusId', 'from', 'to'].includes(key)) check([child as string], statuses);
        if (key === 'targetStatusIds') check(child as string[], statuses);
        if (key === 'resourceId') check([child as string], resources);
        if (key === 'resources') check(child as string[], resources);
        if (key === 'skillId') check([child as string], skills);
        if (['skillIds', 'grantSkills'].includes(key)) check(child as string[], skills);
        if (key === 'barrierId') check([child as string], barriers);
        if (['passives', 'foundationPassives'].includes(key) && Array.isArray(child) && child.every(v => typeof v === 'string')) {
          check(child, passiveIds); child.forEach(id => usedPassives.add(id));
        }
        walk(child, [...path, key]);
      }
    }
    pack.passives.forEach((p, i) => {
      unique(p.id, ['passives', i, 'id']);
      try { sectSkillLearning(p.id); } catch { issue(['passives', i, p.id], '缺少学习关系'); }
    });
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
    const targets = new Set<string>();
    pack.barrierDurationTargets.forEach((target, i) => {
      const key = target.skillId + ':' + target.barrierId;
      if (targets.has(key)) issue(['barrierDurationTargets', i], '护盾目标重复：' + key);
      targets.add(key);
    });
    walk(pack, []);
    for (const id of passiveIds) if (!usedPassives.has(id)) issue(['passives', id], '被动未被引用');
    validateSectExpressions(pack, issue);
  }).safeParse(data);
  if (!result.success) throw new Error(formatContentPackErrors('content/data/tianyan-paths.json', data, result.error.issues));
  return data as z.infer<typeof TianyanPathsShape>;
}

export function compileTianyanPaths(pack: ReturnType<typeof loadTianyanPaths>): [SectPathDefV6, SectPathDefV6] {
  const passives = new Map(pack.passives.map(p => [p.id, {
    ...sectSkillLearning(p.id), kind: 'passive',
    definition: { id: p.id, name: p.name, tags: [SkillTag.Passive], targeting: { side: TargetSide.Self }, effects: [], hooks: p.hooks },
  } satisfies SectSkillDefV6]));
  const passive = (id: string) => passives.get(id)!;
  const mapping = (element: string) => TIANYAN_FOUNDATION.elements.find(e => e.element === element)!;
  function compilePatch(patch: z.infer<typeof patchShape>): SkillPatchV6[] {
    if (patch.operation === 'setAllBarrierDuration') return pack.barrierDurationTargets.map(target => ({ skillId: target.skillId, operation: 'setBarrierDuration', barrierId: target.barrierId, value: patch.value }));
    if (patch.operation === 'appendReactionEffect') return TIANYAN_FOUNDATION.reactions.filter(r => r.kind === patch.kind).map(r => ({
      skillId: mapping(r.newElement).skillId, operation: 'appendEffect',
      effect: { ...structuredClone(patch.effect), when: { primaryTargetStatusIds: [mapping(r.oldElement).markId] } } as SkillEffect,
    }));
    if (patch.operation === 'multiplyReactionPower') return TIANYAN_FOUNDATION.reactions.filter(r => r.followPower && (!patch.kind || r.kind === patch.kind)).map(r => ({
      skillId: mapping(r.newElement).skillId, operation: 'multiplyEffectPower', effectType: EffectType.FixedHit,
      primaryTargetStatusId: mapping(r.oldElement).markId, value: patch.value,
    }));
    return [patch];
  }
  const paths = pack.paths.map(path => ({
    id: path.id, name: path.name, foundationPassives: path.foundationPassives.map(passive),
    grantSkills: path.grantSkills.map(TIANYAN_SKILLS.skill), resources: path.resources.map(id => TIANYAN_FOUNDATION.resources.find(r => r.id === id)!),
    nodes: path.nodes.map(node => {
      const { id, name, ...rest } = node;
      const fields = Object.fromEntries(Object.entries(rest).map(([key, value]) => [key,
        key === 'passives' ? node.passives!.map(passive) : key === 'grantSkills' ? node.grantSkills!.map(TIANYAN_SKILLS.skill)
          : key === 'patches' ? node.patches!.flatMap(compilePatch) : value,
      ])) as Omit<MeridianNodeDefV6, 'id' | 'name' | 'pathId'>;
      return { id, name, pathId: path.id, ...fields };
    }),
  }));
  return [paths[0], paths[1]];
}
export const TIANYAN_PATHS = compileTianyanPaths(loadTianyanPaths(raw));
