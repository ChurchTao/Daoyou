import {
  CombatActivityNoticeSchema,
  type CombatActivityNotice,
} from '@shared/contracts/combatActivity';
import { useEffect, useState } from 'react';

const POLL_MS = 8_000;

export function useCombatActivityNotice(enabled: boolean) {
  const [notice, setNotice] = useState<CombatActivityNotice | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const load = () => {
      fetch('/api/combat-v6/activity', { cache: 'no-store' })
        .then(async (response) => {
          const body = (await response.json()) as {
            success?: boolean;
            data?: unknown;
          };
          if (!response.ok || !body.success) return;
          const parsed = CombatActivityNoticeSchema.nullable().safeParse(
            body.data ?? null,
          );
          if (!cancelled && parsed.success) setNotice(parsed.data);
        })
        .catch(() => undefined);
    };
    load();
    const timer = window.setInterval(load, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') load();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [enabled]);
  return enabled ? notice : null;
}
