import { getExecutor, type DbExecutor } from '@server/lib/drizzle/db';
import { cultivators, cultivatorTasks, mails } from '@server/lib/drizzle/schema';
import { getOrCreateStateVersion } from '@server/lib/repositories/playerStateRepository';
import {
  buildCultivatorRuntime,
  getPlayerLoadoutByCultivatorId,
  getPlayerProfileCultivatorById,
} from '@server/lib/services/cultivatorService';
import { QiService } from '@server/lib/services/QiService';
import {
  PLAYER_STATE_DOMAINS,
  type PlayerStateDomain,
  type PlayerStateSnapshot,
  type PlayerStateSnapshotData,
} from '@shared/contracts/player';
import { getCultivatorDisplaySnapshot } from '@shared/engine/battle-v5/adapters/CultivatorDisplayAdapter';
import { and, eq, sql } from 'drizzle-orm';

export function parsePlayerStateDomains(raw?: string | null): PlayerStateDomain[] {
  if (!raw) {
    return [...PLAYER_STATE_DOMAINS];
  }

  const requested = raw
    .split(',')
    .map((domain) => domain.trim())
    .filter(Boolean);
  const domains = requested.filter((domain): domain is PlayerStateDomain =>
    PLAYER_STATE_DOMAINS.includes(domain as PlayerStateDomain),
  );

  return domains.length > 0 ? domains : [...PLAYER_STATE_DOMAINS];
}

export async function buildPlayerStateSnapshot(args: {
  userId: string;
  cultivatorId: string;
  domains?: PlayerStateDomain[];
  q?: DbExecutor;
}): Promise<PlayerStateSnapshotData> {
  const q = args.q ?? getExecutor();
  const domains = args.domains?.length ? args.domains : [...PLAYER_STATE_DOMAINS];
  const domainSet = new Set<PlayerStateDomain>(domains);
  const version = await getOrCreateStateVersion(args.cultivatorId, q);
  const needsFullCultivator = domains.some((domain) =>
    ['profile', 'condition', 'progress', 'loadout'].includes(domain),
  );
  const needsCultivatorRow = needsFullCultivator || domainSet.has('currency');
  const profile = needsFullCultivator
    ? await getPlayerProfileCultivatorById(args.userId, args.cultivatorId, q)
    : null;
  const loadout = domainSet.has('profile') || domainSet.has('loadout')
    ? await getPlayerLoadoutByCultivatorId(args.cultivatorId, q)
    : null;

  if (needsFullCultivator && !profile) {
    throw new Error('角色不存在');
  }

  const rawCultivator = needsCultivatorRow
    ? await q.query.cultivators.findFirst({
        columns: {
          id: true,
          spirit_stones: true,
          reputation: true,
          qi: true,
          qiLastRefreshedAt: true,
        },
        where: eq(cultivators.id, args.cultivatorId),
      })
    : null;

  if (needsCultivatorRow && !rawCultivator) {
    throw new Error('角色不存在');
  }

  const snapshot: Partial<PlayerStateSnapshot> = {};

  if (domainSet.has('profile')) {
    const runtimeCultivator = buildCultivatorRuntime(profile!, loadout!);
    snapshot.profile = {
      cultivator: profile!,
      display: getCultivatorDisplaySnapshot(runtimeCultivator),
    };
  }

  if (domainSet.has('condition')) {
    snapshot.condition = profile!.condition;
  }

  if (domainSet.has('progress')) {
    snapshot.progress = profile!.cultivation_progress ?? {};
  }

  if (domainSet.has('currency')) {
    const qiState = QiService.calculateNaturalQiState({
      qi: rawCultivator?.qi ?? 0,
      qiLastRefreshedAt: rawCultivator?.qiLastRefreshedAt ?? null,
    });
    snapshot.currency = {
      spiritStones: rawCultivator?.spirit_stones ?? profile?.spirit_stones ?? 0,
      reputation: rawCultivator?.reputation ?? profile?.reputation ?? 0,
      qi: qiState.qi,
      qiLastRefreshedAt:
        qiState.qiLastRefreshedAt?.toISOString() ?? null,
    };
  }

  if (domainSet.has('loadout')) {
    snapshot.loadout = loadout!;
  }

  if (domainSet.has('mail')) {
    snapshot.mail = {
      unreadCount: await countUnreadMail(args.cultivatorId, q),
    };
  }

  if (domainSet.has('tasks')) {
    snapshot.tasks = await getTaskSummary(args.cultivatorId, q);
  }

  return {
    cultivatorId: args.cultivatorId,
    globalVersion: version.globalVersion,
    domainVersions: version.domainVersions,
    snapshot,
    serverTime: new Date().toISOString(),
  };
}

async function countUnreadMail(
  cultivatorId: string,
  q: DbExecutor,
): Promise<number> {
  const [result] = await q
    .select({ count: sql<number>`count(*)::int` })
    .from(mails)
    .where(and(eq(mails.cultivatorId, cultivatorId), eq(mails.isRead, false)));

  return Number(result?.count ?? 0);
}

async function getTaskSummary(
  cultivatorId: string,
  q: DbExecutor,
): Promise<PlayerStateSnapshot['tasks']> {
  const [active] = await q
    .select({ count: sql<number>`count(*)::int` })
    .from(cultivatorTasks)
    .where(
      and(
        eq(cultivatorTasks.cultivatorId, cultivatorId),
        eq(cultivatorTasks.status, 'active'),
      ),
    );
  const [completed] = await q
    .select({ count: sql<number>`count(*)::int` })
    .from(cultivatorTasks)
    .where(
      and(
        eq(cultivatorTasks.cultivatorId, cultivatorId),
        eq(cultivatorTasks.status, 'completed'),
      ),
    );

  return {
    activeCount: Number(active?.count ?? 0),
    claimableCount: Number(completed?.count ?? 0),
  };
}
