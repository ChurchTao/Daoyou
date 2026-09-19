import { formatContentPackErrors } from '@shared/lib/content-pack-errors';
import { z } from 'zod';
import { ATTR_NAMES, DamageOrigin, EffectType, FormulaFamily, SkillTag, StatusCategory, StatusTick, TargetSide, TickKind, UnitKind } from '../core';
import { validateSectExpressions } from '../content/authoring-expressions';
import type { CombatV6TrainingContentV1, PveCombatantDefV1 } from './types';
import raw from './data/training.json';

const id = z.string().regex(/^combat\.training\.[a-z][a-z0-9.-]*$/);
const text = z.string().min(1).max(200);
const number = z.number().min(0).max(1000000);
const expression = z.union([number, text]);
const tier = z.union([z.literal(60), z.literal(120), z.literal(180)]);
const strategy = z.discriminatedUnion('type', [
  z.strictObject({ type: z.enum(['defend', 'attack']) }),
  z.strictObject({ type: z.literal('skill-rotation'), skillIds: z.array(id).min(1) }),
]);
export const TrainingPackShape = z.strictObject({
  $schema: z.string().optional(), formatVersion: z.literal(1), contentRevision: z.number().int().positive(),
  tiers: z.array(z.strictObject({ level: tier, attrs: z.record(z.enum(ATTR_NAMES), number) })).length(3),
  templates: z.array(z.strictObject({
    id, name: text, kind: z.enum([UnitKind.Player, UnitKind.Npc]), skillIds: z.array(id), strategy,
    attrOverrides: z.partialRecord(z.enum(ATTR_NAMES), number),
    maxHpMultiplier: number.min(1).max(100).optional(), initialHpRatio: number.max(1).optional(),
    initialHpFromLevel: z.literal(true).optional(), speedBonus: number.optional(),
  })).min(1),
  skills: z.array(z.strictObject({
    id, name: text, tags: z.array(z.enum(SkillTag)).min(1), formula: z.literal(FormulaFamily.Fixed).optional(),
    targeting: z.strictObject({ side: z.enum(TargetSide), count: number.int().min(1).max(10) }),
    effects: z.array(z.discriminatedUnion('type', [
      z.strictObject({ type: z.literal(EffectType.ApplyStatus), statusId: id, duration: number.int().min(1).max(99) }),
      z.strictObject({ type: z.literal(EffectType.Wound), power: expression }),
      z.strictObject({ type: z.literal(EffectType.FixedHit), formula: z.literal(FormulaFamily.Fixed), power: expression, origin: z.enum(DamageOrigin) }),
    ])),
  })).min(1),
  statusDefs: z.array(z.strictObject({
    id, name: text, kind: id, category: z.enum(StatusCategory), blocksSpell: z.boolean().optional(),
    attrMods: z.partialRecord(z.enum(ATTR_NAMES), z.number().min(-1000000).max(1000000)).optional(),
    ticks: z.literal(StatusTick.RoundEnd).optional(),
    onTick: z.strictObject({ type: z.literal(TickKind.Dot), ratioOfMaxHp: number.max(1) }).optional(),
  })),
  encounters: z.array(z.strictObject({
    id, name: text, playerSlot: number.int().max(9),
    participants: z.array(z.strictObject({ combatantId: id, side: z.union([z.literal(0), z.literal(1)]), slot: number.int().max(9) })).min(1),
  })).min(1),
});

