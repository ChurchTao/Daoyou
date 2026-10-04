import type { CreateBattleInput, SkillDef, StatusDef } from '@daoyou/combat-core/types';
import type { TowerNpcPlan } from './npc-plan.js';

/** Frozen, compiled encounter data shared by hosts and protocol views. */
export interface CompiledTowerEncounter {
  units: CreateBattleInput['units'];
  plans: Record<string, TowerNpcPlan>;
  skills: SkillDef[];
  statusDefs: StatusDef[];
}
