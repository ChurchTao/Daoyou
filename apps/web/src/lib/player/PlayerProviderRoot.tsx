import { usePlayerSession } from '@app/lib/resources/player';
import { resourceStore } from '@app/lib/resources/store';
import type { ReactNode } from 'react';
import { useEffect, useLayoutEffect } from 'react';

export function PlayerProvider({
  accountId,
  children,
}: {
  accountId: string;
  children: ReactNode;
}) {
  const session = usePlayerSession();
  const accountBound = resourceStore.isBoundToAccount(accountId);
  const cultivatorId = accountBound
    ? session.data?.activeCultivator?.id ?? null
    : null;
  const sectId = accountBound
    ? session.data?.activeCultivator?.sectId ?? null
    : null;

  useLayoutEffect(() => {
    resourceStore.bindAccount(accountId);
    return () => resourceStore.clear();
  }, [accountId]);

  useLayoutEffect(() => {
    resourceStore.bindSession(cultivatorId, sectId);
  }, [cultivatorId, sectId]);

  useEffect(() => {
    resourceStore.setRealtimeScopes(accountId, cultivatorId, sectId);
  }, [accountId, cultivatorId, sectId]);

  return children;
}
