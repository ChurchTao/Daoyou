import { formatContentPackErrors } from '@shared/lib/content-pack-errors';
import { z } from 'zod';
import { ATTR_NAMES, DamageOrigin, StatusFlag, TargetMode, EffectType, HookAim, HookName, SkillTag, TargetSide } from '../core';
import { sectSkillLearning } from './skill-learning';
import { WUXIANG_COMBAT } from './wuxiang-pack';
import { validateSectExpressions } from './authoring-expressions';
import type { MeridianNodeDefV6, SectPathDefV6, SectSkillDefV6 } from './types';
import raw from './data/wuxiang-paths.json';

const id = z.string().regex(/^wuxiang\.[a-z][a-z0-9_.]*$/);
const ids = z.array(id);
const number = z.number().min(0).max(10000);
const ratio = number.max(1);
const expression = z.union([number, z.string().min(1).max(200)]);
const text = z.string().min(1).max(200);
const panel = z.array(z.strictObject({ attr: z.enum(ATTR_NAMES), mode: z.enum(['add', 'multiply']), value: number }));
const targeting = z.strictObject({ side: z.enum(TargetSide), mode: z.enum(TargetMode), includeDowned: z.boolean().optional() });
const when = z.strictObject({
  skillIds: ids.optional(), requireStatusIds: ids.optional(), requireAbsentStatusIds: ids.optional(),
  targetHpRatioBelow: ratio.optional(), targetHpRatioAbove: ratio.optional(), sourceHpRatioBelow: ratio.optional(),
  sourceStanding: z.boolean().optional(), damageOrigins: z.array(z.enum(DamageOrigin)).optional(),
  targetSlot: z.literal('primary').optional(),
});
const actionEffect = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal(EffectType.SpellHit), coeff: number, power: expression, when: when.optional() }),
  z.strictObject({ type: z.literal(EffectType.ApplyStatus), statusId: id, duration: number.int().min(1).max(99), targeting: targeting.optional() }),
  z.strictObject({ type: z.literal(EffectType.ApplyBarrier), id, kind: id, name: text, power: expression, duration: number.int().min(1).max(99), targeting: targeting.optional() }),
  z.strictObject({ type: z.literal(EffectType.Heal), power: expression, targeting: targeting.optional() }),
  z.strictObject({ type: z.literal(EffectType.Revive), hpRatio: ratio, targeting: targeting.optional() }),
  z.strictObject({ type: z.literal(EffectType.ModifyResource), resourceId: id, amount: number.int(), when: when.optional() }),
]);
const hookEffect = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal(EffectType.ModifyStrike), factor: number }),
  z.strictObject({ type: z.literal(EffectType.ModifyHeal), factor: number }),
  z.strictObject({ type: z.literal(EffectType.ModifyBarrier), factor: number }),
  z.strictObject({ type: z.literal(EffectType.ModifyWound), factor: number }),
  z.strictObject({ type: z.literal(EffectType.ModifyDefenseIgnore), add: ratio }),
  z.strictObject({ type: z.literal(EffectType.ModifyChance), add: ratio }),
  z.strictObject({ type: z.literal(EffectType.RestoreHp), power: expression, maxGainPerAction: expression }),
]);
const hook = z.strictObject({
  on: z.enum([HookName.OnHealCalc, HookName.OnBarrierCalc, HookName.OnWoundCalc, HookName.OnHitCalc, HookName.OnDefenseIgnoreCalc, HookName.OnCritRoll, HookName.AfterHit]),
  sourceIsSelf: z.boolean().optional(), targetIsSelf: z.boolean().optional(),
  aim: z.enum(HookAim).optional(), requireKind: z.literal('spell').optional(),
  when, effects: z.array(hookEffect).min(1),
});
const patch = z.discriminatedUnion('operation', [
  z.strictObject({ skillId: id, operation: z.enum(['multiplyBarrierPower', 'multiplyRemoveWoundPower', 'multiplySpellCoefficients']), value: number }),
  z.strictObject({ skillId: id, operation: z.literal('setRequireHpRatio'), value: ratio }),
  z.strictObject({ skillId: id, operation: z.literal('setReviveRatio'), value: ratio, whenStatusId: id, statusPresent: z.boolean() }),
  z.strictObject({ skillId: id, operation: z.literal('setDispelExcludeStatusFlags'), value: z.array(z.enum(StatusFlag)) }),
  z.strictObject({ skillId: id, operation: z.enum(['setTargetCount', 'setDispelMaxCount', 'addSpellPower', 'setCostHp']), value: expression }),
  z.strictObject({ skillId: id, operation: z.literal('setBarrierDuration'), barrierId: id, value: number.int().min(1).max(99) }),
  z.strictObject({ skillId: id, operation: z.literal('setStatusDuration'), statusId: id, value: number.int().min(1).max(99) }),
  z.strictObject({ skillId: id, operation: z.literal('setSplash'), perTarget: ratio, floor: ratio }),
  z.strictObject({ skillId: id, operation: z.enum(['appendEffect', 'appendSuccessEffect']), effect: actionEffect }),
]);
export const WuxiangPathsPackShape = z.strictObject({
  $schema: z.string().optional(), formatVersion: z.literal(1),
  contentRevision: z.number().int().positive(),
  passives: z.array(z.strictObject({ id, name: text, hooks: z.array(hook).min(1) })).min(1),
  paths: z.array(z.strictObject({
    id, name: text, foundationPassives: ids.optional(), grantSkills: ids.optional(), resources: ids.optional(), patches: z.array(patch).optional(),
    nodes: z.array(z.strictObject({
      id, name: text, layer: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5), z.literal(6), z.literal(7)]),
      slot: z.union([z.literal(1), z.literal(2), z.literal(3)]), description: text,
      panel: panel.optional(), patches: z.array(patch).optional(),
      passives: ids.optional(), grantSkills: ids.optional(),
    })).length(21),
  })).length(2),
});

