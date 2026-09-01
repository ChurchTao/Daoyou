import {
  db,
  getExecutor,
  runDbTasks,
  type DbExecutor,
} from '@server/lib/drizzle/db';
import {
  cultivators,
  cultivatorTasks,
  mails,
  sectMemberships,
} from '@server/lib/drizzle/schema';
import {
  readResourceVersions,
  readScopeVersion,
} from '@server/lib/repositories/playerStateRepository';
import { getPlayerLoadoutByCultivatorId } from '@server/lib/services/cultivator/CultivatorLoadoutReader';
import { getPlayerIdentityCultivatorById } from '@server/lib/services/cultivator/CultivatorProfileRepository';
import { QiService } from '@server/lib/services/QiService';
import { getOrInitCultivationProgress } from '@server/utils/cultivationUtils';
import {
  PLAYER_RESOURCE_KEYS,
  type PlayerResourceKey,
  type PlayerResourceMap,
  type PlayerResourcesData,
} from '@shared/contracts/player';
import type { ResourceTopic } from '@shared/contracts/resources';
import { RESOURCE_DATA_SCHEMAS } from '@shared/contracts/resources';
import type { RealmStage, RealmType } from '@shared/types/constants';
import { and, desc, eq, sql } from 'drizzle-orm';

export function readPlayerResourcesSnapshot(args: {
  userId: string;
  keys: PlayerResourceKey[];
}): Promise<PlayerResourcesData> {
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`set transaction isolation level repeatable read read only`,
    );
    return readPlayerResources({ ...args, q: tx });
  });
}

const MAX_PLAYER_RESOURCE_KEYS = 8;
const PLAYER_TOPIC_BY_KEY = Object.fromEntries(
  PLAYER_RESOURCE_KEYS.map((key) => [key, `player.${key}`]),
) as Record<PlayerResourceKey, ResourceTopic>;

type ReaderContext = {
  userId: string;
  cultivatorId: string;
  q: DbExecutor;
  now: Date;
  cultivatorState?: RequestedCultivatorState;
};

type PlayerResourceReader<K extends PlayerResourceKey> = (
  context: ReaderContext,
) => Promise<PlayerResourceMap[K]>;

export async function readPlayerMailSummary(
  cultivatorId: string,
  q: DbExecutor,
): Promise<PlayerResourceMap['mail-summary']> {
  const [result] = await q
    .select({ count: sql<number>`count(*)::int` })
    .from(mails)
    .where(and(eq(mails.cultivatorId, cultivatorId), eq(mails.isRead, false)));
  return { unreadCount: Number(result?.count ?? 0) };
}

export async function readPlayerTaskSummary(
  cultivatorId: string,
  q: DbExecutor,
): Promise<PlayerResourceMap['task-summary']> {
  const rows = await q
    .select({
      status: cultivatorTasks.status,
      count: sql<number>`count(*)::int`,
    })
    .from(cultivatorTasks)
    .where(eq(cultivatorTasks.cultivatorId, cultivatorId))
    .groupBy(cultivatorTasks.status);
  const counts = new Map(rows.map((row) => [row.status, Number(row.count)]));
  return {
    activeCount: counts.get('active') ?? 0,
    claimableCount: counts.get('completed') ?? 0,
  };
}

export async function readPlayerProgress(
  cultivatorId: string,
  q: DbExecutor,
): Promise<PlayerResourceMap['progress']> {
  const row = await requireCultivatorColumns(cultivatorId, q, {
    cultivation_progress: true,
    realm: true,
    realm_stage: true,
  });
  return mapPlayerProgress(row);
}

function mapPlayerProgress(row: {
  cultivation_progress: unknown;
  realm: string;
  realm_stage: string;
}): PlayerResourceMap['progress'] {
  return getOrInitCultivationProgress(
    (row.cultivation_progress ?? {}) as PlayerResourceMap['progress'],
    row.realm as RealmType,
    row.realm_stage as RealmStage,
  );
}

