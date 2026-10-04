import type {
  CombatV6CommandOptions,
  CombatV6VersionStamp,
} from '@daoyou/combat-core/types';
import type { CombatV6TrainingCommandV1 } from './commands.js';
import type {
  CombatV6TrainingUnitViewV1,
  CombatV6DisplayCatalog,
  SequencedCombatV6Event,
  CombatV6PlaybackV1,
} from './display.js';
import type { TrainingEncounterOutcome } from './encounter.js';
export interface CombatV6SessionSnapshot {
  settlement?: 'pending' | 'settled' | 'not-started';
  sessionId: string;
  controlledUnitId?: string;
  revision: number;
  expiresAt: string;
  combatVersions: CombatV6VersionStamp;
  round: number;
  phase: string;
  outcome?: TrainingEncounterOutcome;
  units: CombatV6TrainingUnitViewV1[];
  commandOptions?: CombatV6CommandOptions;
  controlledCommandOptions?: CombatV6CommandOptions[];
  pendingCommand?: CombatV6TrainingCommandV1;
  events: SequencedCombatV6Event[];
  latestEventSeq: number;
  display?: CombatV6DisplayCatalog;
  playback?: CombatV6PlaybackV1;
}
