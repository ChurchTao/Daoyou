import {
  SPONSORSHIP_TIER_REPUTATION_PER_MONTH,
  type AfdianSponsorshipConfig,
} from '@daoyou/game-domain/sponsorship';

export const DEFAULT_AFDIAN_SPONSORSHIP_CONFIG: AfdianSponsorshipConfig = {
  creatorUrl: 'https://afdian.com/a/afdian',
  acceptingCheckout: false,
  acceptingCustomAmount: true,
  ordersAcceptedAfter: null,
  subscriptionPlans: [],
  tiers: {
    faint_light: {
      planId: '',
      minimumAmountFen: 1,
      reputationPerMonth: SPONSORSHIP_TIER_REPUTATION_PER_MONTH.faint_light,
    },
    fellow_traveler: {
      planId: '',
      minimumAmountFen: 3_800,
      reputationPerMonth: SPONSORSHIP_TIER_REPUTATION_PER_MONTH.fellow_traveler,
    },
    night_guardian: {
      planId: '',
      minimumAmountFen: 9_800,
      reputationPerMonth: SPONSORSHIP_TIER_REPUTATION_PER_MONTH.night_guardian,
    },
    immortality_witness: {
      planId: '',
      minimumAmountFen: 18_800,
      reputationPerMonth:
        SPONSORSHIP_TIER_REPUTATION_PER_MONTH.immortality_witness,
    },
  },
};
