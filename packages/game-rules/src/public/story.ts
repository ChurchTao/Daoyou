/** Public story capabilities. Keep implementation files private. */
export {
  StoryBattleHost,
  createStoryBattleHost,
  storyBattleOutcome,
} from '../story/battle-host.js';
export { storyReward } from '../story/grants.js';
export type { PlannedStoryReward } from '../story/grants.js';
export { storyLocationHref, storyPassageMark } from '../story/location.js';
export { mineSparringEffects } from '../story/mine-sparring.js';
export {
  openingStoryProgress,
  parseStoryProgress,
  restingStoryProgress,
} from '../story/progress.js';
export {
  acknowledgeBattle,
  acknowledgeGuide,
  acknowledgePerformance,
  acknowledgeStoryPassage,
  noteForgedStoryWeapon,
  noteStoryFact,
  presentStory,
  resolveStory,
  rewindToUnwatchedPerformance,
} from '../story/resolve.js';
export type { StoryResolution } from '../story/resolve.js';
export { storyMarkForSignal } from '../story/signals.js';
export type { StorySignal } from '../story/signals.js';
