import { InkButton } from '@app/components/ui/InkButton';
import { usePlayerSession } from '@app/lib/resources/player';
import { useEffect, useState } from 'react';
import { combatV6Request } from '../combat-v6/request';
export function LegacyArtifactMigrationLink() {
  const identity = usePlayerSession();
  const ownerId = identity.data?.activeCultivator?.id;
  const [availableOwner, setAvailableOwner] = useState<string>();
  useEffect(() => {
    if (!ownerId) return;
    const controller = new AbortController();
    void combatV6Request<{ ownerId: string; available: boolean }>(
      '/api/artifact-migration/availability',
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
    <InkButton href="/game/artifact-migration">旧法宝焕新</InkButton>
  ) : null;
}
