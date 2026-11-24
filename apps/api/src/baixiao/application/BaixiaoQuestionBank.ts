import type {
  BaixiaoAdminView,
  BaixiaoImportResult,
  BaixiaoQuestionStatus,
} from '@daoyou/contracts/baixiao/meet';
import { DUNGEON_REWARD_PACK } from '@daoyou/game-content/rewards/dungeon';
import { type BaixiaoQuestionData } from '@daoyou/game-domain/baixiao/meet';
import { BaixiaoQuestionSchema } from '@daoyou/game-domain/baixiao/question';
import { materialFactsOf } from '@daoyou/game-domain/inventory';
import { ItemLibraryMaterialPayloadSchema } from '@daoyou/game-domain/items/catalog';
import {
  baixiaoQuotaStatus,
  baixiaoWeek,
} from '@daoyou/game-rules/baixiao/meet';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { DRIZZLE_DATABASE } from '@server/database/database.service.js';
import type { DbClient, DbExecutor } from '@server/lib/drizzle/db.js';
import {
  itemLibrary,
  baixiaoQuestions as questions,
  baixiaoRounds as rounds,
} from '@server/lib/drizzle/schema.js';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { baixiaoPhase } from './baixiao-view.js';

export async function loadBaixiaoBank(tx: DbExecutor, ids: string[]) {
  return (
    await tx.select().from(questions).where(inArray(questions.id, ids))
  ).map(({ id, question }) => ({
    id,
    ...BaixiaoQuestionSchema.parse(question),
  }));
}

@Injectable()
export class BaixiaoQuestionBank {
  constructor(@Inject(DRIZZLE_DATABASE) private readonly db: DbClient) {}

  private async materials() {
    const found = await this.db
      .select({ payload: itemLibrary.payload })
      .from(itemLibrary)
      .where(
        and(
          eq(itemLibrary.type, 'material'),
          eq(itemLibrary.status, 'published'),
          eq(itemLibrary.category, 'gongfa_manual'),
        ),
      )
      .orderBy(sql`random()`)
      .limit(100);
    return found
      .flatMap(({ payload }) => {
        const parsed = ItemLibraryMaterialPayloadSchema.safeParse(payload);
        if (!parsed.success) return [];
        const instanceData = materialFactsOf(parsed.data);
        return instanceData.type === 'gongfa_manual'
          ? [{ definitionId: 'material.v1', quantity: 1, instanceData }]
          : [];
      })
      .slice(0, 32);
  }

  async prepare(clock: ReturnType<typeof baixiaoWeek>) {
    const [round] = await this.db
      .select()
      .from(rounds)
      .where(eq(rounds.week, clock.week));
    if (round) return round;
    const [published, materials] = await Promise.all([
      this.db.select().from(questions).where(eq(questions.status, 'published')),
      this.materials(),
    ]);
    const bank = published.map(({ id, question }) => ({
      id,
      ...BaixiaoQuestionSchema.parse(question),
    }));
    if (
      !materials.length ||
      baixiaoQuotaStatus(bank).some((quota) => quota.available < quota.count)
    )
      return undefined;
    if (Date.now() > clock.lastStartAt) return undefined;
    const superior = DUNGEON_REWARD_PACK.superiorBooks;
    const ordinary = DUNGEON_REWARD_PACK.books
      .map(({ rewardId }) => rewardId)
      .filter((id) => !superior.includes(id));
    if (!ordinary.length || !superior.length) return undefined;
    const [prepared] = await this.db
      .insert(rounds)
      .values({
        week: clock.week,
        closesAt: new Date(clock.closesAt),
        questionIds: bank.map(({ id }) => id),
        materials,
        books: { ordinary, superior },
      })
      .onConflictDoNothing()
      .returning();
    if (prepared) return prepared;
    const [concurrent] = await this.db
      .select()
      .from(rounds)
      .where(eq(rounds.week, clock.week));
    return concurrent;
  }

  async status(): Promise<BaixiaoAdminView> {
    const now = Date.now();
    const clock = baixiaoWeek(now);
    const [[round], bank, materials] = await Promise.all([
      this.db.select().from(rounds).where(eq(rounds.week, clock.week)),
      this.db
        .select()
        .from(questions)
        .orderBy(desc(questions.createdAt), questions.knowledgeKey),
      this.materials(),
    ]);
    const rows = bank.map(({ id, question, status }) => ({
      id,
      ...question,
      status,
    }));
    const quotas = baixiaoQuotaStatus(
      rows.filter((row) => row.status === 'published'),
    ).map(({ category, difficulty, count, available }) => ({
      category,
      difficulty,
      count,
      available,
    }));
    return {
      week: clock.week,
      phase: baixiaoPhase(clock, now, round),
      frozenQuestions: round?.questionIds.length ?? 0,
      materials: round?.materials.length ?? materials.length,
      bank: rows,
      quotas,
    };
  }

  async importQuestions(
    questionsToImport: BaixiaoQuestionData[],
  ): Promise<BaixiaoImportResult> {
    if (
      new Set(questionsToImport.map(({ knowledgeKey }) => knowledgeKey))
        .size !== questionsToImport.length
    ) {
      throw new BadRequestException('同一批导入中存在重复的知识点。');
    }
    const inserted = await this.db
      .insert(questions)
      .values(
        questionsToImport.map((question) => ({
          knowledgeKey: question.knowledgeKey,
          question,
          status: 'published' as const,
        })),
      )
      .onConflictDoNothing({
        target: questions.knowledgeKey,
        where: sql`${questions.status} = 'published'`,
      })
      .returning({ id: questions.id });
    return {
      inserted: inserted.length,
      skipped: questionsToImport.length - inserted.length,
    };
  }

  async setStatus(ids: string[], status: BaixiaoQuestionStatus) {
    try {
      await this.db
        .update(questions)
        .set({ status })
        .where(inArray(questions.id, ids));
    } catch (error) {
      if ((error as { cause?: { code?: string } }).cause?.code === '23505') {
        throw new ConflictException('同一知识点已有启用题，请先停用旧题。');
      }
      throw error;
    }
    return this.status();
  }
}
