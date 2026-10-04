import type { z } from 'zod';
import type { ItemGrant } from '../items/inventory.js';
import type { SummonedBeast } from '../beasts/schema.js';
import type { CombatV6BattleMetadataV1Schema } from '../combat/metadata.js';
import type { WildRuntimeSnapshot } from './runtime.js';
import type { WildResources } from './resources.js';



export interface WildSettlement {
  itemRewards?: ItemGrant[];
  capturedBeasts?: SummonedBeast[];
  beastExperience?: { beastId: string; amount: number };
  deadBeastIds?: string[];
  schemaVersion: 1;
  battleId: string;
  userId: string;
  cultivatorId: string;
  membershipId: string | null;
  metadata: Extract<z.infer<typeof CombatV6BattleMetadataV1Schema>, { sourceType: 'wild-encounter' }>;
  combatVersions: WildRuntimeSnapshot['state']['versions'];
  createdAt: string;
  expiresAt: string;
  revision: number;
  round: number;
  entry: WildResources;
  final: WildResources;
}
