import type { RewardSelection } from '@daoyou/game-domain/rewards';
import type { SponsorshipTierId } from '@daoyou/game-domain/sponsorship';

export type MeritTierOffer = {
  name: string;
  theme: string;
  configured: boolean;
  reputationPerMonth: number;
  supply: {
    name: string;
    level: number;
    dailyRewards: RewardSelection[];
  } | null;
};

export type MeritClientConfig = {
  enabled: boolean;
  fulfillmentEnabled: boolean;
  tiers: Record<SponsorshipTierId, MeritTierOffer>;
};

export type MeritPass = {
  name: string;
  level: number;
  endsAt: string | null;
  permanent: boolean;
  deliveredToday: boolean;
  rewardsConfigured: boolean;
  dailyRewards: RewardSelection[];
};
