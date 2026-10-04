/** Public beasts/growth capabilities. Keep implementation files private. */
export {
  BEAST_ATTRIBUTE_NAMES,
  BEAST_CAPACITY,
  BeastAllocationSchema,
  CAPTURE_SKILL_ID,
  allocateBeast,
  beastDeathIds,
  beastRestCost,
  beastVictoryExperience,
  gainBeastExp,
  loseBeastLifespan,
  nextBeastExp,
} from '../../beasts/progression.js';
export { previewBeastFeeding } from '../../beasts/feeding.js';
export { rejuvenateBeast } from '../../beasts/rejuvenation.js';
export { beastOriginName } from '../../beasts/identity.js';
export type { BeastIdentity, BeastOriginKind } from '../../beasts/identity.js';
