/** Public condition capabilities. Keep implementation files private. */
export {
  getBreakthroughPenalty,
  getBreakthroughPenaltyPercent,
  getConditionStatusCureTargets,
  getNextConditionStatusExpiryMs,
  getPillToxicityRecoveryMultiplier,
  getPillToxicityStage,
  hasActiveConditionStatus,
  isConditionStatusActive,
  projectNaturalRecoveryResources,
} from '../condition/index.js';
export type {
  NaturalRecoveryEstimate,
  NaturalRecoveryProjection,
  NaturalRecoveryResourceProjection,
  PillToxicityStage,
} from '../condition/index.js';
export {
  getConditionStatusTemplate,
  isConditionStatusKey,
} from '../condition/statuses.js';
export type { ConditionStatusTemplate } from '../condition/statuses.js';
export { getTrackConfig } from '../condition/tracks.js';
export type { TrackConfig, TrackReward } from '../condition/tracks.js';
export {
  calculateInnRecoveryLossAmount,
  calculateInnRecoveryLossRange,
  calculateInnRecoverySpiritStoneCost,
  rollInnRecoveryLossPercent,
} from '../condition/inn-recovery.js';
