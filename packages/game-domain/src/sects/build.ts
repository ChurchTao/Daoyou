import { z } from 'zod';
import type { CombatV6SectId } from '../combat/content.js';



export const COMBAT_V6_BUILD_SCHEMA_VERSION = 1 as const;



export const SectCombatReadinessSchema = z.enum([
  'uninitialized',
  'pending',
  'active',
]);


export type SectCombatReadiness = z.infer<typeof SectCombatReadinessSchema>;



export interface SectCombatMethodView {
  id: string;
  name: string;
  slot: 1 | 2 | 3 | 4 | 5 | 6;
  level: number;
  isPrimary: boolean;
}



export interface SectCombatPathView {
  id: string;
  name: string;
  description: string;
}



export interface SectCombatView {
  schemaVersion: typeof COMBAT_V6_BUILD_SCHEMA_VERSION;
  status: SectCombatReadiness;
  revision: number;
  membershipId?: string;
  sectId?: CombatV6SectId;
  sectName?: string;
  activePathId?: string;
  meridianDepth: number;
  methods: SectCombatMethodView[];
  paths: SectCombatPathView[];
}
