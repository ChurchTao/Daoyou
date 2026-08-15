import type { DbTransaction } from '@server/lib/drizzle/db';
import { listPlayerMutationRequestsByPrefix } from '@server/lib/repositories/playerStateRepository';
import { playerCommandExecutor } from '@server/lib/services/CommandExecutors';
import { qiCurrencyChange } from '@server/lib/services/QiResourceChanges';
import { QiService } from '@server/lib/services/QiService';
import {
  blackMarketEntryCost,
  blackMarketEntryId,
} from '@shared/lib/blackMarketRules';
import type { BlackMarketNpcId } from '@shared/types/blackMarket';
import { createHash } from 'node:crypto';

const ENTRY_SOURCE = 'black_market_entry';

export interface BlackMarketEntryGrant {
  dayKey: string;
  nodeId: string;
  npcId: BlackMarketNpcId;
  cost: 0 | 5;
  free: boolean;
  grantedAt: number;
}

function requestId(input: {
  dayKey: string;
  nodeId: string;
  npcId: BlackMarketNpcId;
}): string {
  return blackMarketEntryId(input);
}

function dailyPrefix(dayKey: string): string {
  return `${dayKey}:`;
}

function parseGrant(value: unknown): BlackMarketEntryGrant | null {
  if (!value || typeof value !== 'object') return null;
  const grant = value as Partial<BlackMarketEntryGrant>;
  if (
    typeof grant.dayKey !== 'string' ||
    typeof grant.nodeId !== 'string' ||
    typeof grant.npcId !== 'string' ||
    (grant.cost !== 0 && grant.cost !== 5) ||
    typeof grant.free !== 'boolean' ||
    typeof grant.grantedAt !== 'number'
  ) {
    return null;
  }
  return grant as BlackMarketEntryGrant;
}

export async function listBlackMarketEntryGrants(input: {
  cultivatorId: string;
  dayKey: string;
  tx?: DbTransaction;
}): Promise<BlackMarketEntryGrant[]> {
  const rows = await listPlayerMutationRequestsByPrefix(
    input.cultivatorId,
    ENTRY_SOURCE,
    dailyPrefix(input.dayKey),
    input.tx,
  );
  return rows.flatMap((row) => {
    const grant = parseGrant(row.result);
    return grant ? [grant] : [];
  });
}

export async function grantBlackMarketEntry(input: {
  userId: string;
  cultivatorId: string;
  dayKey: string;
  nodeId: string;
  npcId: BlackMarketNpcId;
}) {
  const id = requestId(input);
  const fingerprint = `${input.cultivatorId}:${id}`;
  return playerCommandExecutor.executeWithLock({
    userId: input.userId,
    cultivatorId: input.cultivatorId,
    source: ENTRY_SOURCE,
    idempotency: { key: id, fingerprint },
    allowEmpty: true,
    lock: { context: 'black-market-entry', timeoutMs: 20_000 },
    command: async (tx) => {
      const grants = await listBlackMarketEntryGrants({
        cultivatorId: input.cultivatorId,
        dayKey: input.dayKey,
        tx,
      });
      const cost = blackMarketEntryCost(grants.length);
      const grant: BlackMarketEntryGrant = {
        dayKey: input.dayKey,
        nodeId: input.nodeId,
        npcId: input.npcId,
        cost,
        free: cost === 0,
        grantedAt: Date.now(),
      };
      if (cost === 0) {
        return { result: grant, resourceChanges: [] };
      }

      const entryHash = createHash('sha256').update(id).digest('hex').slice(0, 32);
      const actionInstanceId = `black-market-entry:${input.cultivatorId}:${entryHash}`;
      const reservation = await QiService.reserveQi({
        cultivatorId: input.cultivatorId,
        action: 'black_market_entry',
        actionInstanceId,
        metadata: {
          dayKey: input.dayKey,
          nodeId: input.nodeId,
          npcId: input.npcId,
        },
        tx,
      });
      await QiService.commitReservation({
        actionInstanceId,
        metadata: { committedAt: new Date().toISOString() },
        tx,
      });
      return {
        result: grant,
        resourceChanges: [
          qiCurrencyChange('currency.qi.black-market-entry.spent', reservation),
        ],
      };
    },
  });
}
