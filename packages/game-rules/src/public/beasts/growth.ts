/** Public beasts/growth capabilities. Keep implementation files private. */
export { previewBeastFeeding } from '../../beasts/feeding.js';
export { beastOriginName } from '../../beasts/identity.js';
export type { BeastIdentity, BeastOriginKind } from '../../beasts/identity.js';
export {
  BEAST_ATTRIBUTE_NAMES,
  BEAST_BAG_CAPACITY,
  BEAST_BAG_FULL_CAPTURE_MESSAGE,
  BEAST_WAREHOUSE_CAPACITY,
  BeastAllocationSchema,
  CAPTURE_SKILL_ID,
  allocateBeast,
  beastDeathIds,
  beastRestCost,
  beastVictoryExperience,
  carriedBeastIds,
  gainBeastExp,
  loseBeastLifespan,
  nextBeastExp,
  receivedBeastPlacement,
  splitCapturedBeasts,
  warehouseBeastCount,
} from '../../beasts/progression.js';
export { rejuvenateBeast } from '../../beasts/rejuvenation.js';
