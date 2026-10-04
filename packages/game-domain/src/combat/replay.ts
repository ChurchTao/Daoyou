import type { CombatV6DeltaFrameV1, CombatV6TrainingUnitViewV1, CombatV6UnitAppearance } from './display.js';


/** Stored display facts use authoritative event cursors; API projection reindexes them. */
export type CombatV6ReplayTimeline = {
  unitAppearances?: Record<string, CombatV6UnitAppearance>;
  format: 'delta-v1';
  initialUnits: CombatV6TrainingUnitViewV1[];
  finalUnits?: CombatV6TrainingUnitViewV1[];
  initialRound: number;
  fromEventSeq: number;
  frames: CombatV6DeltaFrameV1[];
};
