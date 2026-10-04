import { z } from 'zod';
import { AutoStrategySchema, type AutoStrategy } from '@daoyou/game-domain/combat/auto';
import defaults from './auto-defaults.json' with { type: 'json' };


const DefaultStrategiesSchema = z.strictObject({
  version: z.literal(1),
  paths: z.record(z.string(), AutoStrategySchema),
});


export const DEFAULT_AUTO_STRATEGIES =
  DefaultStrategiesSchema.parse(defaults).paths;



export function defaultAutoStrategy(
  pathId: string | undefined,
): AutoStrategy | undefined {
  return pathId ? DEFAULT_AUTO_STRATEGIES[pathId] : undefined;
}
