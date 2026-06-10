import { db, type DbTransaction } from '@server/lib/drizzle/db';
import {
  bumpStateVersions,
  insertStateEvents,
} from '@server/lib/repositories/playerStateRepository';
import { publishPlayerStateEvents } from '@server/lib/services/playerStateBroadcaster';
import type {
  PlayerStateDomain,
  PlayerStateDomainVersions,
  PlayerStateMutationMeta,
  PlayerStateMutationResponse,
} from '@shared/contracts/player';

export type StateChangeDescriptor = {
  domain: PlayerStateDomain;
  eventType: string;
  patch?: unknown;
  invalidates?: PlayerStateDomain[];
};

export async function commitPlayerStateMutation<T>(args: {
  userId: string;
  cultivatorId: string;
  source: string;
  requestId?: string | null;
  run: (tx: DbTransaction) => Promise<{
    result: T;
    changes: StateChangeDescriptor[];
  }>;
}): Promise<{
  result: T;
  state: PlayerStateMutationMeta;
}> {
  const committed = await db().transaction(async (tx) => {
    const { result, changes } = await args.run(tx);

    if (changes.length === 0) {
      throw new Error('玩家状态写操作缺少状态变更描述');
    }

    const versions = await bumpStateVersions(
      tx,
      args.cultivatorId,
      changes.map((change) => change.domain),
    );
    const events = await insertStateEvents(tx, {
      userId: args.userId,
      cultivatorId: args.cultivatorId,
      globalVersion: versions.globalVersion,
      domainVersions: versions.domainVersions,
      events: changes.map((change) => ({
        ...change,
        source: args.source,
        requestId: args.requestId ?? null,
      })),
    });

    return {
      result,
      state: {
        cultivatorId: args.cultivatorId,
        globalVersion: versions.globalVersion,
        domainVersions: pickChangedDomainVersions(
          versions.domainVersions,
          changes.map((change) => change.domain),
        ),
        events,
      },
    };
  });

  publishPlayerStateEvents(args.cultivatorId, committed.state.events);

  return committed;
}

export function toPlayerStateMutationResponse<T>(
  committed: {
    result: T;
    state: PlayerStateMutationMeta;
  },
): PlayerStateMutationResponse<T> {
  return {
    success: true,
    data: committed.result,
    state: committed.state,
  };
}

function pickChangedDomainVersions(
  domainVersions: PlayerStateDomainVersions,
  domains: PlayerStateDomain[],
): Partial<PlayerStateDomainVersions> {
  const uniqueDomains = Array.from(new Set(domains));
  return uniqueDomains.reduce<Partial<PlayerStateDomainVersions>>(
    (acc, domain) => {
      acc[domain] = domainVersions[domain];
      return acc;
    },
    {},
  );
}
