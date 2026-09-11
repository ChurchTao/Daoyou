import { formatContentPackErrors } from '@shared/lib/content-pack-errors';
import { z } from 'zod';
import { ATTR_NAMES, CommandPolicy, DamageOrigin, EffectType, SkillTag, StatusCategory, StatusFlag, StatusHit, TargetMode, TargetSide, type SkillDef, type SkillEffect, type StatusDef } from '../core';
import { sectSkillLearning } from './skill-learning';
import { validateSectExpressions } from './authoring-expressions';
import type { SectSkillDefV6 } from './types';
import raw from './data/jiujie-combat.json';

const id = z.string().regex(/^jiujie\.[a-z][a-z0-9_.]*$/);
const number = z.number().min(0).max(1000000);
const expression = z.union([number, z.string().min(1).max(200)]);
const text = z.string().min(1).max(80);
const targeting = z.strictObject({ side: z.enum(TargetSide), mode: z.enum(TargetMode).optional(), count: expression });
const judgmentEffect = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal(EffectType.FixedHit), formula: z.literal('judge'), power: expression, cannotKill: z.boolean() }),
  z.strictObject({ type: z.literal(EffectType.DamageMp), power: expression }),
]);
const effectShape = z.discriminatedUnion('type', [
  z.strictObject({ type: z.enum([EffectType.SpellHit, EffectType.PhysicalHit]), coeff: number, power: expression }),
  z.strictObject({ type: z.literal(EffectType.ApplyStatus), statusId: id, duration: number.int().min(1).max(99), hit: z.enum(StatusHit).optional() }),
  z.strictObject({ type: z.literal(EffectType.Dispel), categories: z.array(z.enum(StatusCategory)), maxCount: number.int().min(1).max(99), excludeStatusFlags: z.array(z.enum(StatusFlag)) }),
  z.strictObject({ type: z.literal('fiveThunderBranches') }),
  z.strictObject({ type: z.literal('detonation'), targetCount: number.int().min(1).max(99) }),
]);
export const JiujieCombatShape = z.strictObject({
  $schema: z.string().optional(), formatVersion: z.literal(1), contentRevision: z.number().int().positive(),
  statuses: z.array(z.strictObject({
    id, name: text, kind: id, category: z.enum(StatusCategory), maxStacks: number.int().min(1).max(99).optional(),
    blocksAction: z.boolean().optional(), blocksSpell: z.boolean().optional(), blocksPhysical: z.boolean().optional(),
    commandPolicy: z.enum(CommandPolicy).optional(), attrMods: z.partialRecord(z.enum(ATTR_NAMES), expression).optional(),
  })).min(1),
  judgment: z.strictObject({
    branches: z.array(z.strictObject({
      branchId: id, chance: number.max(1),
      when: z.union([
        z.strictObject({ targetStatusCategories: z.array(z.enum(StatusCategory)).min(1) }),
        z.strictObject({ targetAbsentStatusCategories: z.array(z.enum(StatusCategory)).min(1) }),
      ]),
    })).length(2),
    successEffects: z.array(judgmentEffect).min(1), failureEffects: z.array(judgmentEffect).min(1),
  }),
  detonation: z.strictObject({ mechanicId: id, name: text, statusId: id, minStacks: number.int().min(1).max(99), power: expression }),
  baseSkillIds: z.array(id).min(1),
  skills: z.array(z.strictObject({
    id, name: text, school: z.literal('jiujie'), costMp: expression, tags: z.array(z.enum(SkillTag)).min(1),
    formula: z.enum(['spell', 'physical']).optional(), sealBase: number.max(100).optional(),
    splash: z.strictObject({ perTarget: number.max(1), floor: number.max(1) }).optional(),
    targeting, effects: z.array(effectShape).min(1),
  })).min(1),
});

