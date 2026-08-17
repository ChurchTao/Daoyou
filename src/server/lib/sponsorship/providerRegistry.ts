import { afdianSponsorshipProvider } from './afdianProvider';
import type { SponsorshipProvider } from './types';

export function getSponsorshipProvider(): SponsorshipProvider | null {
  const provider = process.env.SPONSORSHIP_PROVIDER?.trim() || 'disabled';
  if (provider === 'disabled') return null;
  if (provider === 'afdian') return afdianSponsorshipProvider;
  throw new Error(`Unsupported SPONSORSHIP_PROVIDER: ${provider}`);
}

export function requireSponsorshipProvider(): SponsorshipProvider {
  const provider = getSponsorshipProvider();
  if (!provider || !provider.isConfigured()) {
    throw new Error('赞助 Provider 未启用或配置不完整');
  }
  return provider;
}
