/** Public story capabilities. Keep implementation files private. */
export {
  openingStoryProgress,
  parseStoryProgress,
  restingStoryProgress,
} from '../story/progress.js';
export { storyMarkForSignal } from '../story/signals.js';
export type { StorySignal } from '../story/signals.js';
export { storyReward } from '../story/grants.js';
export type { PlannedStoryReward } from '../story/grants.js';
export {
  acknowledgeGuide,
  acknowledgePerformance,
  noteStoryFact,
  presentStory,
  resolveStory,
  rewindToUnwatchedPerformance,
} from '../story/resolve.js';
export type { StoryResolution } from '../story/resolve.js';
