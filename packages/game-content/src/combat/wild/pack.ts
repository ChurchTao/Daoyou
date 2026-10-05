import { formatContentPackErrors } from '@daoyou/game-domain/content-pack-errors';
import { WildRegionSchema } from '@daoyou/game-domain/wild';

import { REALM_ORDER } from '@daoyou/constants/realms';

import { z } from 'zod';

import { BEAST_RARE_SPECIES_IDS, BEAST_SPECIES } from '../../beasts/content.js';

import raw from './data/wild.json' with { type: 'json' };

export const WildPackShape = z.strictObject({
  $schema: z.string().optional(),
  formatVersion: z.literal(4),
  contentRevision: z.number().int().positive(),
  regions: z.array(WildRegionSchema).min(1),
  encounter: z.strictObject({
    minCount: z.number().int().min(1).max(3),
    maxCount: z.number().int().min(1).max(3),
    cubChance: z.number().min(0).max(1),
    mutantChance: z.number().min(0).max(1),
    allocationSpread: z.number().min(0).max(0.5),
  }),
  activity: z.strictObject({
    explorationCooldownMs: z.number().int().min(1).max(60000),
  }),
});

export function loadWildPack(data: unknown) {
  const result = WildPackShape.superRefine((pack, ctx) => {
    const issue = (path: (string | number)[], message: string) =>
      ctx.addIssue({ code: 'custom', path, message });
    if (pack.encounter.minCount > pack.encounter.maxCount)
      issue(['encounter'], '编组数量上下界颠倒');
    const nodes = new Set<string>();
    const ids = new Set<string>();
    pack.regions.forEach((region, i) => {
      if (nodes.has(region.nodeId) || ids.has(region.id))
        issue(['regions', i], '区域重复');
      nodes.add(region.nodeId);
      ids.add(region.id);
      const rareCount = region.species.filter((s) =>
        BEAST_RARE_SPECIES_IDS.has(s.speciesId),
      ).length;
      if (rareCount === region.species.length)
        issue(['regions', i, 'species'], '栖息地必须保留普通物种');
      if (rareCount > 0 && region.rareChance === undefined)
        issue(
          ['regions', i, 'rareChance'],
          '含稀有物种的栖息地必须配置稀有概率',
        );
      if (rareCount === 0 && (region.rareChance ?? 0) > 0)
        issue(['regions', i, 'rareChance'], '未配置稀有物种，不能启用稀有概率');
      if (
        new Set(region.species.map((s) => s.speciesId)).size !==
        region.species.length
      )
        issue(['regions', i, 'species'], '物种重复');
      region.species.forEach((entry, j) => {
        const path = ['regions', i, 'species', j];
        const species = BEAST_SPECIES.find((s) => s.id === entry.speciesId);
        if (!species) issue(path, '引用未知物种');
        if (entry.minLevel > entry.maxLevel) issue(path, '等级上下界颠倒');
        if (species && entry.minLevel < species.carryLevel)
          issue(path, '成年等级不得低于物种携带等级');
        if (
          species &&
          REALM_ORDER[region.realmRequirement] < REALM_ORDER[species.realm]
        )
          issue(path, '区域开放境界不得低于物种携带境界');
      });
    });
  }).safeParse(data);
  if (!result.success)
    throw new Error(
      formatContentPackErrors('wild/data/wild.json', data, result.error.issues),
    );
  return result.data;
}

export const WILD_PACK = loadWildPack(raw);
