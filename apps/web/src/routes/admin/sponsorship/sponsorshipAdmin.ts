import { apiFetch } from '@app/lib/api/fetch';
import type { RewardSelection } from '@daoyou/game-domain/rewards';
import type { SponsorshipTierId } from '@daoyou/game-domain/sponsorship';

export type TierConfig = {
  planId: string;
  minimumAmountFen: number;
  reputationPerMonth: number;
};

export type SponsorshipConfig = {
  ordersAcceptedAfter: string | null;
  tiers: Record<SponsorshipTierId, TierConfig>;
  subscriptionPlans: {
    id: string;
    level: number;
    name: string;
    afdianPlanId: string;
    enabled: boolean;
    dailyRewards: RewardSelection[];
  }[];
};

export type SponsorshipOrder = {
  id: string;
  providerOrderId: string;
  providerUserId: string | null;
  recipientCultivatorId: string | null;
  checkoutIntentId: string | null;
  resolvedTier: SponsorshipTierId | null;
  verificationStatus: string;
  fulfillmentStatus: string;
  lastErrorMessage: string | null;
  createdAt: string;
};

export type SponsorshipOrderDetail = {
  order: SponsorshipOrder;
  recipient: { id: string; name: string } | null;
  subscription: {
    id: string;
    cultivatorId: string | null;
    cultivatorName: string | null;
  } | null;
  claims: {
    id: string;
    status: string;
    messageStatus: string;
    expiresAt: string;
  }[];
  records: {
    id: string;
    cultivatorId: string;
    tier: SponsorshipTierId;
    revokedAt: string | null;
  }[];
  snapshots: {
    id: string;
    source: string;
    createdAt: string;
    purgeAfter: string;
  }[];
};

export type OrderFilter =
  'all' | 'attention' | 'awaiting_claim' | 'fulfilled' | 'revoked';

export const ORDER_FILTERS: { id: OrderFilter; label: string }[] = [
  { id: 'all', label: '全部' },
  { id: 'attention', label: '需关注' },
  { id: 'awaiting_claim', label: '待认领' },
  { id: 'fulfilled', label: '已履约' },
  { id: 'revoked', label: '已撤销' },
];

const VERIFICATION_LABELS: Record<string, string> = {
  received: '已收到',
  signature_verified: '签名已核验',
  api_verifying: '正在复核',
  verified: '已核验',
  rejected: '已拒绝',
  needs_attention: '需关注',
};

const FULFILLMENT_LABELS: Record<string, string> = {
  pending: '待处理',
  linked: '已关联',
  awaiting_claim: '待认领',
  fulfilling: '履约中',
  fulfilled: '已履约',
  retry_wait: '等待重试',
  needs_attention: '需关注',
  revoked: '已撤销',
};

export function verificationLabel(status: string): string {
  return VERIFICATION_LABELS[status] ?? status;
}

export function fulfillmentLabel(status: string): string {
  return FULFILLMENT_LABELS[status] ?? status;
}

export async function sponsorshipRequest<T>(
  url: string,
  init?: RequestInit,
): Promise<T> {
  const response = await apiFetch(url, init);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? '请求失败');
  return data as T;
}
