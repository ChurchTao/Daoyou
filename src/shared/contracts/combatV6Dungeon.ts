import type { CombatV6TrainingSessionViewV1 } from './combatV6';
export type DungeonSessionView = Omit<
  CombatV6TrainingSessionViewV1,
  'encounterId' | 'tier'
>;
