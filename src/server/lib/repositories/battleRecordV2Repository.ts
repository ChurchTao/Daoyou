import { and, desc, eq, or, sql } from 'drizzle-orm';
import { getExecutor, type DbExecutor } from '@server/lib/drizzle/db';
import { battleRecordsV2 } from '@server/lib/drizzle/schema';
import type {
  BattleRecord,
  BattleRecordType,
  BattleRecordV2Summary,
} from '@server/lib/services/battleResult';

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
  total: number;
  totalPages: number;
}

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

export async function listBattleRecordV2Summaries(
  input: ListBattleRecordV2Input,
): Promise<ListBattleRecordV2Result> {
  const participantCondition = or(
    eq(battleRecordsV2.cultivatorId, input.cultivatorId),
    eq(battleRecordsV2.opponentCultivatorId, input.cultivatorId),
  );

  let whereCondition = participantCondition;
  if (input.type === 'challenge') {
    whereCondition = and(
      participantCondition,
      eq(battleRecordsV2.cultivatorId, input.cultivatorId),
    );
  } else if (input.type === 'challenged') {
    whereCondition = and(
      participantCondition,
      eq(battleRecordsV2.opponentCultivatorId, input.cultivatorId),
    );
  }

  const [countRow] = await getExecutor()
    .select({ count: sql<number>`count(*)::int` })
    .from(battleRecordsV2)
    .where(whereCondition);

  const total = Number(countRow?.count ?? 0);
  const totalPages = total === 0 ? 0 : Math.ceil(total / input.pageSize);
  const offset = (input.page - 1) * input.pageSize;

  const rows = await getExecutor()
    .select()
    .from(battleRecordsV2)
    .where(whereCondition)
    .orderBy(desc(battleRecordsV2.createdAt))
    .limit(input.pageSize)
    .offset(offset);

  const data: BattleRecordV2Summary[] = rows.map((r) => ({
    id: r.id,
    createdAt: r.createdAt,
    battleType:
      r.opponentCultivatorId && r.cultivatorId === input.cultivatorId
        ? 'challenge'
        : r.opponentCultivatorId
          ? 'challenged'
          : 'normal',
    opponentCultivatorId: r.opponentCultivatorId,
    winner: (r.battleResult as BattleRecord).winner,
    loser: (r.battleResult as BattleRecord).loser,
    turns: (r.battleResult as BattleRecord).turns,
  }));

  return { data, total, totalPages };
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
