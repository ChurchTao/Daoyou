import type {
  WildEncounterView,
  WildRuntimeSnapshot,
  WildRegion,
} from '@daoyou/game-domain/wild';












import { z } from 'zod';



import { type DropPool } from '@daoyou/game-domain/rewards';


















import { type ItemGrant } from '@daoyou/game-domain/inventory';






import type { CombatV6TrainingSessionViewV1 } from './combatV6.js';






import type { CombatV6RedisRuntimeV1 } from './combatV6Runtime.js';



import { CombatV6BattleMetadataV1Schema } from '@daoyou/game-domain/combat/replay';



export const WildExploreRequestSchema = z
  .object({ nodeId: z.string().min(1).max(100), requestId: z.uuid() })
  .strict();



export const WildStartRequestSchema = z
  .object({ encounterId: z.uuid() })
  .strict();



export type WildRegionView = WildRegion & {
  qiCost: number;
  encounter: WildEncounterView | null;
  settlingBattleId: string | null;
  trainingSessionId: string | null;
};



export type WildRuntime = Omit<
  CombatV6RedisRuntimeV1,
  'metadata' | 'host' | 'membershipId'
> & {
  membershipId: string | null;
  metadata: Extract<
    z.infer<typeof CombatV6BattleMetadataV1Schema>,
    { sourceType: 'wild-encounter' }
  >;
  host: WildRuntimeSnapshot;
  dropPool: DropPool;
  /** Frozen terminal display; settlement facts may be removed after delivery. */
  itemRewards?: ItemGrant[];
};



export type WildSessionView = Omit<
  CombatV6TrainingSessionViewV1,
  'encounterId' | 'tier'
> & {
  nodeId: string;
  settlement: 'pending' | 'settled' | 'not-started';
  itemRewards?: ItemGrant[];
};