const readers: {
  [K in Exclude<PlayerResourceKey, 'session'>]: PlayerResourceReader<K>;
} = {
  profile: async ({ userId, cultivatorId, q }) => {
    const cultivator = await getPlayerIdentityCultivatorById(
      userId,
      cultivatorId,
      q,
    );
    if (!cultivator) throw new Error('角色不存在');
    return { cultivator };
  },
  condition: async ({ cultivatorState }) => {
    const row = requireRequestedCultivatorState(cultivatorState, 'condition');
    return row.condition as PlayerResourceMap['condition'];
  },
  progress: async ({ cultivatorState }) => {
    const row = requireRequestedCultivatorState(cultivatorState, 'progress');
    return mapPlayerProgress({
      cultivation_progress: row.cultivation_progress,
      realm: row.realm!,
      realm_stage: row.realm_stage!,
    });
  },
  currency: async ({ cultivatorState, now }) => {
    const row = requireRequestedCultivatorState(cultivatorState, 'currency');
    const qiState = QiService.calculateNaturalQiState({
      qi: row.qi!,
      qiLastRefreshedAt: row.qiLastRefreshedAt!,
      now,
    });
    return {
      spiritStones: row.spirit_stones!,
      reputation: row.reputation!,
      qi: qiState.qi,
      qiLastRefreshedAt: qiState.qiLastRefreshedAt?.toISOString() ?? null,
    };
  },
  loadout: ({ cultivatorId, q }) =>
    getPlayerLoadoutByCultivatorId(cultivatorId, q),
  'mail-summary': ({ cultivatorId, q }) =>
    readPlayerMailSummary(cultivatorId, q),
  'task-summary': ({ cultivatorId, q }) =>
    readPlayerTaskSummary(cultivatorId, q),
};

export function parsePlayerResourceKeys(raw: string): PlayerResourceKey[] {
  const keys = Array.from(
    new Set(
      raw
        .split(',')
        .map((key) => key.trim())
        .filter(Boolean),
    ),
  );
  if (keys.length === 0 || keys.length > MAX_PLAYER_RESOURCE_KEYS) {
    throw new Error('玩家资源 keys 数量无效');
  }
  for (const key of keys) {
    if (!PLAYER_RESOURCE_KEYS.includes(key as PlayerResourceKey)) {
      throw new Error(`未知玩家资源: ${key}`);
    }
  }
  return keys as PlayerResourceKey[];
}

export async function readPlayerResources(args: {
  userId: string;
  keys: PlayerResourceKey[];
  q?: DbExecutor;
}): Promise<PlayerResourcesData> {
  const q = args.q ?? getExecutor();
  const active = await q.query.cultivators.findFirst({
    columns: { id: true, status: true },
    where: and(
      eq(cultivators.userId, args.userId),
      eq(cultivators.status, 'active'),
    ),
  });
  const wantsOnlySession = args.keys.length === 1 && args.keys[0] === 'session';
  if (!active && !wantsOnlySession) throw new Error('当前没有活跃角色');

  const resourceData: Partial<PlayerResourceMap> = {};
  const resourceReads: Array<() => Promise<void>> = [];
  if (args.keys.includes('session')) {
    resourceReads.push(async () => {
      const membership = active
        ? await q.query.sectMemberships.findFirst({
            columns: { sectId: true },
            where: and(
              eq(sectMemberships.cultivatorId, active.id),
              eq(sectMemberships.status, 'active'),
            ),
          })
        : null;
      resourceData.session = {
        activeCultivator: active
          ? {
              id: active.id,
              status: 'active',
              sectId: membership?.sectId ?? null,
            }
          : null,
        ...(!active
          ? { note: await findInactiveCultivatorNote(args.userId, q) }
          : {}),
      };
    });
  }

  if (!active) {
    await runDbTasks(q, resourceReads);
    const now = new Date();
    const accountScope = { kind: 'account' as const, id: args.userId };
    const [scopeVersion, versions] = await runDbTasks(q, [
      () => readScopeVersion(accountScope, q),
      () => readResourceVersions(accountScope, ['player.session'], q),
    ]);
    return {
      cultivatorId: null,
      resources: {
        session: {
          data: resourceData.session!,
          resource: {
            scope: accountScope,
            topic: 'player.session',
            resourceVersion: versions['player.session'] ?? 0,
            scopeVersion,
          },
        },
      },
      serverTime: now.toISOString(),
    };
  }

  const requested = args.keys.filter(
    (key): key is Exclude<PlayerResourceKey, 'session'> => key !== 'session',
  );
  const cultivatorState = await readRequestedCultivatorState(
    active.id,
    requested,
    q,
  );
  const now = new Date();
  resourceReads.push(
    ...requested.map((key) => async () => {
      const context: ReaderContext = {
        userId: args.userId,
        cultivatorId: active.id,
        q,
        now,
        cultivatorState,
      };
      Object.assign(resourceData, {
        [key]: await readers[key](context),
      });
    }),
  );

  const accountScope = { kind: 'account' as const, id: args.userId };
  const cultivatorScope = { kind: 'cultivator' as const, id: active.id };
  const cultivatorTopics = requested.map((key) => PLAYER_TOPIC_BY_KEY[key]);
  await runDbTasks(q, resourceReads);
  const [
    accountScopeVersion,
    accountVersions,
    cultivatorScopeVersion,
    cultivatorVersions,
  ] = await runDbTasks(q, [
    () => readScopeVersion(accountScope, q),
    () => readResourceVersions(accountScope, ['player.session'], q),
    () => readScopeVersion(cultivatorScope, q),
    () => readResourceVersions(cultivatorScope, cultivatorTopics, q),
  ]);
  const resources: PlayerResourcesData['resources'] = {};
  for (const key of args.keys) {
    const data = resourceData[key];
    if (data === undefined) continue;
    const topic = PLAYER_TOPIC_BY_KEY[key];
    RESOURCE_DATA_SCHEMAS[topic].parse(data);
    const scope = key === 'session' ? accountScope : cultivatorScope;
    const scopeVersion =
      key === 'session' ? accountScopeVersion : cultivatorScopeVersion;
    const versions = key === 'session' ? accountVersions : cultivatorVersions;
    Object.assign(resources, {
      [key]: {
        data,
        resource: {
          scope,
          topic,
          resourceVersion: versions[topic] ?? 0,
          scopeVersion,
        },
      },
    });
  }
  return {
    cultivatorId: active.id,
    resources,
    serverTime: now.toISOString(),
  };
}

