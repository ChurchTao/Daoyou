import { apiFetch } from '@app/lib/api/fetch';
import type { SponsorshipTierId } from '@daoyou/shared/lib/sponsorship';
import { useEffect, useState } from 'react';

type MeritProfileResponse = {
  profile: { highestTier: SponsorshipTierId } | null;
};

export function usePlayerMeritTier(
  cultivatorId: string | undefined,
): SponsorshipTierId | null {
  const [tier, setTier] = useState<SponsorshipTierId | null>(null);

  useEffect(() => {
    if (!cultivatorId) return;

    let cancelled = false;
    apiFetch('/api/sponsorship/me')
      .then(async (response) => {
        const data = (await response.json()) as
          MeritProfileResponse | { error?: string };
        if (!response.ok) {
          throw new Error('error' in data ? data.error : '请求失败');
        }
        return data as MeritProfileResponse;
      })
      .then((data) => {
        if (!cancelled) setTier(data.profile?.highestTier ?? null);
      })
      .catch(() => {
        if (!cancelled) setTier(null);
      });

    return () => {
      cancelled = true;
    };
  }, [cultivatorId]);

  return tier;
}
