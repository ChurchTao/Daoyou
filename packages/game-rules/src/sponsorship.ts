import { SPONSORSHIP_TIER_IDS, SPONSORSHIP_TIER_META, type SponsorshipTierId, type AfdianSponsorshipConfig } from '@daoyou/game-domain/sponsorship';



export function parseCnyAmountToFen(value: string): number | null {
  const normalized = value.trim();
  const match = /^(0|[1-9]\d{0,9})(?:\.(\d{1,2}))?$/.exec(normalized);
  if (!match) return null;
  const yuan = Number(match[1]);
  const decimals = (match[2] ?? '').padEnd(2, '0');
  const fen = yuan * 100 + Number(decimals || '0');
  return Number.isSafeInteger(fen) ? fen : null;
}



export function resolveSponsorshipTier(
  input: { planId?: string | null; totalAmountFen: number },
  config: AfdianSponsorshipConfig,
): SponsorshipTierId | null {
  const planId = input.planId?.trim();
  if (planId) {
    for (const tierId of SPONSORSHIP_TIER_IDS) {
      if (config.tiers[tierId].planId === planId) return tierId;
    }
    return null;
  }
  if (!config.acceptingCustomAmount) return null;

  let resolved: SponsorshipTierId | null = null;
  for (const tierId of SPONSORSHIP_TIER_IDS) {
    if (input.totalAmountFen >= config.tiers[tierId].minimumAmountFen) {
      resolved = tierId;
    }
  }
  return resolved;
}



export function isSponsorshipOrderAccepted(
  createdAt: Date | null,
  config: AfdianSponsorshipConfig,
): boolean {
  if (
    !config.acceptingCheckout ||
    !config.ordersAcceptedAfter ||
    !createdAt ||
    Number.isNaN(createdAt.getTime())
  ) {
    return false;
  }
  return createdAt.getTime() >= Date.parse(config.ordersAcceptedAfter);
}



export function highestSponsorshipTier(
  tiers: SponsorshipTierId[],
): SponsorshipTierId | null {
  let result: SponsorshipTierId | null = null;
  for (const tier of tiers) {
    if (
      result === null ||
      SPONSORSHIP_TIER_META[tier].rank > SPONSORSHIP_TIER_META[result].rank
    ) {
      result = tier;
    }
  }
  return result;
}



export function formatSponsorshipMonth(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
  }).format(date);
}
