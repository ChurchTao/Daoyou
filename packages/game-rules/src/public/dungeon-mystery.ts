/** Public dungeon mystery capabilities. Keep implementation files private. */
export {
  applyMysteryAction,
  applyMysteryDialogue,
  createMysteryRun,
  mysteryRevealableSecrets,
  evaluateMysteryCondition,
  mysteryNeighbors,
} from '../dungeon/mystery/engine.js';
export type { MysteryActionResult } from '../dungeon/mystery/engine.js';
export {
  computeMysteryReachability,
  estimateMysteryMinimumActions,
  validateMysteryCase,
} from '../dungeon/mystery/validate.js';
export {
  checkMysteryAnswers,
  mysteryTierForScore,
  scoreMysteryRun,
} from '../dungeon/mystery/scoring.js';
export { projectMysteryView } from '../dungeon/mystery/projection.js';
export {
  buildMysterySkeleton,
  MYSTERY_TEXT_PLACEHOLDER,
} from '../dungeon/mystery/skeleton.js';
export type { MysteryCaseSkeleton } from '../dungeon/mystery/skeleton.js';
export {
  decideMysteryRestock,
  MYSTERY_LIBRARY_POLICY,
  needsMysteryRestock,
  pickMysteryScenario,
  shouldRetireMysteryScenario,
} from '../dungeon/mystery/library.js';
export type {
  LibraryPlay,
  LibraryScenario,
  RestockDecision,
  ScenarioPick,
} from '../dungeon/mystery/library.js';
