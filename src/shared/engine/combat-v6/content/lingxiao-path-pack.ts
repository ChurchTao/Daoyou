import { formatContentPackErrors } from '@shared/lib/content-pack-errors';
import { z } from 'zod';
import { ATTR_NAMES, BUILTIN_SKILL_ID, TargetMode, EffectType, HookAim, HookName, SkillTag, TargetSide } from '../core';
import { sectSkillLearning } from './skill-learning';
import { LINGXIAO_COMBAT } from './lingxiao-pack';
import { validateSectExpressions } from './authoring-expressions';
import type { SectPathDefV6, SectSkillDefV6 } from './types';
import raw from './data/lingxiao-paths.json';

const id = z.string().regex(/^lingxiao\.[a-z][a-z0-9_.]*$/);
const ids = z.array(id);
const number = z.number().min(0).max(10000);
const ratio = number.max(1);
const expression = z.union([number, z.string().min(1).max(200)]);
const text = z.string().min(1).max(200);
const panel = z.array(z.strictObject({ attr: z.enum(ATTR_NAMES), mode: z.enum(['add', 'multiply']), value: number }));
const resourceCondition = z.strictObject({ id, min: number.optional(), max: number.optional() });
const when = z.strictObject({
  skillIds: z.array(z.union([id, z.literal(BUILTIN_SKILL_ID.Attack)])).optional(),
  requireKind: z.literal('physical').optional(),
  targetHpRatioBelow: ratio.optional(), sourceHpRatioBelow: ratio.optional(),
  requireStatusIds: ids.optional(), foeKind: z.literal('npc').optional(),
  sourceDefending: z.boolean().optional(), oncePerRound: z.boolean().optional(),
  oncePerBattle: z.boolean().optional(), sourceResource: resourceCondition.optional(),
});
const actionEffect = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal(EffectType.PhysicalHit), coeff: number, power: expression.optional(), when: when.optional() }),
  z.strictObject({ type: z.literal(EffectType.ApplyStatus), statusId: id, duration: number.int().min(1).max(99), self: z.boolean(), when: when.optional() }),
  z.strictObject({ type: z.literal(EffectType.ModifyResource), resourceId: id, amount: z.number().int().min(-10000).max(10000), when: when.optional() }),
  z.strictObject({ type: z.literal(EffectType.SkipNextAction), when: when.optional() }),
]);
const hookEffect = z.union([
  actionEffect,
  z.strictObject({ type: z.literal(EffectType.ModifyStrike), factor: number }),
  z.strictObject({ type: z.literal(EffectType.ModifyDefenseIgnore), add: ratio }),
  z.strictObject({ type: z.literal(EffectType.ModifyChance), add: ratio }),
  z.strictObject({ type: z.literal(EffectType.Dispel), statusIds: ids }),
  z.strictObject({ type: z.literal(EffectType.ClearSkipNextAction) }),
]);
const hook = z.strictObject({
  on: z.enum([HookName.AfterHit, HookName.OnHitCalc, HookName.OnDeath, HookName.OnBeHit, HookName.OnCritRoll, HookName.AfterAction, HookName.OnHitRoll, HookName.OnDefenseIgnoreCalc]),
  sourceIsSelf: z.boolean().optional(), targetIsSelf: z.boolean().optional(),
  aim: z.enum(HookAim).optional(), aimCount: number.int().min(1).max(10).optional(),
  aimMode: z.enum(TargetMode).optional(), when: when.optional(),
  effects: z.array(hookEffect).min(1),
});
const patch = z.discriminatedUnion('operation', [
  z.strictObject({ skillId: id, operation: z.literal('multiplyPhysicalCoefficients'), value: number }),
  z.strictObject({ skillId: id, operation: z.literal('capRequireHpRatio'), value: ratio }),
  z.strictObject({ skillId: id, operation: z.enum(['setTargetCount', 'setCostHp']), value: expression }),
  z.strictObject({ skillId: id, operation: z.literal('addPhysicalCoefficient'), hitIndex: number.int(), value: number }),
  z.strictObject({ skillId: id, operation: z.literal('addResourceTargetCount'), resourceId: id, min: number, value: expression }),
  z.strictObject({ skillId: id, operation: z.literal('removeEffectType'), effectType: z.enum([EffectType.SkipNextAction, EffectType.ApplyStatus]) }),
  z.strictObject({ skillId: id, operation: z.literal('appendEffect'), effect: actionEffect }),
]);
export const LingxiaoPathsPackShape = z.strictObject({
  $schema: z.string().optional(), formatVersion: z.literal(1),
  contentRevision: z.number().int().positive(),
  passives: z.array(z.strictObject({ id, name: text, hooks: z.array(hook).min(1) })).min(1),
  paths: z.array(z.strictObject({
    id, name: text, foundationPassives: ids.optional(), grantSkills: ids.optional(), resources: ids.optional(),
    nodes: z.array(z.strictObject({
      id, name: text, layer: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5), z.literal(6), z.literal(7)]),
      slot: z.union([z.literal(1), z.literal(2), z.literal(3)]), description: text,
      panel: panel.optional(), patches: z.array(patch).optional(),
      passives: ids.optional(), grantSkills: ids.optional(),
    })).length(21),
  })).length(2),
});