export function loadTrainingPack(data: unknown) {
  const result = TrainingPackShape.superRefine((pack, ctx) => {
    const issue = (path: (string | number)[], message: string) => ctx.addIssue({ code: 'custom', path, message });
    const ids = new Set<string>();
    for (const [key, entries] of [['templates', pack.templates], ['skills', pack.skills], ['statusDefs', pack.statusDefs], ['encounters', pack.encounters]] as const) entries.forEach((entry, i) => {
      if (ids.has(entry.id)) issue([key, i, entry.id], '内容ID重复');
      ids.add(entry.id);
    });
    if (pack.tiers.some((row, i) => row.level !== [60, 120, 180][i])) issue(['tiers'], '必须按顺序完整配置60、120、180档');
    pack.templates.forEach((template, i) => {
      const skills = new Set(template.skillIds);
      if (skills.size !== template.skillIds.length || template.skillIds.some(id => !pack.skills.some(s => s.id === id))) issue(['templates', i, template.id, 'skillIds'], '技能引用不存在或重复');
      if (template.strategy.type === 'skill-rotation' && template.strategy.skillIds.some(id => !skills.has(id))) issue(['templates', i, template.id, 'strategy'], '轮转技能必须为本模板持有技能');
      if (template.initialHpRatio !== undefined && template.initialHpFromLevel) issue(['templates', i, template.id], '初始气血配方不可同时配置');
      if ('hp' in template.attrOverrides || 'maxHp' in template.attrOverrides || 'speed' in template.attrOverrides) {
        if ((('hp' in template.attrOverrides || 'maxHp' in template.attrOverrides) && (template.maxHpMultiplier !== undefined || template.initialHpRatio !== undefined || template.initialHpFromLevel)) || ('speed' in template.attrOverrides && template.speedBonus !== undefined)) issue(['templates', i, template.id, 'attrOverrides'], '属性覆盖与专用配方冲突');
      }
    });
    pack.skills.forEach((skill, i) => skill.effects.forEach((effect, j) => {
      if (effect.type === EffectType.ApplyStatus && !pack.statusDefs.some(s => s.id === effect.statusId)) issue(['skills', i, skill.id, 'effects', j], '状态引用不存在');
    }));
    pack.statusDefs.forEach((status, i) => {
      if (Boolean(status.ticks) !== Boolean(status.onTick)) issue(['statusDefs', i, status.id], '周期触发时机与效果必须成对配置');
    });
    pack.encounters.forEach((encounter, i) => {
      const slots = new Set([`0:${encounter.playerSlot}`]);
      encounter.participants.forEach((p, j) => {
        if (!pack.templates.some(t => t.id === p.combatantId)) issue(['encounters', i, encounter.id, 'participants', j], '模板引用不存在');
        const key = `${p.side}:${p.slot}`;
        if (slots.has(key)) issue(['encounters', i, encounter.id, 'participants', j], '阵位重复或占用玩家阵位');
        slots.add(key);
      });
      if (!encounter.participants.some(p => p.side === 1)) issue(['encounters', i, encounter.id], '至少需要一个敌方单位');
    });
    validateSectExpressions(pack, issue);
    for (const unit of compileTrainingContent(pack).combatants) {
      if (unit.attrs.maxHp < 1 || unit.attrs.hp > unit.attrs.maxHp || unit.attrs.mp > unit.attrs.maxMp) issue(['templates', unit.id, unit.level, 'attrs'], '初始资源超出上限');
      for (const key of ['critRate', 'spellCritRate', 'physicalFuryRate'] as const) if (unit.attrs[key] > 1) issue(['templates', unit.id, unit.level, key], '概率必须在0到1之间');
    }
  }).safeParse(data);
  if (!result.success) throw new Error(formatContentPackErrors('encounter/data/training.json', data, result.error.issues));
  return data as z.infer<typeof TrainingPackShape>;
}

export function compileTrainingContent(pack: z.infer<typeof TrainingPackShape>): CombatV6TrainingContentV1 {
  const combatants = pack.tiers.flatMap(row => pack.templates.map(template => {
    const attrs = { ...row.attrs, ...template.attrOverrides };
    if (template.maxHpMultiplier !== undefined) attrs.hp = attrs.maxHp = row.attrs.maxHp * template.maxHpMultiplier;
    if (template.initialHpRatio !== undefined) attrs.hp = Math.floor(row.attrs.maxHp * template.initialHpRatio);
    if (template.initialHpFromLevel) attrs.hp = Math.max(1, row.level);
    if (template.speedBonus !== undefined) attrs.speed = row.attrs.speed + template.speedBonus;
    return {
      id: template.id, name: template.name, level: row.level, kind: template.kind,
      skillIds: [...template.skillIds], passiveIds: [], skillLevels: Object.fromEntries(template.skillIds.map(id => [id, row.level])),
      tags: [], strategy: structuredClone(template.strategy), attrs,
    } satisfies PveCombatantDefV1;
  }));
  return { combatants, encounters: structuredClone(pack.encounters), skills: structuredClone(pack.skills), statusDefs: structuredClone(pack.statusDefs) };
}
export const TRAINING_PACK = loadTrainingPack(raw);
