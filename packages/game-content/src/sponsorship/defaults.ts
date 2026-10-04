import type { AfdianSponsorshipConfig } from '@daoyou/game-domain/sponsorship';




export const DEFAULT_AFDIAN_SPONSORSHIP_CONFIG: AfdianSponsorshipConfig = {
  creatorUrl: 'https://afdian.com/a/afdian',
  acceptingCheckout: false,
  acceptingCustomAmount: true,
  ordersAcceptedAfter: null,
  tiers: {
    faint_light: { planId: '', minimumAmountFen: 1 },
    fellow_traveler: { planId: '', minimumAmountFen: 3_800 },
    night_guardian: { planId: '', minimumAmountFen: 9_800 },
    immortality_witness: { planId: '', minimumAmountFen: 18_800 },
  },
};