export function loadWuxiangPathsPack(data: unknown) {
  const result = WuxiangPathsPackShape.superRefine((pack, ctx) => {
    const issue = (path: (string | number)[], message: string) => ctx.addIssue({ code: 'custom', path, message });
    const all = new Set<string>();
    const passiveIds = new Set(pack.passives.map(p => p.id));
    const usedPassives = new Set<string>();
    const statusIds = new Set(WUXIANG_COMBAT.statuses.map(s => s.id));
    const resourceIds = new Set(WUXIANG_COMBAT.resources.map(r => r.id));
    const barrierIds = new Set(WUXIANG_COMBAT.skills.flatMap(s => s.definition.effects.filter(e => e.type === EffectType.ApplyBarrier).map(e => e.id)));
    for (const path of pack.paths) for (const node of path.nodes) for (const patch of node.patches ?? [])
      if ((patch.operation === 'appendEffect' || patch.operation === 'appendSuccessEffect') && patch.effect.type === EffectType.ApplyBarrier) barrierIds.add(patch.effect.id);
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
        const skillExists = (id: string) => { try { WUXIANG_COMBAT.skill(id); return true; } catch { return false; } };
        if (['statusId', 'whenStatusId'].includes(key)) check([child as string], id => statusIds.has(id));
        if (['statusIds', 'requireStatusIds', 'requireAbsentStatusIds'].includes(key)) check(child as string[], id => statusIds.has(id));
        if (key === 'resourceId') check([child as string], id => resourceIds.has(id));
        if (key === 'barrierId') check([child as string], id => barrierIds.has(id));
        if (key === 'resources') check(child as string[], id => resourceIds.has(id));
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
  if (!result.success) throw new Error(formatContentPackErrors('content/data/wuxiang-paths.json', data, result.error.issues));
  return data as z.infer<typeof WuxiangPathsPackShape>;
}

export function compileWuxiangPaths(pack: ReturnType<typeof loadWuxiangPathsPack>): [SectPathDefV6, SectPathDefV6] {
  const passives = new Map(pack.passives.map(p => [p.id, {
    ...sectSkillLearning(p.id), kind: 'passive',
    definition: { id: p.id, name: p.name, tags: [SkillTag.Passive], targeting: { side: TargetSide.Self }, effects: [], hooks: p.hooks },
  } satisfies SectSkillDefV6]));
  const passive = (id: string) => passives.get(id)!;
  const paths = pack.paths.map(path => {
    const { foundationPassives, grantSkills, resources, patches, nodes, ...rest } = path;
    return {
      ...rest,
      ...(foundationPassives ? { foundationPassives: foundationPassives.map(passive) } : {}),
      ...(grantSkills ? { grantSkills: grantSkills.map(WUXIANG_COMBAT.skill) } : {}),
      ...(resources ? { resources: resources.map(id => WUXIANG_COMBAT.resources.find(r => r.id === id)!) } : {}),
      ...(patches ? { patches } : {}),
      nodes: nodes.map(node => {
        const { id, name, ...rest } = node;
        // 引用转换保留作者字段顺序，兼容原快照序列化顺序。
        const fields = Object.fromEntries(Object.entries(rest).map(([key, value]) => [
          key,
          key === 'passives' ? node.passives!.map(passive)
            : key === 'grantSkills' ? node.grantSkills!.map(WUXIANG_COMBAT.skill) : value,
        ])) as Omit<MeridianNodeDefV6, 'id' | 'name' | 'pathId'>;
        return { id, name, pathId: path.id, ...fields };
      }),
    };
  });
  return [paths[0], paths[1]];
}
export const WUXIANG_PATHS = compileWuxiangPaths(loadWuxiangPathsPack(raw));
