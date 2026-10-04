import { removeFromAllRankingRealmsExcept } from '@server/lib/redis/rankings.js';
import type { DomainEventEnvelope } from '@daoyou/contracts/events';
import type { FeatureCommandResult } from '@server/player/application/state/CommandExecutors.js';

export async function projectRealmChangedRanking(
  event: DomainEventEnvelope<'cultivator.realm.changed'>,
): Promise<FeatureCommandResult<{ status: 'ignored' | 'applied' }>> {
  if (!event.data.major) {
    return { result: { status: 'ignored' as const }, resourceChanges: [] };
  }
  await removeFromAllRankingRealmsExcept(
    event.data.cultivatorId,
    event.data.toRealm,
  );
  return { result: { status: 'applied' as const }, resourceChanges: [] };
}
