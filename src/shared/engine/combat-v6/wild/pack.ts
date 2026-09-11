import { formatContentPackErrors } from '@shared/lib/content-pack-errors';
import { z } from 'zod';
import { ATTR_NAMES, EffectType, FormulaFamily, SkillTag, TargetSide } from '../core';
import { REALM_ORDER, type RealmType } from '../../../types/constants';
import { validateSectExpressions } from '../content/authoring-expressions';
import raw from './data/wild.json';

const id = z.string().regex(/^combat\.wild\.[a-z][a-z0-9.-]*$/);
const text = z.string().min(1).max(200);
const number = z.number().min(0).max(1000000);
const level = z.number().int().min(0).max(180);
const panel = z.strictObject({ level, maxHp: number.min(1), maxMp: number, physicalAtk: number, physicalDef: number, magicAtk: number, magicDef: number, speed: number });
export const WildPackShape = z.strictObject({
  $schema: z.string().optional(), formatVersion: z.literal(1), contentRevision: z.number().int().positive(),
  region: z.strictObject({ nodeId: text, id, name: text, realmRequirement: z.enum(Object.keys(REALM_ORDER) as [RealmType, ...RealmType[]]), beastRealm: text, minLevel: level, maxLevel: level }),
  species: z.array(z.strictObject({ id, name: text, description: text, role: text, skillIds: z.array(id) })).min(1),
  skills: z.array(z.strictObject({
    id, name: text, tags: z.array(z.enum(SkillTag)).min(1), formula: z.literal(FormulaFamily.Spell),
    targeting: z.strictObject({ side: z.enum(TargetSide), count: z.number().int().min(1).max(10) }),
    effects: z.array(z.strictObject({ type: z.literal(EffectType.SpellHit), coeff: number, power: z.union([number, text]) })).min(1),
  })),
  panels: z.record(id, z.array(panel).min(1)), baseAttrs: z.record(z.enum(ATTR_NAMES), number),
  encounter: z.strictObject({ minCount: z.number().int().min(1).max(10), maxCount: z.number().int().min(1).max(10) }),
  activity: z.strictObject({ dailyLimit: z.number().int().min(1).max(100000), explorationCooldownMs: z.number().int().min(1).max(3600000) }),
});
export function loadWildPack(data: unknown) {
  const result = WildPackShape.superRefine((pack, ctx) => {
    const issue = (path: (string | number)[], message: string) => ctx.addIssue({ code: 'custom', path, message });
    const ids = new Set<string>();
    for (const [kind, entries] of [['species', pack.species], ['skills', pack.skills]] as const) entries.forEach((entry, i) => {
      if (ids.has(entry.id)) issue([kind, i, entry.id], '内容ID重复'); ids.add(entry.id);
    });
    if (pack.region.minLevel > pack.region.maxLevel) issue(['region'], '等级上下界颠倒');
    if (pack.encounter.minCount > pack.encounter.maxCount) issue(['encounter'], '编组数量上下界颠倒');
    pack.species.forEach((species, i) => {
      for (const skillId of species.skillIds) if (!pack.skills.some(s => s.id === skillId)) issue(['species', i, species.id, 'skillIds'], '技能引用不存在：' + skillId);
      if (new Set(species.skillIds).size !== species.skillIds.length) issue(['species', i, species.id, 'skillIds'], '技能引用重复');
      const rows = pack.panels[species.id];
      if (!rows || rows.length !== pack.region.maxLevel - pack.region.minLevel + 1 || rows.some((r, i) => r.level !== pack.region.minLevel + i)) issue(['panels', species.id], '等级面板必须覆盖完整连续区间');
    });
    for (const id of Object.keys(pack.panels)) if (!pack.species.some(s => s.id === id)) issue(['panels', id], '面板引用未知物种');
    for (const attr of ['critRate', 'spellCritRate', 'physicalFuryRate'] as const) if (pack.baseAttrs[attr] > 1) issue(['baseAttrs', attr], '概率必须在0到1之间');
    validateSectExpressions(pack, issue);
  }).safeParse(data);
  if (!result.success) throw new Error(formatContentPackErrors('wild/data/wild.json', data, result.error.issues));
  return data as z.infer<typeof WildPackShape>;
}
export const WILD_PACK = loadWildPack(raw);
