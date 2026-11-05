import type {
  CombatV6CommandOptions,
  CombatV6VersionStamp,
} from '@daoyou/combat-core/types';
import type { CombatV6TrainingCommandV1 } from './commands.js';
import type {
  CombatV6DisplayCatalog,
  CombatV6PlaybackV1,
  CombatV6TrainingUnitViewV1,
  SequencedCombatV6Event,
} from './display.js';
import type { TrainingEncounterOutcome } from './encounter.js';

/** Owner-only preview evaluated at the current command observation. */
export interface CombatV6SkillPreview {
  currentMark?: string;
  reactionName?: string;
  effects: string[];
  nextMark?: string;
}

export type CombatV6CommandOptionsView = CombatV6CommandOptions & {
  skillPreviews?: Record<string, CombatV6SkillPreview>;
};

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
  commandOptions?: CombatV6CommandOptionsView;
  controlledCommandOptions?: CombatV6CommandOptionsView[];
  pendingCommand?: CombatV6TrainingCommandV1;
  events: SequencedCombatV6Event[];
  latestEventSeq: number;
  display?: CombatV6DisplayCatalog;
  playback?: CombatV6PlaybackV1;
}
