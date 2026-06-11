import { getExecutor, type DbExecutor } from '@server/lib/drizzle/db';
import { battleRecordsV2 } from '@server/lib/drizzle/schema';
import type {
  BattleRecord,
  BattleRecordType,
  BattleRecordUnitSummary,
  BattleRecordV2Summary,
} from '@server/lib/services/battleResult';
import { and, desc, eq, or, sql, type SQL } from 'drizzle-orm';

export type BattleRecordV2Row = typeof battleRecordsV2.$inferSelect;

export interface CreateBattleRecordV2Input {
  userId: string;
  cultivatorId: string;
  opponentCultivatorId?: string | null;
  battleType?: BattleRecordType;
  battleResult: BattleRecord;
  battleReport?: string | null;
  engineVersion?: string;
  resultVersion?: number;
}

export interface ListBattleRecordV2Input {
  cultivatorId: string;
  page: number;
  pageSize: number;
  type?: 'challenge' | 'challenged' | null;
}

export interface ListBattleRecordV2Result {
  data: BattleRecordV2Summary[];
  hasMore: boolean;
}

const battleRecordSummaryFields = {
  id: battleRecordsV2.id,
  cultivatorId: battleRecordsV2.cultivatorId,
  opponentCultivatorId: battleRecordsV2.opponentCultivatorId,
  createdAt: battleRecordsV2.createdAt,
  winner: sql<BattleRecordUnitSummary>`jsonb_build_object(
    'id', ${battleRecordsV2.battleResult} #>> '{winner,id}',
    'name', ${battleRecordsV2.battleResult} #>> '{winner,name}'
  )`,
  loser: sql<BattleRecordUnitSummary>`jsonb_build_object(
    'id', ${battleRecordsV2.battleResult} #>> '{loser,id}',
    'name', ${battleRecordsV2.battleResult} #>> '{loser,name}'
  )`,
  turns: sql<number>`(${battleRecordsV2.battleResult} ->> 'turns')::int`,
};

type BattleRecordSummaryRow = {
  id: string;
  cultivatorId: string;
  opponentCultivatorId: string | null;
  createdAt: Date;
  winner: BattleRecordUnitSummary;
  loser: BattleRecordUnitSummary;
  turns: number | null;
};

function assertBattleResultShape(result: BattleRecord): void {
  if (!Array.isArray(result.logSpans) || !result.logSpans.length) {
    throw new Error('战斗记录缺少 logSpans');
  }
  if (!result.stateTimeline?.frames?.length) {
    throw new Error('战斗记录缺少 stateTimeline.frames');
  }
}

export async function createBattleRecordV2(
  input: CreateBattleRecordV2Input,
  q: DbExecutor = getExecutor(),
): Promise<{ id: string }> {
  assertBattleResultShape(input.battleResult);
  const [row] = await q
    .insert(battleRecordsV2)
    .values({
      userId: input.userId,
      cultivatorId: input.cultivatorId,
      opponentCultivatorId: input.opponentCultivatorId ?? null,
      battleType: input.battleType ?? 'normal',
      battleResult: input.battleResult,
      battleReport: input.battleReport ?? null,
      engineVersion: input.engineVersion ?? 'battle-v5',
      resultVersion: input.resultVersion ?? 2,
    })
    .returning({ id: battleRecordsV2.id });

  return row;
}

async function listBattleRecordSummaryRows(
  whereCondition: SQL,
  limit: number,
  offset = 0,
): Promise<BattleRecordSummaryRow[]> {
  return getExecutor()
    .select(battleRecordSummaryFields)
    .from(battleRecordsV2)
    .where(whereCondition)
    .orderBy(desc(battleRecordsV2.createdAt))
    .limit(limit)
    .offset(offset);
}

function toBattleRecordV2Summary(
  row: BattleRecordSummaryRow,
  cultivatorId: string,
): BattleRecordV2Summary {
  return {
    id: row.id,
    createdAt: row.createdAt,
    battleType:
      row.opponentCultivatorId && row.cultivatorId === cultivatorId
        ? 'challenge'
        : row.opponentCultivatorId
          ? 'challenged'
          : 'normal',
    opponentCultivatorId: row.opponentCultivatorId,
    winner: {
      id: row.winner.id,
      name: row.winner.name,
    },
    loser: {
      id: row.loser.id,
      name: row.loser.name,
    },
    turns: Number(row.turns ?? 0),
  };
}

export async function listBattleRecordV2Summaries(
  input: ListBattleRecordV2Input,
): Promise<ListBattleRecordV2Result> {
  const offset = (input.page - 1) * input.pageSize;
  const limit = input.pageSize + 1;

  let rows: BattleRecordSummaryRow[];
  if (input.type === 'challenge') {
    rows = await listBattleRecordSummaryRows(
      eq(battleRecordsV2.cultivatorId, input.cultivatorId),
      limit,
      offset,
    );
  } else if (input.type === 'challenged') {
    rows = await listBattleRecordSummaryRows(
      eq(battleRecordsV2.opponentCultivatorId, input.cultivatorId),
      limit,
      offset,
    );
  } else {
    const fetchLimit = input.page * input.pageSize + 1;
    const [initiatedRows, receivedRows] = await Promise.all([
      listBattleRecordSummaryRows(
        eq(battleRecordsV2.cultivatorId, input.cultivatorId),
        fetchLimit,
      ),
      listBattleRecordSummaryRows(
        eq(battleRecordsV2.opponentCultivatorId, input.cultivatorId),
        fetchLimit,
      ),
    ]);
    const byId = new Map<string, BattleRecordSummaryRow>();
    for (const row of [...initiatedRows, ...receivedRows]) {
      byId.set(row.id, row);
    }
    rows = [...byId.values()]
      .sort(
        (left, right) => right.createdAt.getTime() - left.createdAt.getTime(),
      )
      .slice(offset, offset + limit);
  }

  const hasMore = rows.length > input.pageSize;
  const pageRows = hasMore ? rows.slice(0, input.pageSize) : rows;

  const data = pageRows.map((row) =>
    toBattleRecordV2Summary(row, input.cultivatorId),
  );

  return { data, hasMore };
}

export async function getBattleRecordV2ByIdForCultivator(
  id: string,
  cultivatorId: string,
): Promise<BattleRecordV2Row | null> {
  const [row] = await getExecutor()
    .select()
    .from(battleRecordsV2)
    .where(
      and(
        eq(battleRecordsV2.id, id),
        or(
          eq(battleRecordsV2.cultivatorId, cultivatorId),
          eq(battleRecordsV2.opponentCultivatorId, cultivatorId),
        ),
      ),
    )
    .limit(1);

  return row || null;
}

export async function updateBattleRecordV2Report(
  id: string,
  battleReport: string,
  q: DbExecutor = getExecutor(),
): Promise<void> {
  await q
    .update(battleRecordsV2)
    .set({ battleReport })
    .where(eq(battleRecordsV2.id, id));
}
