import { z } from 'zod';

/** JetStream中只发送指针；完整终局记录由消费者按battleId从Redis读取。 */
export const CombatV6BattleFinishedDataV1Schema = z
  .object({
    battleId: z.uuid(),
    sourceType: z.enum(['arena-sparring', 'hunt']).optional(),
  })
  .strict();

export type CombatV6BattleFinishedDataV1 = z.infer<
  typeof CombatV6BattleFinishedDataV1Schema
>;
