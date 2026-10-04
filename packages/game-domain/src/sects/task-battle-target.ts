import type { z } from 'zod';
import type { SectV6TargetSchema } from '../combat/sect-target.js';
import type { RealmType, RealmStage } from '@daoyou/constants/realms';

export type SectBattleTargetSnapshot = z.infer<typeof SectV6TargetSchema>;

export interface SectBattleTargetSummary {
  kind: SectBattleTargetSnapshot['kind'];
  name: string;
  description: string;
  realm: RealmType;
  realmStage: RealmStage;
  sectId?: string;
  sectName?: string;
}
