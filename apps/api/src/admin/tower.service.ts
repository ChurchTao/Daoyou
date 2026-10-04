import { HttpException, Injectable } from '@nestjs/common';
import {
  listTowerPublishedWeeks,
  parseTowerWeekRecord,
  readTowerWeekRecord,
  regenerateTowerWeek,
  towerWeekFingerprint,
} from '@server/lib/repositories/towerRepository.js';
import type { AdminTowerView } from '@daoyou/contracts/admin/tower';
import {
  publishedTowerEncounter,
  publishedTowerPreviews,
  getNextTowerSeasonMeta,
  getTowerSeasonMeta,
} from '@daoyou/game-rules/tower';
import { z } from 'zod';
import { TowerQuerySchema, TowerRegenerateSchema } from './tower-input.js';
@Injectable()
export class AdminTowerService {
  async read(query: z.infer<typeof TowerQuerySchema>) {
    const currentSeason = getTowerSeasonMeta();
    const nextSeason = getNextTowerSeasonMeta(
      new Date(currentSeason.seasonStartedAt),
    );
    const seasonKey = query.seasonKey ?? currentSeason.seasonKey;
    const [weeks, row] = await Promise.all([
      listTowerPublishedWeeks(),
      readTowerWeekRecord(seasonKey),
    ]);
    // Read and validate this exact snapshot, keeping its fingerprint and display consistent.
    const pack = parseTowerWeekRecord(row);
    const summarize = (item: (typeof weeks)[number]) => ({
      seasonKey: item.seasonKey,
      schemaVersion: item.schemaVersion,
      contentVersion: item.contentVersion,
      generatorVersion: item.generatorVersion,
      publishedAt: item.createdAt.toISOString(),
    });
    const data: AdminTowerView = {
      currentSeason,
      nextSeason,
      seasonKey,
      realm: query.realm,
      floor: query.floor,
      weeks: weeks.map(summarize),
      fingerprint: towerWeekFingerprint(row),
      published: row ? summarize(row) : null,
      configuration: pack
        ? {
            season: pack.season,
            previews: publishedTowerPreviews(pack),
            encounter: publishedTowerEncounter(pack, query.realm, query.floor),
          }
        : null,
    };
    return { success: true, data };
  }
  async regenerate(input: z.infer<typeof TowerRegenerateSchema>) {
    const current = getTowerSeasonMeta();
    const next = getNextTowerSeasonMeta(new Date(current.seasonStartedAt));
    const season = [current, next].find(
      (item) => item.seasonKey === input.seasonKey,
    );
    if (!season)
      throw new HttpException({ error: '仅可重新生成本周或下周配置' }, 400);
    const replaced = await regenerateTowerWeek(
      season,
      input.expectedFingerprint,
    );
    if (!replaced)
      throw new HttpException({ error: '周配置已变化，请刷新后重新生成' }, 409);
    return { success: true };
  }
}
