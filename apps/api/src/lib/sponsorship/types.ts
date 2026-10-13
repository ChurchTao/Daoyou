import type { SponsorshipTierId } from '@daoyou/game-domain/sponsorship';

export type ProviderOrder = {
  provider: 'afdian';
  providerOrderId: string;
  customOrderId: string | null;
  providerUserId: string;
  planId: string | null;
  skuId: string | null;
  productType: number | null;
  totalAmountFen: number;
  showAmountFen: number;
  month: number | null;
  status: number;
  createdAt: Date | null;
  raw: unknown;
};

export type ProviderSponsorPlan = {
  planId: string;
  productType: number | null;
  permanent: boolean;
  expireTime: Date | null;
};

export type ProviderSponsor = {
  userId: string;
  plans: ProviderSponsorPlan[];
};

export type ProviderPlan = {
  planId: string;
  productType: number;
  permanent: boolean;
};

export type VerifiedWebhook = {
  order: ProviderOrder;
  raw: unknown;
};

export type SponsorshipCheckoutRequest = {
  intentId: string;
  tier: SponsorshipTierId;
  planId: string | null;
  customAmountFen?: number;
};

export interface SponsorshipProvider {
  readonly id: 'afdian';
  isConfigured(): boolean;
  verifyWebhook(payload: unknown): VerifiedWebhook;
  queryOrder(providerOrderId: string): Promise<ProviderOrder | null>;
  listOrders(page: number, perPage: number): Promise<ProviderOrder[]>;
  querySponsors(userIds: string[]): Promise<ProviderSponsor[]>;
  queryPlan(planId: string): Promise<ProviderPlan | null>;
  sendMessage(recipient: string, content: string): Promise<void>;
  ping(): Promise<void>;
  buildCheckoutUrl(input: SponsorshipCheckoutRequest): URL;
}
