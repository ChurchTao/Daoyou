import { formatContentPackErrors } from '@shared/lib/content-pack-errors';
import { z } from 'zod';
import { ATTR_NAMES } from '@shared/engine/combat-v6/core';
import { REALM_ORDER, type RealmType } from '@shared/types/constants';
import raw from './data/encounters.json';

const number = z.number().min(0).max(1000000);
const template = z.strictObject({ name: z.string().min(1).max(80), count: z.number().int().min(1).max(10), hpScale: number.positive() });
export const TowerEncounterPackShape = z.strictObject({
  $schema: z.string().optional(), formatVersion: z.literal(1), contentRevision: z.number().int().positive(),
  minRealm: z.enum(Object.keys(REALM_ORDER) as [RealmType, ...RealmType[]]), difficultyStep: number.int().positive(),
  floors: z.array(z.strictObject({ floor: z.number().int().min(1).max(1000), kind: z.enum(['normal', 'elite', 'boss']), realmStage: z.enum(['初期', '中期', '后期', '圆满']), milestone: z.enum(['C', 'B', 'A', 'S']).nullable() })).min(1).max(1000),
  enemies: z.strictObject({
    floorGrowth: number, hpBase: number, hpPerLevel: number, attackBase: number, attackPerLevel: number, defensePerLevel: number, speedPerLevel: number,
    templates: z.strictObject({ normal: template, elite: template, boss: template }),
    baseAttrs: z.record(z.enum(ATTR_NAMES), number),
  }),
});
export function loadTowerEncounterPack(data: unknown) {
  const result = TowerEncounterPackShape.superRefine((pack, ctx) => {
    const issue = (path: (string | number)[], message: string) => ctx.addIssue({ code: 'custom', path, message });
    const tiers = new Set<string>();
    pack.floors.forEach((floor, i) => {
      if (floor.floor !== i + 1) issue(['floors', i, 'floor'], '楼层必须从1连续递增');
      if (floor.milestone) {
        if (tiers.has(floor.milestone)) issue(['floors', i, 'milestone'], '里程碑档位重复');
        tiers.add(floor.milestone);
      }
      const e = pack.enemies;
      const hp = (e.hpBase + 180 * e.hpPerLevel) * (1 + i * e.floorGrowth) * e.templates[floor.kind].hpScale;
      const attack = (e.attackBase + 180 * e.attackPerLevel) * (1 + i * e.floorGrowth);
      if (!Number.isSafeInteger(Math.round(hp)) || !Number.isSafeInteger(Math.round(attack))) issue(['enemies', floor.kind], '最高等级敌人数值溢出');
    });
    if (tiers.size !== 4) issue(['floors'], '四个里程碑档位必须完整');
    for (const attr of ['critRate', 'spellCritRate', 'physicalFuryRate'] as const) if (pack.enemies.baseAttrs[attr] > 1) issue(['enemies', 'baseAttrs', attr], '概率必须在0到1之间');
  }).safeParse(data);
  if (!result.success) throw new Error(formatContentPackErrors('tower/data/encounters.json', data, result.error.issues));
  return data as z.infer<typeof TowerEncounterPackShape>;
}
export const TOWER_ENCOUNTER_PACK = loadTowerEncounterPack(raw);