async function requireCultivatorColumns<
  TColumns extends Record<string, boolean>,
>(cultivatorId: string, q: DbExecutor, columns: TColumns) {
  const row = await q.query.cultivators.findFirst({
    columns,
    where: eq(cultivators.id, cultivatorId),
  });
  if (!row) throw new Error('角色不存在');
  return row;
}

type RequestedCultivatorState = {
  condition?: unknown;
  cultivation_progress?: unknown;
  realm?: string;
  realm_stage?: string;
  spirit_stones?: number;
  reputation?: number;
  qi?: number;
  qiLastRefreshedAt?: Date;
};

async function readRequestedCultivatorState(
  cultivatorId: string,
  keys: readonly Exclude<PlayerResourceKey, 'session'>[],
  q: DbExecutor,
): Promise<RequestedCultivatorState | undefined> {
  const wantsCondition = keys.includes('condition');
  const wantsProgress = keys.includes('progress');
  const wantsCurrency = keys.includes('currency');
  if (!wantsCondition && !wantsProgress && !wantsCurrency) return undefined;

  const columns = {
    condition: wantsCondition,
    cultivation_progress: wantsProgress,
    realm: wantsProgress,
    realm_stage: wantsProgress,
    spirit_stones: wantsCurrency,
    reputation: wantsCurrency,
    qi: wantsCurrency,
    qiLastRefreshedAt: wantsCurrency,
  };
  const row = await q.query.cultivators.findFirst({
    columns,
    where: eq(cultivators.id, cultivatorId),
  });
  if (!row) throw new Error('角色不存在');
  return row as RequestedCultivatorState;
}

function requireRequestedCultivatorState(
  state: RequestedCultivatorState | undefined,
  key: 'condition' | 'progress' | 'currency',
): RequestedCultivatorState {
  if (!state) {
    throw new Error(`玩家资源缺少角色字段装配: ${key}`);
  }
  return state;
}

async function findInactiveCultivatorNote(
  userId: string,
  q: DbExecutor,
): Promise<string | undefined> {
  const [latest] = await q
    .select({ status: cultivators.status })
    .from(cultivators)
    .where(eq(cultivators.userId, userId))
    .orderBy(desc(cultivators.updatedAt))
    .limit(1);
  return latest?.status === 'dead' ? '前世道途已尽' : undefined;
}
