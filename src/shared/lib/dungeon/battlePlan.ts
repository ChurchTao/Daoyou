import { z } from 'zod';

export const DungeonBattlePlanSchema = z.enum([
  'standard',
  'basic_attack_only',
]);

export type DungeonBattlePlan = z.infer<typeof DungeonBattlePlanSchema>;