export function loadJiujieCombat(data: unknown) {
  const result = JiujieCombatShape.superRefine((pack, ctx) => {
    const issue = (path: (string | number)[], message: string) => ctx.addIssue({ code: 'custom', path, message });
    const all = new Set<string>();
    const unique = (id: string, path: (string | number)[]) => { if (all.has(id)) issue(path, '重复 ID：' + id); all.add(id); };
    const statusIds = new Set(pack.statuses.map(s => s.id));
    const skillIds = new Set(pack.skills.map(s => s.id));
    pack.statuses.forEach((s, i) => unique(s.id, ['statuses', i, 'id']));
    pack.skills.forEach((s, i) => {
      unique(s.id, ['skills', i, 'id']);
      try { sectSkillLearning(s.id); } catch { issue(['skills', i, s.id], '缺少学习关系'); }
      s.effects.forEach((e, j) => {
        if (e.type === EffectType.ApplyStatus && !statusIds.has(e.statusId)) issue(['skills', i, s.id, 'effects', j], '状态引用不存在：' + e.statusId);
      });
    });
    pack.baseSkillIds.forEach((id, i, base) => { if (!skillIds.has(id) || base.indexOf(id) !== i) issue(['baseSkillIds', i], '技能不存在或重复：' + id); });
    pack.judgment.branches.forEach((b, i) => unique(b.branchId, ['judgment', 'branches', i, 'branchId']));
    const [first, second] = pack.judgment.branches;
    const categories = (b: typeof first) => 'targetStatusCategories' in b.when ? b.when.targetStatusCategories : b.when.targetAbsentStatusCategories;
    if (('targetStatusCategories' in first.when) === ('targetStatusCategories' in second.when)
      || categories(first).length !== 1 || categories(second).length !== 1 || categories(first)[0] !== categories(second)[0])
      issue(['judgment', 'branches'], '概率分支必须按同一状态类别互斥，保持每次行动只抽取一个分支');
    const detonationStatus = pack.statuses.find(s => s.id === pack.detonation.statusId);
    if (!detonationStatus || detonationStatus.kind !== pack.detonation.statusId) issue(['detonation', 'statusId'], '引爆状态不存在或 kind 与 ID 不一致');
    else if (pack.detonation.minStacks > (detonationStatus.maxStacks ?? 1)) issue(['detonation', 'minStacks'], '引爆门槛超过状态层数上限');
    validateSectExpressions(pack, issue);
  }).safeParse(data);
  if (!result.success) throw new Error(formatContentPackErrors('content/data/jiujie-combat.json', data, result.error.issues));
  return data as z.infer<typeof JiujieCombatShape>;
}

export function compileJiujieCombat(pack: ReturnType<typeof loadJiujieCombat>) {
  function compileEffect(effect: z.infer<typeof effectShape>): SkillEffect[] {
    if (effect.type === 'fiveThunderBranches') return pack.judgment.branches.map(branch => ({
      type: EffectType.RandomBranch, branchId: branch.branchId, chance: branch.chance, when: branch.when,
      successEffects: structuredClone(pack.judgment.successEffects), failureEffects: structuredClone(pack.judgment.failureEffects),
    }));
    if (effect.type === 'detonation') {
      const rule = pack.detonation;
      const targeting = effect.targetCount > 1 ? { side: TargetSide.Enemy, mode: TargetMode.Fill, count: effect.targetCount } : undefined;
      const when = { targetStatusStack: { kind: rule.statusId, min: rule.minStacks } };
      return [
        { type: EffectType.EmitMechanic, mechanicId: rule.mechanicId, name: rule.name, when, targeting },
        { type: EffectType.FixedHit, formula: 'fixed', origin: DamageOrigin.HookDerived, power: rule.power, when, targeting },
        { type: EffectType.RemoveStatus, statusIds: [rule.statusId], maxCount: 1, when, targeting },
      ];
    }
    return [effect];
  }
  const skills: SectSkillDefV6[] = pack.skills.map(s => ({
    ...sectSkillLearning(s.id), kind: 'active', definition: { ...s, effects: s.effects.flatMap(compileEffect) } satisfies SkillDef,
  }));
  const skill = (id: string) => {
    const found = skills.find(s => s.definition.id === id);
    if (!found) throw new Error('content/data/jiujie-combat.json: skills.' + id + ': 引用不存在');
    return found;
  };
  const statuses: StatusDef[] = pack.statuses;
  return { skills, skill, statuses, baseSkills: pack.baseSkillIds.map(skill) };
}
export const JIUJIE_COMBAT = compileJiujieCombat(loadJiujieCombat(raw));
