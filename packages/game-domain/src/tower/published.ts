import { z } from 'zod';
import { TOWER_STRATEGY_VERSION, TowerFloorStrategySchema } from './strategy.js';

export const PublishedTowerWeekSchema = z.strictObject({
  schemaVersion: z.literal(3),
  contentVersion: z.literal(TOWER_STRATEGY_VERSION),
  generatorVersion: z.string().min(1),
  season: z.strictObject({
    seasonKey: z.string().min(1),
    seasonStartedAt: z.iso.datetime(),
    seasonEndsAt: z.iso.datetime(),
    nextResetAt: z.iso.datetime(),
  }),
  floors: z.array(TowerFloorStrategySchema).length(20),
});

export type PublishedTowerWeek = z.infer<typeof PublishedTowerWeekSchema>;

export type StoredTowerWeek = PublishedTowerWeek;
