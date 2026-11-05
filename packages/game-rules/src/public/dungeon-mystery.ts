/** Public dungeon mystery capabilities. Keep implementation files private. */
export {
  applyMysteryAction,
  applyMysteryDialogue,
  applyMysteryGuardBattle,
  createMysteryRun,
  evaluateMysteryCondition,
  mysteryGuardAt,
  mysteryGuardChallenge,
  mysteryMechanismState,
  mysteryNeighbors,
  mysteryNpcPresent,
  mysteryRevealableSecrets,
} from '../dungeon/mystery/engine.js';
export type { MysteryActionResult } from '../dungeon/mystery/engine.js';
export {
  MYSTERY_LIBRARY_POLICY,
  decideMysteryRestock,
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
export {
  MECHANISM_MAX_FAILURES,
  mechanismCandidates,
  renderHintRule,
} from '../dungeon/mystery/mechanism.js';
export {
  mysteryFinalePortrait,
  projectMysteryView,
} from '../dungeon/mystery/projection.js';
export {
  checkMysteryAnswers,
  mysteryConfrontationTarget,
  mysteryTierForScore,
  scoreMysteryRun,
} from '../dungeon/mystery/scoring.js';
export {
  MYSTERY_TEXT_PLACEHOLDER,
  buildMysterySkeleton,
} from '../dungeon/mystery/skeleton.js';
export type { MysteryCaseSkeleton } from '../dungeon/mystery/skeleton.js';
export {
  computeMysteryReachability,
  estimateMysteryMinimumActions,
  validateMysteryCase,
} from '../dungeon/mystery/validate.js';