export function loadLingxiaoPathsPack(data: unknown) {
  const result = LingxiaoPathsPackShape.superRefine((pack, ctx) => {
    const issue = (path: (string | number)[], message: string) => ctx.addIssue({ code: 'custom', path, message });
    const all = new Set<string>();
    const passiveIds = new Set(pack.passives.map(p => p.id));
    const usedPassives = new Set<string>();
    const statusIds = new Set(LINGXIAO_COMBAT.statuses.map(s => s.id));
    const resourceIds = new Set(LINGXIAO_COMBAT.resources.map(r => r.id));
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
        const skillExists = (id: string) => { if (id === BUILTIN_SKILL_ID.Attack) return true; try { LINGXIAO_COMBAT.skill(id); return true; } catch { return false; } };
        if (['statusId', 'from', 'to'].includes(key)) check([child as string], id => statusIds.has(id));
        if (['statusIds', 'requireStatusIds'].includes(key)) check(child as string[], id => statusIds.has(id));
        if (key === 'resourceId') check([child as string], id => resourceIds.has(id));
        if (key === 'resources') check(child as string[], id => resourceIds.has(id));
        if (key === 'sourceResource') {
          const condition = child as { id: string; min?: number; max?: number };
          const resource = LINGXIAO_COMBAT.resources.find(r => r.id === condition.id);
          if (!resource) issue([...path, key], '资源引用不存在：' + condition.id);
          else if ((condition.min ?? 0) > resource.max || (condition.max !== undefined && condition.min !== undefined && condition.max < condition.min))
            issue([...path, key], '资源门槛超出上限或区间倒置');
        }
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
        node.patches?.forEach((patch, k) => {
          const field = ['paths', i, 'nodes', j, 'patches', k];
          if (patch.operation === 'addResourceTargetCount') {
            const resource = LINGXIAO_COMBAT.resources.find(r => r.id === patch.resourceId);
            if (resource && patch.min > resource.max) issue([...field, 'min'], '门槛超过资源上限');
          }
          if (patch.operation === 'addPhysicalCoefficient') {
            try {
              const effects = LINGXIAO_COMBAT.skill(patch.skillId).definition.effects.filter(e => e.type === EffectType.PhysicalHit);
              if (!effects.length || effects.some(e => patch.hitIndex > (typeof e.hits === 'number' ? e.hits : Array.isArray(e.coeff) ? e.coeff.length : 1)))
                issue([...field, 'hitIndex'], '只能修改现有伤害段或紧接着追加一段');
            } catch { /* 引用错误由统一校验报告。 */ }
          }
        });

      });
    });
    references(pack, []);
    for (const id of passiveIds) if (!usedPassives.has(id)) issue(['passives', id], '被动未被任何流派或节点引用');
    validateSectExpressions(pack, issue);
  }).safeParse(data);
  if (!result.success) throw new Error(formatContentPackErrors('content/data/lingxiao-paths.json', data, result.error.issues));
  return data as z.infer<typeof LingxiaoPathsPackShape>;
}

export function compileLingxiaoPaths(pack: ReturnType<typeof loadLingxiaoPathsPack>): [SectPathDefV6, SectPathDefV6] {
  const passives = new Map(pack.passives.map(p => [p.id, {
    ...sectSkillLearning(p.id), kind: 'passive',
    definition: { id: p.id, name: p.name, tags: [SkillTag.Passive], targeting: { side: TargetSide.Self }, effects: [], hooks: p.hooks },
  } satisfies SectSkillDefV6]));
  const passive = (id: string) => passives.get(id)!;
  const paths = pack.paths.map(path => {
    const { foundationPassives, grantSkills, resources, nodes, ...rest } = path;
    return {
      ...rest,
      ...(foundationPassives ? { foundationPassives: foundationPassives.map(passive) } : {}),
      ...(grantSkills ? { grantSkills: grantSkills.map(LINGXIAO_COMBAT.skill) } : {}),
      ...(resources ? { resources: resources.map(id => LINGXIAO_COMBAT.resources.find(r => r.id === id)!) } : {}),
      nodes: nodes.map(node => {
        const { id, name, passives: passiveRefs, grantSkills: grantRefs, ...rest } = node;
        return { id, name, pathId: path.id, ...rest,
          ...(passiveRefs ? { passives: passiveRefs.map(passive) } : {}),
          ...(grantRefs ? { grantSkills: grantRefs.map(LINGXIAO_COMBAT.skill) } : {}),
        };
      }),
    };
  });
  return [paths[0], paths[1]];
}
export const LINGXIAO_PATHS = compileLingxiaoPaths(loadLingxiaoPathsPack(raw));
