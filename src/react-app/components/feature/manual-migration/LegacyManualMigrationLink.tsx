import { InkButton } from '@app/components/ui/InkButton';
import { usePlayerSession } from '@app/lib/resources/player';
import { useEffect, useState } from 'react';
import { combatV6Request } from '../combat-v6/request';
export function LegacyManualMigrationLink() {
  const identity = usePlayerSession();
  const ownerId = identity.data?.activeCultivator?.id;
  const [availableOwner, setAvailableOwner] = useState<string>();
  useEffect(() => {
    if (!ownerId) return;
    const controller = new AbortController();
    void combatV6Request<{ ownerId: string; available: boolean }>(
      '/api/manual-migration/availability',
      { signal: controller.signal },
    )
      .then((v) => {
        if (!controller.signal.aborted)
          setAvailableOwner(v.available ? v.ownerId : undefined);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [ownerId]);
  return ownerId && availableOwner === ownerId ? (
    <InkButton href="/game/manual-migration">旧功法传承</InkButton>
  ) : null;
}
