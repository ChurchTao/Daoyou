/** Public black-market capabilities. Keep implementation files private. */
export {
  applyBlackMarketPriceDecision,
  assessOffer,
} from '../black-market/negotiation.js';
export type {
  BlackMarketNegotiationDecision,
  BlackMarketNegotiationInput,
  BlackMarketNegotiationOutcome,
  BlackMarketOfferAssessment,
} from '../black-market/negotiation.js';
export {
  BLACK_MARKET_ENTRY_COST,
  BLACK_MARKET_MAX_INSPECTIONS,
  BLACK_MARKET_MAX_TURNS,
  BLACK_MARKET_QUALITIES,
  blackMarketDayEnd,
  blackMarketDayKey,
  blackMarketEntryCost,
  blackMarketEntryId,
  blackMarketTurnsRemaining,
  blackMarketUnit,
  classifyBlackMarketReveal,
} from '../black-market/rules.js';
export { sanitizeBlackMarketObservationText } from '../black-market/observations.js';
export type { BlackMarketObservationCandidate } from '../black-market/observations.js';
export {
  applyBlackMarketBeliefPressure,
  computeBlackMarketTrueValue,
  createBlackMarketPricing,
} from '../black-market/pricing.js';
export type {
  BlackMarketDisposition,
  BlackMarketFlexibilityLevel,
  BlackMarketPricingState,
} from '../black-market/pricing.js';
export {
  applyBlackMarketBeliefPatch,
  describeBlackMarketClaimMode,
} from '../black-market/belief.js';
export type {
  BlackMarketBeliefConfidence,
  BlackMarketBeliefPatch,
  BlackMarketBeliefProjection,
} from '../black-market/belief.js';
export { normalizeBlackMarketPlayerBody } from '../black-market/messages.js';
