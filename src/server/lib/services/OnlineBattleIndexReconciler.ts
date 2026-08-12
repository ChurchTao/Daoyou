import {
  reconcileBattleReplayArchiveTracking,
  scanBattleReplayArchivePointerMatchIds,
} from './BattleReplayRedisStore';
import type { OnlineBattleStore } from './OnlineBattleStore';

const DERIVED_INDEXES = [
  'all',
  'deadlines',
  'resolving',
  'waiting',
  'deadline_claims',
  'waiting_claims',
] as const;

type DerivedIndex = (typeof DERIVED_INDEXES)[number];

export interface OnlineBattleIndexReconcileCursor {
  runtime: string;
  terminalOutbox: string;
  replayArchive: string;
  derived: Record<DerivedIndex, string>;
}

export function createOnlineBattleIndexReconcileCursor(): OnlineBattleIndexReconcileCursor {
  return {
    runtime: '0',
    terminalOutbox: '0',
    replayArchive: '0',
    derived: {
      all: '0',
      deadlines: '0',
      resolving: '0',
      waiting: '0',
      deadline_claims: '0',
      waiting_claims: '0',
    },
  };
}

export async function reconcileOnlineBattleIndexes(
  store: OnlineBattleStore,
  cursor: OnlineBattleIndexReconcileCursor,
  count = 100,
): Promise<OnlineBattleIndexReconcileCursor> {
  await store.repairDerivedIndexTypes();
  const [runtimePage, terminalOutboxPage, replayArchivePage, ...derivedPages] =
    await Promise.all([
      store.scanRuntimeMatchIds(cursor.runtime, count),
      store.scanTerminalOutboxMatchIds(cursor.terminalOutbox, count),
      scanBattleReplayArchivePointerMatchIds(cursor.replayArchive, count),
      ...DERIVED_INDEXES.map((index) =>
        store.scanDerivedIndexMatchIds(index, cursor.derived[index], count),
      ),
    ]);

  await reconcileItems('runtime', runtimePage.matchIds, (matchId) =>
    store.reconcileMatchIndexes(matchId),
  );
  await reconcileItems(
    'terminal_outbox',
    terminalOutboxPage.matchIds,
    (matchId) => store.reconcileTerminalOutboxTracking(matchId),
  );
  await reconcileItems(
    'replay_archive',
    replayArchivePage.matchIds,
    reconcileBattleReplayArchiveTracking,
  );
  await store.pruneOrphanedMatchIndexes(
    derivedPages.flatMap((page) => page.matchIds),
  );

  return {
    runtime: runtimePage.cursor,
    terminalOutbox: terminalOutboxPage.cursor,
    replayArchive: replayArchivePage.cursor,
    derived: Object.fromEntries(
      DERIVED_INDEXES.map((index, indexPosition) => [
        index,
        derivedPages[indexPosition]?.cursor ?? '0',
      ]),
    ) as Record<DerivedIndex, string>,
  };
}

async function reconcileItems(
  kind: string,
  matchIds: readonly string[],
  reconcile: (matchId: string) => Promise<unknown>,
): Promise<void> {
  await Promise.all(
    matchIds.map(async (matchId) => {
      try {
        await reconcile(matchId);
      } catch (error) {
        console.error('[online-battle] index reconciliation item failed', {
          kind,
          matchId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }),
  );
}
