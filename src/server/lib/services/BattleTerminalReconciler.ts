import { getJetStreamClient } from '@server/lib/nats';
import {
  BATTLE_TERMINAL_STREAM,
  BATTLE_TERMINAL_SUBJECT,
  type BattleTerminalOutboxV1,
} from '@shared/contracts/battleTerminal';
import { JSONCodec } from 'nats';
import {
  observeOnlineBattleMetric,
  setOnlineBattleMetricGauge,
} from './OnlineBattleMetrics';
import type { OnlineBattleStore } from './OnlineBattleStore';

const codec = JSONCodec<BattleTerminalOutboxV1>();
const RETRY_BUCKET_MS = 60_000;

export async function reconcileBattleTerminalCleanup(
  store: OnlineBattleStore,
  cursor = '0',
): Promise<string> {
  const [page, counts] = await Promise.all([
    store.scanPendingTerminalCleanupMatchIds(cursor, 100),
    store.getTerminalPendingCounts(),
  ]);
  setOnlineBattleMetricGauge('terminal_outbox_pending', counts.outbox);
  setOnlineBattleMetricGauge('terminal_cleanup_pending', counts.cleanup);
  let oldestAgeMs = 0;
  const jetStream = page.matchIds.length > 0 ? await getJetStreamClient() : null;
  for (const matchId of page.matchIds) {
    const outbox = await store.getTerminalOutbox(matchId);
    if (!outbox) {
      observeOnlineBattleMetric('terminal_cleanup_failed_total');
      console.error('[battle-terminal] cleanup manifest unavailable', { matchId });
      continue;
    }
    const ageMs = Math.max(0, Date.now() - outbox.event.terminalAt);
    oldestAgeMs = Math.max(oldestAgeMs, ageMs);
    try {
      await jetStream!.publish(BATTLE_TERMINAL_SUBJECT, codec.encode(outbox), {
        msgID: `${outbox.event.eventId}:reconcile:${Math.floor(Date.now() / RETRY_BUCKET_MS)}`,
        expect: { streamName: BATTLE_TERMINAL_STREAM },
        timeout: 5_000,
      });
      observeOnlineBattleMetric('terminal_cleanup_retry_total');
    } catch (error) {
      observeOnlineBattleMetric('terminal_cleanup_failed_total');
      console.warn('[battle-terminal] cleanup reconcile publish failed', {
        matchId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  setOnlineBattleMetricGauge('terminal_cleanup_age_ms', oldestAgeMs);
  return page.cursor;
}
